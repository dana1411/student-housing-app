-- Student actions: saved houses, visits, keys, ballots, savings, complaints.

create or replace function public.toggle_fav(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); hid uuid := (a->>'houseId')::uuid;
begin
  if exists (select 1 from app.favs where student_id = u and house_id = hid) then
    delete from app.favs where student_id = u and house_id = hid;
    return jsonb_build_object('saved', false);
  end if;
  if not exists (select 1 from app.houses where id = hid and not deleted) then perform app.fail('This house is no longer listed.'); end if;
  insert into app.favs(student_id, house_id, created_at) values (u, hid, app.now());
  return jsonb_build_object('saved', true);
end $$;

-- Student types the 4-digit code the agent shows at the house.
create or replace function public.confirm_visit(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); i app.inspections; h app.houses;
begin
  select * into i from app.inspections where id = (a->>'id')::uuid and student_id = u for update;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  if trim(coalesce(a->>'code', '')) <> i.code then
    perform app.fail('That code does not match. Ask the agent to show the code on their {{APP_NAME}} app.');
  end if;
  perform app.complete_visit(i.id);
  select * into h from app.houses where id = i.house_id;
  perform app.note(u, format('Visit at %s confirmed. Rent payment is unlocked.', h.title));
  perform app.note(h.agent_id, format('%s confirmed the visit at %s.', app.pname(u), h.title));
  return '{}'::jsonb;
end $$;

create or replace function app.complete_visit(iid uuid) returns void
language plpgsql as $$
declare h app.houses;
begin
  update app.inspections set status = 'completed', done_at = app.now() where id = iid;
  select h2.* into h from app.houses h2 join app.inspections i on i.house_id = h2.id where i.id = iid;
  update app.agents set insp_done = insp_done + 1 where id = h.agent_id;
  perform app.update_trust(h.agent_id);
end $$;

create or replace function public.rate_visit(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); i app.inspections; ag app.agents; n int := (a->>'n')::int; aid uuid;
begin
  if n is null or n < 1 or n > 5 then perform app.fail('Pick 1 to 5 stars.'); end if;
  select * into i from app.inspections where id = (a->>'id')::uuid and student_id = u for update;
  if i.id is null or i.status <> 'completed' then perform app.fail('You can rate a visit once it is done.'); end if;
  select agent_id into aid from app.houses where id = i.house_id;
  select * into ag from app.agents where id = aid for update;
  if i.rating is not null then
    update app.agents set rating = (rating * ratings - i.rating + n) / greatest(ratings, 1) where id = aid;
  else
    update app.agents set rating = (rating * ratings + n) / (ratings + 1), ratings = ratings + 1 where id = aid;
  end if;
  update app.inspections set rating = n where id = i.id;
  perform app.update_trust(aid);
  select * into ag from app.agents where id = aid;
  perform app.ping(aid);
  return jsonb_build_object('rating', round(ag.rating, 1), 'ratings', ag.ratings, 'trust', ag.trust, 'name', app.first_name(aid));
end $$;

create or replace function public.report_mismatch(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); i app.inspections; h app.houses; txt text := trim(coalesce(a->>'text', ''));
begin
  if txt = '' then perform app.fail('Describe what was different.'); end if;
  select * into i from app.inspections where id = (a->>'id')::uuid and student_id = u for update;
  if i.id is null then perform app.fail('Visit not found.'); end if;
  if i.mismatch then perform app.fail('You already reported this visit.'); end if;
  select * into h from app.houses where id = i.house_id;
  update app.inspections set mismatch = true where id = i.id;
  update app.agents set mismatches = mismatches + 1 where id = h.agent_id;
  perform app.update_trust(h.agent_id);
  insert into app.complaints(kind, author_id, author_name, author_role, about, house_id, agent_id, body, status, created_at)
  values ('mismatch', u, app.pname(u), 'tenant', 'house', h.id, h.agent_id, txt, 'review', app.now());
  perform app.note(null, format('Listing mismatch reported for %s.', h.title));
  perform app.ping(h.agent_id);
  return '{}'::jsonb;
