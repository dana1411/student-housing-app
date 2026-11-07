-- Checkout: room holds, starting a payment, and what happens once money arrives.
--
-- Flow: start_checkout() creates a pending payment and returns its reference.
--   * payment_mode = 'simulated' (demo / testing): the app calls simulate_pay(ref).
--   * payment_mode = 'paystack': the app opens Paystack checkout through the
--     paystack-init edge function; Paystack's webhook (or paystack-verify) calls
--     payment_confirmed(), which only the service role may run.
-- Either way app.finalize_payment() applies the effects exactly once.

-- Hold a room for a few minutes while the student pays, so nobody else can take it.
create or replace function public.hold_room(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); r app.rooms; h app.houses; st text; c app.settings := app.cfg();
begin
  select * into r from app.rooms where id = (a->>'roomId')::uuid and not archived for update;
  if r.id is null then perform app.fail('This room is no longer listed.'); end if;
  select * into h from app.houses where id = r.house_id;
  if not app.house_live(h) then perform app.fail('This house is not taking bookings right now.'); end if;
  if not app.insp_done(u, h.id) then perform app.fail('Book and complete an inspection first. Rent unlocks after the visit.'); end if;
  st := app.room_state(r);
  if st = 'pending' and r.pay_hold_by = u then
    return jsonb_build_object('until', app.ms(r.pay_hold_until));
  end if;
  if st = 'pending' then perform app.fail('Another student is paying for this room right now. Try again in a few minutes.'); end if;
  if st <> 'open' then perform app.fail('Someone else just secured this room.'); end if;
  -- one hold per student
  update app.rooms set pay_hold_by = null, pay_hold_until = null where pay_hold_by = u and id <> r.id;
  update app.rooms set pay_hold_by = u, pay_hold_until = app.now() + make_interval(mins => c.hold_minutes)
   where id = r.id returning * into r;
  return jsonb_build_object('until', app.ms(r.pay_hold_until));
end $$;

