-- Time-based rules. app.run_jobs() runs every minute (pg_cron on Supabase; the
-- app's ticker in demo mode). Every step is safe to repeat.

create or replace function app.draw_ballot(bid uuid) returns void
language plpgsql as $$
declare b app.ballots; h app.houses; r app.rooms; o uuid[]; i int;
begin
  select * into b from app.ballots where id = bid for update;
  if b.status <> 'open' then return; end if;
  select * into h from app.houses where id = b.house_id;
  select * into r from app.rooms where id = b.room_id;
  select coalesce(array_agg(e.student_id order by random()), '{}') into o
    from app.ballot_entries e join app.profiles p on p.id = e.student_id
   where e.ballot_id = b.id and not p.suspended and not p.deleted;
  if coalesce(array_length(o, 1), 0) = 0 then
    update app.ballots set status = 'lapsed' where id = b.id;
    perform app.note(h.agent_id, case when exists (select 1 from app.ballot_entries where ballot_id = b.id)
      then format('No eligible entries in the ballot for %s at %s. It lists normally when it frees up.', r.name, h.title)
      else format('Nobody entered the ballot for %s at %s. It lists normally when it frees up.', r.name, h.title) end);
    return;
  end if;
  update app.ballots set draw_order = o, status = 'drawn', offer_idx = 0, offer_at = app.now() where id = b.id;
  update app.rooms set hold_ballot = b.id where id = r.id;
  for i in 1 .. array_length(o, 1) loop
    perform app.note(o[i], case when i = 1
      then format('You won the ballot for %s at %s. Pay within %s hours to secure it.', r.name, h.title, (app.cfg()).offer_hours)
      else format('Ballot drawn for %s. You are number %s in line.', h.title, i) end);
  end loop;
  perform app.note(h.agent_id, format('Ballot drawn for %s at %s. %s has %s hours to pay.', r.name, h.title, app.pname(o[1]), (app.cfg()).offer_hours));
  perform app.note(null, format('Ballot drawn for %s with %s entries.', h.title, array_length(o, 1)));
end $$;

create or replace function app.advance_ballot(bid uuid) returns void
language plpgsql as $$
declare b app.ballots; h app.houses; r app.rooms; s uuid;
begin
  update app.ballots set offer_idx = offer_idx + 1 where id = bid returning * into b;
  select * into h from app.houses where id = b.house_id;
  select * into r from app.rooms where id = b.room_id;
  if b.offer_idx >= coalesce(array_length(b.draw_order, 1), 0) then
    update app.ballots set status = 'lapsed' where id = b.id;
    update app.rooms set hold_ballot = null where id = r.id and hold_ballot = b.id;
    perform app.note(h.agent_id, format('No ballot winner paid for %s at %s. It is open to everyone again.', r.name, h.title));
    return;
  end if;
  update app.ballots set offer_at = app.now() where id = b.id;
  s := b.draw_order[b.offer_idx + 1];
  perform app.note(s, format('The room at %s came to you from the ballot. Pay within %s hours to secure it.', h.title, (app.cfg()).offer_hours));
  perform app.note(h.agent_id, format('The ballot offer for %s passed to %s.', h.title, app.pname(s)));
end $$;

-- Demo only: a sample student who won a ballot pays after a few hours.
create or replace function app.demo_winner_pays(bid uuid) returns void
language plpgsql as $$
declare b app.ballots; h app.houses; r app.rooms; s uuid; pid uuid; k app.keys; st timestamptz; c app.settings := app.cfg();
begin
  select * into b from app.ballots where id = bid for update;
  select * into h from app.houses where id = b.house_id;
  select * into r from app.rooms where id = b.room_id;
  s := b.draw_order[b.offer_idx + 1];
  st := app.ballot_start(b);
  insert into app.payments(kind, student_id, house_id, room_id, amount, method, ref, status, created_at, paid_at, meta)
  values ('rent', s, h.id, r.id, r.price, 'Bank transfer', app.gen_ref(), 'held', app.now(), app.now(), jsonb_build_object('ballot_id', b.id))
  returning id into pid;
  insert into app.keys(code, payment_id, house_id, room_id, student_id, start_at, end_at, created_at)
  values (app.gen_key(), pid, h.id, r.id, s, st, st + make_interval(days => c.term_days), app.now()) returning * into k;
  update app.rooms set hold_ballot = null where id = r.id;
  update app.ballots set status = 'filled', winner_key = k.id where id = b.id;
  perform app.note(h.agent_id, format('%s won the ballot and paid %s for %s at %s. {{APP_NAME}} holds it until move-in.', app.pname(s), app.naira(r.price), r.name, h.title));
  perform app.note(e.student_id, format('The ballot for %s has been filled.', h.title))
    from app.ballot_entries e where e.ballot_id = b.id and e.student_id <> s;
end $$;

create or replace function app.run_jobs() returns int
language plpgsql as $$
declare
  c app.settings := app.cfg(); t timestamptz := app.now(); n int := 0;
  k record; i record; b record; g record; p record;
  bal int; hit int[]; th int; nb app.ballots; v_due timestamptz; step interval; cnt int; left_ interval;
begin
  -- 1. Rent held too long without a move-in is released to the agent.
  for k in select k2.* from app.keys k2 join app.payments p2 on p2.id = k2.payment_id
            where k2.status = 'active' and not k2.moved_in and p2.status = 'held'
              and t - coalesce(p2.paid_at, p2.created_at) > make_interval(days => c.release_days) loop
    perform app.release_key(k.id, 'Auto-released after 7 days'); n := n + 1;
  end loop;

  -- 2. Keys that reached their end date: auto-renew from savings, or expire.
  for k in select k2.*, r.price, r.name as rname, r.cap, h.title, h.agent_id
             from app.keys k2 join app.rooms r on r.id = k2.room_id join app.houses h on h.id = k2.house_id
            where k2.status = 'active' and k2.end_at <= t for update of k2 loop
    if k.auto_renew and app.savings_balance(k.student_id) >= k.price
       and not exists (select 1 from app.ballots where key_id = k.id and status in ('drawn', 'filled')) then
      insert into app.payments(kind, student_id, house_id, room_id, amount, savings_used, method, ref, status, created_at, paid_at, released_at, meta)
      values ('renewal', k.student_id, k.house_id, k.room_id, k.price, k.price, 'Rent savings', app.gen_ref(), 'released', t, t, t, jsonb_build_object('key_id', k.id))
      returning * into p;
      insert into app.savings_txns(student_id, type, amt, note, payment_id, created_at)
      values (k.student_id, 'applied', k.price, 'Auto-renewal · ' || k.title, p.id, t);
      perform app.extend_key(k.id);
      perform app.note(k.student_id, format('Auto-renewed %s from savings. New end date %s.', k.title,
        app.fdate((select end_at from app.keys where id = k.id))));
      perform app.note(k.agent_id, format('%s renewed %s at %s for another %s days.', app.pname(k.student_id), k.rname, k.title, c.term_days));
      n := n + 1; continue;
    end if;
    update app.keys set status = 'expired' where id = k.id;
    select * into nb from app.ballots where key_id = k.id and status = 'open';
    if nb.id is not null then perform app.draw_ballot(nb.id); end if;
    cnt := app.active_count(k.room_id);
    perform app.note(k.agent_id, format('%s''s key for %s at %s ended.%s', app.pname(k.student_id), k.rname, k.title,
      case when cnt >= k.cap then ' The next tenant moves in now.'
           when exists (select 1 from app.rooms where id = k.room_id and hold_ballot is not null) then ' The room is held for the ballot winner.'
           else ' The room is listed as Available again.' end));
    perform app.note(k.student_id, format('Your key for %s has ended.%s', k.title,
      case when cnt >= k.cap then ' The next tenant moves in now.'
           when exists (select 1 from app.rooms where id = k.room_id and hold_ballot is not null) then ' The room is held for the ballot winner.'
           else ' The room is back on the market.' end));
    n := n + 1;
  end loop;

  -- 3. Ballots open when a room is within ballot_days of freeing up; 4. renewal reminders.
  for k in select k2.*, r.price, r.name as rname, h.title, h.agent_id
             from app.keys k2 join app.rooms r on r.id = k2.room_id join app.houses h on h.id = k2.house_id
            where k2.status = 'active' and k2.start_at <= t loop
    if k.end_at - t <= make_interval(days => c.ballot_days)
       and not exists (select 1 from app.ballots where key_id = k.id and status <> 'cancelled')
       and not exists (select 1 from app.keys x where x.room_id = k.room_id and x.status = 'active' and x.start_at > t)
       and not (k.auto_renew and app.savings_balance(k.student_id) >= k.price) then
      perform app.open_ballot(k.id, k.end_at);
      perform app.note(k.agent_id, format('%s at %s frees up on %s. Ballot entries are open, and %s keeps first right to renew.',
        k.rname, k.title, app.fdate(k.end_at), app.pname(k.student_id)));
      perform app.note(k.student_id, format('Other students can now enter a ballot for your room at %s. You keep first right to renew until %s.',
        k.title, app.fdate(k.end_at)));
      n := n + 1;
    end if;
    left_ := k.end_at - t;
    select coalesce(array_agg(x), '{}') into hit from unnest(array[60, 30, 7, 1]) x
     where left_ <= make_interval(days => x) and not (x = any (k.shown));
    if array_length(hit, 1) > 0 then
      update app.keys set shown = shown || hit where id = k.id;
      select min(x) into th from unnest(hit) x;
      perform app.note(k.student_id, format('%s day%s left on your key for %s. Renew in the app.', th, case when th > 1 then 's' else '' end, k.title));
      n := n + 1;
    end if;
  end loop;

  -- 5. Expired payment holds.
  update app.rooms set pay_hold_by = null, pay_hold_until = null where pay_hold_until is not null and pay_hold_until <= t;

  -- 6. Visit reminders 24 hours and 1 hour before.
  for i in select i2.*, h.title, h.address, h.agent_id from app.inspections i2 join app.houses h on h.id = i2.house_id
            where i2.status = 'booked' and i2.slot - t <= interval '24 hours' and i2.slot - t > interval '-1 hour'
              and not i2.r1 for update of i2 loop
    if i.slot - t <= interval '1 hour' then
      update app.inspections set r1 = true, r24 = true where id = i.id;
      perform app.note(i.student_id, format('Your visit to %s starts within the hour (%s). Meet %s at %s.', i.title, app.fslot(i.slot), app.pname(i.agent_id), i.address));
      perform app.note(i.agent_id, format('%s visits %s within the hour. Have your door code ready.', app.pname(i.student_id), i.title));
      n := n + 1;
    elsif not i.r24 then
      update app.inspections set r24 = true where id = i.id;
      perform app.note(i.student_id, format('Reminder: your visit to %s is on %s, less than 24 hours away.', i.title, app.fslot(i.slot)));
      perform app.note(i.agent_id, format('Reminder: %s visits %s on %s.', app.pname(i.student_id), i.title, app.fslot(i.slot)));
      n := n + 1;
    end if;
  end loop;

  -- 7. Scheduled savings. Simulated mode adds the deposits; with a real provider the student gets a reminder to top up.
  for g in select * from app.savings_goals where sched <> 'none' and sched_amt > 0 and next_auto is not null and next_auto <= t for update loop
    v_due := g.due::timestamp; step := make_interval(days => case when g.sched = 'weekly' then 7 else 30 end); cnt := 0;
    while g.next_auto <= t and g.next_auto <= v_due and cnt < 60 loop
      if c.payment_mode = 'simulated' then
        insert into app.savings_txns(student_id, type, amt, note, created_at)
        values (g.student_id, 'deposit', g.sched_amt, case when g.sched = 'weekly' then 'Weekly auto-save' else 'Monthly auto-save' end, g.next_auto);
      end if;
      g.next_auto := g.next_auto + step; cnt := cnt + 1;
    end loop;
    update app.savings_goals set next_auto = case when g.next_auto > v_due then null else g.next_auto end where student_id = g.student_id;
    if cnt > 0 then
      perform app.note(g.student_id, case when c.payment_mode = 'simulated'
        then format('%s of %s went into your rent savings.', case when cnt > 1 then cnt || ' automatic deposits' else 'An automatic deposit' end, app.naira(g.sched_amt))
        else format('Time for your %s savings top-up of %s. Add it from Savings.', g.sched, app.naira(g.sched_amt)) end);
      n := n + 1;
    end if;
  end loop;

  -- 8. Ballot draws and offers that ran out.
  for b in select * from app.ballots where status = 'open' and draw_at <= t loop
    perform app.draw_ballot(b.id); n := n + 1;
  end loop;
  for b in select * from app.ballots where status = 'drawn' loop
    if c.demo and b.draw_order[b.offer_idx + 1] = any (array(select app.sid('s' || x) from generate_series(2, 12) x))
       and t - b.offer_at > interval '6 hours' then
      perform app.demo_winner_pays(b.id); n := n + 1;
    elsif t - b.offer_at > make_interval(hours => c.offer_hours) then
      perform app.note(b.draw_order[b.offer_idx + 1], format('Your ballot offer for %s expired.', (select title from app.houses where id = b.house_id)));
      perform app.advance_ballot(b.id); n := n + 1;
    end if;
  end loop;

  -- 9. Checkouts nobody finished.
  update app.payments set status = 'expired' where status = 'pending' and created_at < t - interval '2 hours';
  return n;
end $$;

-- Demo mode: the app calls this every few seconds instead of a scheduler.
create or replace function public.demo_tick(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
begin
  perform app.need_demo();
  return jsonb_build_object('changed', app.run_jobs());
end $$;

-- Demo mode: move the clock (the time machine in the Demo panel).
create or replace function public.demo_set_clock(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
begin
  perform app.need_demo();
  update app.settings set shift_ms = greatest(0, coalesce((a->>'shift')::bigint, 0));
  return jsonb_build_object('changed', app.run_jobs(), 'shift', (app.cfg()).shift_ms);
end $$;