end $$;

-- Is the visit still more than the cut-off away? (Free to move or cancel with a refund.)
create or replace function app.visit_free(i app.inspections) returns boolean
language sql stable as $$ select i.slot - app.now() > make_interval(hours => (app.cfg()).visit_cut_h) $$;

create or replace function public.reschedule_visit(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); i app.inspections; h app.houses; v_slot timestamptz := app.ts((a->>'slot')::bigint); t timestamptz := app.now();
begin
  select * into i from app.inspections where id = (a->>'id')::uuid and student_id = u for update;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  if i.moves > 0 then perform app.fail('You can move a visit once. Cancel it instead if the new time doesn''t work.'); end if;
  if not app.visit_free(i) then perform app.fail('Visits can''t be moved within 12 hours. You can still cancel.'); end if;
  select * into h from app.houses where id = i.house_id;
  if v_slot is null or v_slot <= t or v_slot > t + interval '15 days'
     or not (to_char(app.wat(v_slot), 'HH24:MI') = any (h.times))
     or not (extract(dow from app.wat(v_slot))::int = any (h.days)) then
    perform app.fail('That time is no longer available. Pick another slot.');
  end if;
  update app.inspections set slot = v_slot, moves = moves + 1, r24 = false, r1 = false where id = i.id;
  perform app.note(h.agent_id, format('%s moved their visit at %s to %s.', app.pname(u), h.title, app.fslot(v_slot)));
  return jsonb_build_object('slot', app.ms(v_slot));
end $$;

create or replace function public.cancel_visit(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); i app.inspections; h app.houses; free boolean;
begin
  select * into i from app.inspections where id = (a->>'id')::uuid and student_id = u for update;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  free := app.visit_free(i);
  select * into h from app.houses where id = i.house_id;
  update app.inspections set status = 'stuCancelled', refunded = free where id = i.id;
  if free then perform app.refund_payment_row(i.payment_id); end if;
  perform app.note(h.agent_id, format('%s cancelled the visit to %s on %s.%s', app.pname(u), h.title, app.fslot(i.slot),
    case when free then ' The fee was refunded.' else ' You keep the fee.' end));
  return jsonb_build_object('refunded', free);
end $$;

-- Mark a payment refunded (money goes back through the provider; admin sees it in Payments).
create or replace function app.refund_payment_row(pid uuid) returns void
language plpgsql as $$
declare p app.payments;
begin
  select * into p from app.payments where id = pid for update;
  if p.id is null or p.status = 'refunded' then return; end if;
  update app.payments set status = 'refunded', refunded_at = app.now(),
    meta = meta || case when p.provider = 'paystack' then jsonb_build_object('refund_needed', true) else '{}'::jsonb end
   where id = pid;
  if p.savings_used > 0 then
    insert into app.savings_txns(student_id, type, amt, note, payment_id, created_at)
    values (p.student_id, 'deposit', p.savings_used, 'Refund returned to savings', p.id, app.now());
  end if;
  perform app.ping(p.student_id);
end $$;

create or replace function public.report_no_show(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); i app.inspections; h app.houses; ag app.agents;
begin
  select * into i from app.inspections where id = (a->>'id')::uuid and student_id = u for update;
  if i.id is null or i.status <> 'booked' then perform app.fail('This visit is not open any more.'); end if;
  if i.slot > app.now() then perform app.fail('You can report a no-show once the visit time has passed.'); end if;
  select * into h from app.houses where id = i.house_id;
  update app.inspections set status = 'noshow' where id = i.id;
  perform app.refund_payment_row(i.payment_id);
  update app.agents set no_shows = no_shows + 1 where id = h.agent_id;
  perform app.update_trust(h.agent_id);
  select * into ag from app.agents where id = h.agent_id;
  perform app.note(h.agent_id, format('%s reported that you missed the visit at %s. The fee was refunded and your trust score dropped.', app.pname(u), h.title));
  perform app.note(null, format('No-show reported against %s at %s.', app.pname(h.agent_id), h.title));
  return jsonb_build_object('trust', ag.trust, 'name', app.first_name(h.agent_id));