create or replace function public.release_room(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(true);
begin
  update app.rooms set pay_hold_by = null, pay_hold_until = null
   where id = (a->>'roomId')::uuid and pay_hold_by = u;
  return '{}'::jsonb;
end $$;

-- Start paying. a = {kind, houseId, roomId, slot, ballotId, keyCode, amount, useSav, method}
create or replace function public.start_checkout(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare
  kind text := a->>'kind';
  u uuid; c app.settings := app.cfg(); t timestamptz := app.now();
  h app.houses; r app.rooms; b app.ballots; k app.keys;
  amount int; sv int := 0; slot timestamptz; meta jsonb := '{}'::jsonb;
  pid uuid; ref text; method text := coalesce(nullif(a->>'method', ''), 'Card');
begin
  if kind not in ('inspection', 'rent', 'renewal', 'deposit') then perform app.fail('Unknown payment.'); end if;
  u := app.need_student();

  if kind = 'inspection' then
    select * into h from app.houses where id = (a->>'houseId')::uuid;
    if h.id is null or not app.house_live(h) then perform app.fail('This house is not taking visits right now.'); end if;
    if exists (select 1 from app.inspections where house_id = h.id and student_id = u and status = 'booked') then
      perform app.fail('You already have a visit booked at this house.');
    end if;
    slot := app.ts((a->>'slot')::bigint);
    if slot is null or slot <= t or slot > t + interval '15 days'
       or not (to_char(app.wat(slot), 'HH24:MI') = any (h.times))
       or not (extract(dow from app.wat(slot))::int = any (h.days)) then
      perform app.fail('That time is no longer available. Pick another slot.');
    end if;
    amount := c.insp_fee;
    meta := jsonb_build_object('slot', app.ms(slot));

  elsif kind = 'rent' then
    select * into r from app.rooms where id = (a->>'roomId')::uuid and not archived for update;
    if r.id is null then perform app.fail('This room is no longer listed.'); end if;
    select * into h from app.houses where id = r.house_id;
    if not app.insp_done(u, h.id) then perform app.fail('Book and complete an inspection first. Rent unlocks after the visit.'); end if;
    if nullif(a->>'ballotId', '') is not null then
      select * into b from app.ballots where id = (a->>'ballotId')::uuid and room_id = r.id;
      if b.id is null or b.status <> 'drawn' or b.draw_order[b.offer_idx + 1] is distinct from u then
        perform app.fail('This ballot offer is no longer yours. You have not been charged.');
      end if;
      meta := jsonb_build_object('ballot_id', b.id);
    else
      if not app.house_live(h) then perform app.fail('This house is not taking bookings right now.'); end if;
      if app.room_state(r) = 'open' then
        update app.rooms set pay_hold_by = null, pay_hold_until = null where pay_hold_by = u and id <> r.id;
        update app.rooms set pay_hold_by = u, pay_hold_until = t + make_interval(mins => c.hold_minutes) where id = r.id;
      elsif not (app.room_state(r) = 'pending' and r.pay_hold_by = u) then
        perform app.fail('Someone else just secured this room. You have not been charged.');
      end if;
    end if;
    amount := r.price;

  elsif kind = 'renewal' then
    select * into k from app.keys where code = a->>'keyCode' and student_id = u and status = 'active';
    if k.id is null then perform app.fail('This key is no longer active.'); end if;
    if exists (select 1 from app.ballots where key_id = k.id and status in ('drawn', 'filled')) then
      perform app.fail('Renewal closed when the ballot for this room was drawn.');
    end if;
    select * into r from app.rooms where id = k.room_id;
    select * into h from app.houses where id = k.house_id;
    amount := r.price;
    meta := jsonb_build_object('key_id', k.id);

  else -- deposit into rent savings
    amount := floor(coalesce((a->>'amount')::numeric, 0));
    if amount < 100 then perform app.fail('Enter at least ₦100.'); end if;
  end if;

  if kind in ('rent', 'renewal') and coalesce((a->>'useSav')::boolean, false) then
    sv := least(app.savings_balance(u), amount);
  end if;

  ref := app.gen_ref();
  insert into app.payments(kind, student_id, house_id, room_id, amount, savings_used, method, ref, status, provider, meta, created_at)
  values (kind, u, h.id, r.id, amount, sv, method, ref, 'pending',
          case when c.payment_mode = 'paystack' and amount > sv then 'paystack' else 'simulated' end, meta, t)
  returning id into pid;

  -- Fully covered by savings: nothing to charge.
  if amount - sv <= 0 then
    update app.payments set method = 'Rent savings' where id = pid;
    return jsonb_build_object('ref', ref, 'amount', amount, 'charge', 0, 'mode', 'none',
                              'result', app.finalize_payment(pid, null));
  end if;
  return jsonb_build_object('ref', ref, 'amount', amount, 'charge', amount - sv, 'mode', c.payment_mode);
end $$;

-- Apply a successful payment. Safe to call twice: the second call returns the first result.
create or replace function app.finalize_payment(pid uuid, provider_txn text) returns jsonb
language plpgsql as $$
declare
  p app.payments; c app.settings := app.cfg(); t timestamptz := app.now();
  h app.houses; r app.rooms; b app.ballots; k app.keys; ins_id uuid; th uuid; kid uuid;
  sname text; start_at timestamptz; res jsonb; ok boolean;
begin
  select * into p from app.payments where id = pid for update;
  if p.id is null then perform app.fail('Payment not found.'); end if;
  if p.status <> 'pending' then return coalesce(p.meta->'result', jsonb_build_object('ref', p.ref)); end if;
  select * into h from app.houses where id = p.house_id;
  sname := app.pname(p.student_id);

  if p.savings_used > 0 and app.savings_balance(p.student_id) < p.savings_used then
    res := jsonb_build_object('error', 'Your savings balance changed while you were paying. Any money taken will be refunded.');
    update app.payments set status = 'failed', provider_txn = finalize_payment.provider_txn,
      meta = meta || jsonb_build_object('result', res, 'refund_needed', p.amount > p.savings_used and p.provider <> 'simulated')
     where id = p.id;
    return res;
  end if;

  if p.kind = 'inspection' then
    update app.payments set status = 'paid', paid_at = t, provider_txn = finalize_payment.provider_txn where id = p.id;
    insert into app.inspections(house_id, student_id, slot, fee, payment_id, status, code, created_at)
    values (h.id, p.student_id, app.ts((p.meta->>'slot')::bigint), p.amount, p.id, 'booked', app.gen_digits(4), t)
    returning id into ins_id;
    perform app.note(p.student_id, format('Visit booked at %s for %s. Reminders go out 24 hours and 1 hour before.',
      h.title, app.fslot(app.ts((p.meta->>'slot')::bigint))));
    perform app.note(h.agent_id, format('%s booked a visit at %s for %s. %s of the fee is yours.',
      sname, h.title, app.fslot(app.ts((p.meta->>'slot')::bigint)), app.naira(app.net(p.amount))));
    insert into app.threads(house_id, student_id, agent_id, created_at) values (h.id, p.student_id, h.agent_id, t)
    on conflict (house_id, student_id) do nothing;
    select id into th from app.threads where house_id = h.id and student_id = p.student_id;
    insert into app.messages(thread_id, sender, body, created_at)
    values (th, 'a', format('Visit confirmed for %s at %s. Call me on %s when you get to the gate.',
      app.fslot(app.ts((p.meta->>'slot')::bigint)), h.address,
      coalesce((select phone from app.profiles where id = h.agent_id), 'the number on my profile')), t);
    res := jsonb_build_object('ref', p.ref, 'inspectionId', ins_id);

  elsif p.kind = 'rent' then
    select * into r from app.rooms where id = p.room_id for update;
    if p.meta ? 'ballot_id' then
      select * into b from app.ballots where id = (p.meta->>'ballot_id')::uuid for update;
      ok := b.status = 'drawn' and b.draw_order[b.offer_idx + 1] = p.student_id;
      if not ok then res := jsonb_build_object('error', 'This ballot offer is no longer yours. Any money taken will be refunded.'); end if;
    else
      ok := app.room_state(r) = 'open' or (app.room_state(r) = 'pending' and r.pay_hold_by = p.student_id);
      if not ok then res := jsonb_build_object('error', 'Someone else just secured this room. Any money taken will be refunded.'); end if;
    end if;
    if not ok then
      update app.payments set status = 'failed', provider_txn = finalize_payment.provider_txn,
        meta = meta || jsonb_build_object('result', res, 'refund_needed', p.amount > p.savings_used and p.provider <> 'simulated')
       where id = p.id;
      if p.provider <> 'simulated' then
        perform app.note(null, format('Payment %s for %s could not be applied (room no longer free). Refund %s to %s.',
          p.ref, h.title, app.naira(p.amount - p.savings_used), sname));
      end if;
      return res;
    end if;
    start_at := case when b.id is not null then app.ballot_start(b) else t end;
    update app.payments set status = 'held', paid_at = t, provider_txn = finalize_payment.provider_txn where id = p.id;
    if p.savings_used > 0 then
      insert into app.savings_txns(student_id, type, amt, note, payment_id, created_at)
      values (p.student_id, 'applied', p.savings_used, 'Rent · ' || h.title, p.id, t);
    end if;
    insert into app.keys(code, payment_id, house_id, room_id, student_id, start_at, end_at, created_at)
    values (app.gen_key(), p.id, h.id, r.id, p.student_id, start_at, start_at + make_interval(days => c.term_days), t)
    returning * into k;
    update app.rooms set pay_hold_by = null, pay_hold_until = null where id = r.id and pay_hold_by = p.student_id;
    if b.id is not null then
      update app.ballots set status = 'filled', winner_key = k.id where id = b.id;
      update app.rooms set hold_ballot = null where id = r.id;
      perform app.note(e.student_id, format('The ballot for %s has been filled.', h.title))
        from app.ballot_entries e where e.ballot_id = b.id and e.student_id <> p.student_id;
    end if;
    perform app.note(p.student_id, format('Payment confirmed. Your key for %s is ready.', h.title));
    perform app.note(h.agent_id, format('%s paid %s for %s at %s. {{APP_NAME}} holds it until move-in.',
      sname, app.naira(p.amount), r.name, h.title));
    perform app.note(null, format('%s rent received for %s and held in escrow.', app.naira(p.amount), h.title));
    res := jsonb_build_object('ref', p.ref, 'key', k.code);

  elsif p.kind = 'renewal' then
    select * into k from app.keys where id = (p.meta->>'key_id')::uuid for update;
    select * into r from app.rooms where id = k.room_id;
    if k.status <> 'active' or exists (select 1 from app.ballots where key_id = k.id and status in ('drawn', 'filled')) then
      res := jsonb_build_object('error', 'Renewal closed for this room. Any money taken will be refunded.');
      update app.payments set status = 'failed', meta = meta || jsonb_build_object('result', res,
        'refund_needed', p.amount > p.savings_used and p.provider <> 'simulated') where id = p.id;
      return res;
    end if;
    update app.payments set status = 'released', paid_at = t, released_at = t, provider_txn = finalize_payment.provider_txn where id = p.id;
    if p.savings_used > 0 then
      insert into app.savings_txns(student_id, type, amt, note, payment_id, created_at)
      values (p.student_id, 'applied', p.savings_used, 'Renewal · ' || h.title, p.id, t);
    end if;
    perform app.extend_key(k.id);
    select * into k from app.keys where id = k.id;
    perform app.note(p.student_id, format('Key for %s renewed until %s.', h.title, app.fdate(k.end_at)));
    perform app.note(h.agent_id, format('%s renewed %s at %s. %s paid out after commission.',
      sname, r.name, h.title, app.naira(app.net(p.amount))));
    res := jsonb_build_object('ref', p.ref);

  else -- deposit
    update app.payments set status = 'paid', paid_at = t, provider_txn = finalize_payment.provider_txn where id = p.id;
    insert into app.savings_txns(student_id, type, amt, note, payment_id, created_at)
    values (p.student_id, 'deposit', p.amount, coalesce(nullif(p.method, ''), 'Deposit'), p.id, t);
    res := jsonb_build_object('ref', p.ref);
  end if;

  update app.payments set meta = meta || jsonb_build_object('result', res) where id = p.id;
  perform app.ping(p.student_id);
  if h.id is not null then perform app.ping(h.agent_id); end if;
  return res;
end $$;

-- Renewal: another term on the same key; a running ballot for the room is cancelled.
create or replace function app.extend_key(kid uuid) returns void
language plpgsql as $$
declare k app.keys; b app.ballots; h app.houses; r app.rooms;
begin
  update app.keys set end_at = end_at + make_interval(days => (app.cfg()).term_days), shown = '{}',
         renewals = renewals + 1, not_renewing = false
   where id = kid returning * into k;
  select * into b from app.ballots where key_id = kid and status = 'open';
  if b.id is not null then
    select * into h from app.houses where id = b.house_id;
    select * into r from app.rooms where id = b.room_id;
    update app.ballots set status = 'cancelled' where id = b.id;
    perform app.note(e.student_id, format('The tenant at %s renewed, so the ballot for %s was cancelled.', h.title, r.name))
      from app.ballot_entries e where e.ballot_id = b.id;
    perform app.note(h.agent_id, format('%s renewed, so the ballot for %s at %s was cancelled.', app.pname(k.student_id), r.name, h.title));
  end if;
end $$;

-- Demo / test mode: pretend the provider confirmed the payment.
create or replace function public.simulate_pay(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); p app.payments;
begin
  select * into p from app.payments where ref = a->>'ref' and student_id = u;
  if p.id is null then perform app.fail('Payment not found.'); end if;
  if p.provider <> 'simulated' then perform app.fail('This payment goes through Paystack.'); end if;
  if (a->>'fail')::boolean then
    update app.payments set status = 'failed' where id = p.id and status = 'pending';
    return jsonb_build_object('error', 'The payment did not go through. You have not been charged.');
  end if;
  return app.finalize_payment(p.id, 'SIM-' || p.ref);
end $$;

-- Polling while Paystack checkout is open.
create or replace function public.payment_status(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); p app.payments;
begin
  select * into p from app.payments where ref = a->>'ref' and student_id = u;
  if p.id is null then perform app.fail('Payment not found.'); end if;
  return jsonb_build_object('status', p.status, 'result', p.meta->'result');
end $$;

create or replace function public.cancel_checkout(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login();
begin
  update app.payments set status = 'expired' where ref = a->>'ref' and student_id = u and status = 'pending';
  return '{}'::jsonb;
end $$;

-- Paystack: details the edge function needs to start a transaction (service role only).
create or replace function public.payment_for_provider(p_ref text) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare p app.payments; e text;
begin
  select * into p from app.payments where ref = p_ref;
  if p.id is null then return null; end if;
  select email into e from app.profiles where id = p.student_id;
  return jsonb_build_object('ref', p.ref, 'studentId', p.student_id, 'email', e, 'status', p.status,
    'kind', p.kind, 'chargeKobo', (p.amount - p.savings_used)::bigint * 100);
end $$;

-- Paystack confirmed a charge (webhook or verify). Service role only.
create or replace function public.payment_confirmed(p_ref text, p_amount_kobo bigint, p_txn text, p_channel text)
returns jsonb language plpgsql security definer set search_path = app, public as $$
declare p app.payments;
begin
  select * into p from app.payments where ref = p_ref for update;
  if p.id is null then return jsonb_build_object('error', 'unknown reference'); end if;
  if p.status <> 'pending' then return coalesce(p.meta->'result', jsonb_build_object('ref', p.ref)); end if;
  if p_amount_kobo <> (p.amount - p.savings_used)::bigint * 100 then
    update app.payments set status = 'failed', provider_txn = p_txn,
      meta = meta || jsonb_build_object('refund_needed', true, 'paid_kobo', p_amount_kobo) where id = p.id;
    perform app.note(null, format('Payment %s amount mismatch (got %s kobo). Check and refund.', p.ref, p_amount_kobo));
    return jsonb_build_object('error', 'amount mismatch');
  end if;
  if coalesce(p_channel, '') <> '' then
    update app.payments set method = initcap(replace(p_channel, '_', ' ')) where id = p.id;
  end if;
  return app.finalize_payment(p.id, p_txn);
end $$;