end $$;

create or replace function public.join_ballot(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); b app.ballots; h app.houses; r app.rooms;
begin
  select * into b from app.ballots where id = (a->>'id')::uuid for update;
  if b.id is null or b.status <> 'open' then perform app.fail('This ballot is closed.'); end if;
  if not app.insp_done(u, b.house_id) then perform app.fail('Inspect the house first. Only students who inspected can enter.'); end if;
  if exists (select 1 from app.keys where id = b.key_id and student_id = u) then perform app.fail('This is your own room. Renew it instead.'); end if;
  select * into h from app.houses where id = b.house_id;
  select * into r from app.rooms where id = b.room_id;
  insert into app.ballot_entries(ballot_id, student_id, created_at) values (b.id, u, app.now()) on conflict do nothing;
  perform app.note(h.agent_id, format('%s joined the ballot for %s at %s.', app.pname(u), r.name, h.title));
  return jsonb_build_object('drawAt', app.ms(b.draw_at));
end $$;

create or replace function public.leave_ballot(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true);
begin
  delete from app.ballot_entries e using app.ballots b
   where e.ballot_id = b.id and b.id = (a->>'id')::uuid and b.status = 'open' and e.student_id = u;
  return '{}'::jsonb;
end $$;

-- Open a ballot for a key's room. Demo mode adds a few sample entrants so the draw has people in it.
create or replace function app.open_ballot(kid uuid, draw timestamptz) returns app.ballots
language plpgsql as $$
declare k app.keys; b app.ballots;
begin
  select * into k from app.keys where id = kid;
  insert into app.ballots(house_id, room_id, key_id, draw_at, created_at)
  values (k.house_id, k.room_id, k.id, draw, app.now()) returning * into b;
  if (app.cfg()).demo then
    insert into app.ballot_entries(ballot_id, student_id, created_at)
    select b.id, p.id, app.now() from app.profiles p
     where p.role = 'student' and p.id <> k.student_id and p.id <> app.sid('s1') and not p.suspended
       and not exists (select 1 from app.keys x where x.student_id = p.id and x.status = 'active')
     order by random() limit 2 + floor(random() * 4)::int;
  end if;
  return b;
end $$;

create or replace function public.not_renewing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); k app.keys; b app.ballots; h app.houses; r app.rooms; draw timestamptz;
begin
  select * into k from app.keys where code = a->>'code' and student_id = u and status = 'active' for update;
  if k.id is null then perform app.fail('This key is no longer active.'); end if;
  update app.keys set not_renewing = true where id = k.id;
  draw := least(k.end_at, app.now() + interval '2 days');
  select * into b from app.ballots where key_id = k.id and status = 'open';
  if b.id is null then b := app.open_ballot(k.id, draw); end if;
  update app.ballots set draw_at = draw where id = b.id;
  select * into h from app.houses where id = k.house_id;
  select * into r from app.rooms where id = k.room_id;
  perform app.note(h.agent_id, format('%s is not renewing %s at %s. The ballot draw is on %s.', app.pname(u), r.name, h.title, app.fdate(draw)));
  return jsonb_build_object('drawAt', app.ms(draw));
end $$;

create or replace function public.toggle_auto_renew(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); on_ boolean;
begin
  update app.keys set auto_renew = not auto_renew where code = a->>'code' and student_id = u and status = 'active'
  returning auto_renew into on_;
  if on_ is null then perform app.fail('This key is no longer active.'); end if;
  return jsonb_build_object('on', on_);
end $$;

-- Release held rent to the agent.
create or replace function app.release_key(kid uuid, reason text) returns void
language plpgsql as $$
declare k app.keys; p app.payments; h app.houses; r app.rooms;
begin
  select * into k from app.keys where id = kid;
  select * into p from app.payments where id = k.payment_id for update;
  select * into h from app.houses where id = k.house_id;
  select * into r from app.rooms where id = k.room_id;
  if reason <> 'Auto-released after 7 days' then update app.keys set moved_in = true where id = kid; end if;
  if p.id is not null and p.status = 'held' then
    update app.payments set status = 'released', released_at = app.now() where id = p.id;
    perform app.note(h.agent_id, format('%s released to you for %s at %s after %s%% commission. %s.',
      app.naira(app.net(p.amount)), r.name, h.title, round((app.cfg()).commission * 100), reason));
  end if;
end $$;

create or replace function public.confirm_move_in(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); k app.keys;
begin
  select * into k from app.keys where code = a->>'code' and student_id = u and status = 'active' for update;
  if k.id is null then perform app.fail('This key is no longer active.'); end if;
  perform app.release_key(k.id, 'Move-in confirmed by the tenant');
  update app.keys set moved_in = true where id = k.id;
  return '{}'::jsonb;
end $$;

create or replace function public.raise_dispute(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true); k app.keys; h app.houses; txt text := trim(coalesce(a->>'text', '')); why text := coalesce(nullif(a->>'reason', ''), 'Something else');
begin
  if txt = '' then perform app.fail('Describe what went wrong.'); end if;
  select * into k from app.keys where code = a->>'code' and student_id = u;
  if k.id is null then perform app.fail('Key not found.'); end if;
  select * into h from app.houses where id = k.house_id;
  insert into app.complaints(kind, author_id, author_name, author_role, about, house_id, agent_id, reason, payment_id, body, status, created_at)
  values ('dispute', u, app.pname(u), 'tenant', 'house', h.id, h.agent_id, why, k.payment_id, txt, 'open', app.now());
  perform app.note(null, format('New dispute from %s about %s: %s.', app.pname(u), h.title, why));
  perform app.note(h.agent_id, format('%s raised a dispute about %s. {{APP_NAME}} will review the chat and payment.', app.pname(u), h.title));
  return '{}'::jsonb;
end $$;

-- Public complaint by a student about a house or its agent.
create or replace function public.post_complaint(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); h app.houses; txt text := trim(coalesce(a->>'text', '')); about text := coalesce(a->>'about', 'house');
begin
  if txt = '' then perform app.fail('Write what happened before posting.'); end if;
  if about not in ('house', 'agent') then about := 'house'; end if;
  select * into h from app.houses where id = (a->>'houseId')::uuid;
  if h.id is null then perform app.fail('House not found.'); end if;
  insert into app.complaints(kind, author_id, author_name, author_role, about, house_id, agent_id, body, status, created_at)
  values ('public', u, app.short_name(u),
          case when exists (select 1 from app.keys where student_id = u and house_id = h.id) then 'tenant' else 'student' end,
          about, h.id, h.agent_id, txt, 'open', app.now());
  perform app.note(h.agent_id, format('%s posted a complaint about %s. You can reply from Account.', app.short_name(u),
    case when about = 'agent' then 'you' else h.title end));
  perform app.note(null, format('New public complaint about %s.', h.title));
  return '{}'::jsonb;
end $$;

-- Right of reply: the agent (about their house) or the tenant (about them).
create or replace function public.reply_complaint(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); cp app.complaints; txt text := trim(coalesce(a->>'text', ''));
begin
  if txt = '' then perform app.fail('Write a reply first.'); end if;
  select * into cp from app.complaints where id = (a->>'id')::uuid for update;
  if cp.id is null then perform app.fail('Complaint not found.'); end if;
  if not (cp.agent_id = u and cp.about <> 'tenant') and not (cp.tenant_id = u and cp.about = 'tenant') then
    perform app.fail('Only the person this complaint is about can reply.');
  end if;
  update app.complaints set reply = txt, reply_by = app.pname(u) where id = cp.id;
  if cp.tenant_id = u then perform app.note(cp.agent_id, format('%s replied to your complaint about them.', app.pname(u))); end if;
  if cp.author_id is not null and cp.author_id <> u then perform app.ping(cp.author_id); end if;
  return '{}'::jsonb;
end $$;

-- Savings goal. a = {name, target, due:'YYYY-MM-DD', mode, sched, schedAmt}
create or replace function public.save_goal(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare
  u uuid := app.need_student(true); g0 app.savings_goals; t timestamptz := app.now();
  nm text := trim(coalesce(a->>'name', '')); tg int := nullif(regexp_replace(coalesce(a->>'target', ''), '\D', '', 'g'), '')::int;
  v_due date; v_mode text := coalesce(a->>'mode', 'flexible'); v_sched text := coalesce(a->>'sched', 'none');
  amt int := coalesce(nullif(regexp_replace(coalesce(a->>'schedAmt', ''), '\D', '', 'g'), '')::int, 0);
  locked boolean; nxt timestamptz;
begin
  begin v_due := (a->>'due')::date; exception when others then v_due := null; end;
  if nm = '' or coalesce(tg, 0) <= 0 or v_due is null then perform app.fail('Add a name, a target and a due date.'); end if;
  if v_mode not in ('flexible', 'locked') then v_mode := 'flexible'; end if;
  if v_sched not in ('none', 'weekly', 'monthly') then v_sched := 'none'; end if;
  select * into g0 from app.savings_goals where student_id = u;
  locked := g0.mode = 'locked' and t < g0.due::timestamp;
  if locked and v_mode <> 'locked' then
    perform app.fail(format('Your savings are locked until %s. You can switch to flexible after that date.', trim(to_char(g0.due, 'FMDD Mon YYYY'))));
  end if;
  if locked and v_due < g0.due then
    perform app.fail(format('While your savings are locked, the due date can move later than %s, not earlier.', trim(to_char(g0.due, 'FMDD Mon YYYY'))));
  end if;
  nxt := case when v_sched = 'none' or amt = 0 then null
              when g0.student_id is null or v_sched is distinct from g0.sched or g0.next_auto is null
                then t + make_interval(days => case when v_sched = 'weekly' then 7 else 30 end)
              else g0.next_auto end;
  insert into app.savings_goals(student_id, name, target, due, mode, sched, sched_amt, next_auto)
  values (u, nm, tg, v_due, v_mode, v_sched, amt, nxt)
  on conflict (student_id) do update set name = excluded.name, target = excluded.target, due = excluded.due,
    mode = excluded.mode, sched = excluded.sched, sched_amt = excluded.sched_amt, next_auto = excluded.next_auto;
  return '{}'::jsonb;
end $$;

create or replace function public.withdraw_savings(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); amt int := nullif(regexp_replace(coalesce(a->>'amount', ''), '\D', '', 'g'), '')::int;
  bal int; g app.savings_goals;
begin
  select * into g from app.savings_goals where student_id = u;
  if g.mode = 'locked' and app.now() < g.due::timestamp then
    perform app.fail(format('Your savings are locked until %s.', trim(to_char(g.due, 'FMDD Mon YYYY'))));
  end if;
  perform 1 from app.profiles where id = u for update;  -- one withdrawal at a time
  bal := app.savings_balance(u);
  if coalesce(amt, 0) <= 0 or amt > bal then perform app.fail(format('Enter an amount up to %s.', app.naira(bal))); end if;
  insert into app.savings_txns(student_id, type, amt, note, created_at)
  values (u, 'withdrawal', amt, coalesce(nullif(a->>'to', ''), 'To your bank or wallet'), app.now());
  perform app.note(null, format('Savings withdrawal of %s requested by %s. Send it to their account.', app.naira(amt), app.pname(u)));
  return jsonb_build_object('amount', amt);
end $$;
