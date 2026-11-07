-- Admin actions: verification, moderation, money, complaints, support.

create or replace function public.approve_agent(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); aid uuid := (a->>'id')::uuid;
begin
  update app.agents set status = 'verified', verified_at = app.now(), resp = 'new agent', reject_reason = null where id = aid;
  if not found then perform app.fail('Agent not found.'); end if;
  perform app.update_trust(aid);
  perform app.note(aid, 'Your account is verified.');
  return jsonb_build_object('name', app.pname(aid));
end $$;

create or replace function public.reject_agent(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); aid uuid := (a->>'id')::uuid;
  why text := coalesce(nullif(a->>'reason', ''), 'Documents unclear') || coalesce('. ' || nullif(trim(a->>'note'), ''), '');
begin
  update app.agents set status = 'rejected', reject_reason = why where id = aid;
  if not found then perform app.fail('Agent not found.'); end if;
  perform app.note(aid, format('Your verification needs changes: %s. Upload new documents from your application screen.', why));
  return jsonb_build_object('name', app.pname(aid));
end $$;

create or replace function public.approve_listing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); h app.houses; st text;
begin
  update app.houses set mod = 'live', created_at = app.now() where id = (a->>'id')::uuid and mod in ('pending', 'rejected') returning * into h;
  if h.id is null then perform app.fail('Listing not found.'); end if;
  select status into st from app.agents where id = h.agent_id;
  perform app.note(h.agent_id, format('%s is live.', h.title));
  return jsonb_build_object('title', h.title, 'agentVerified', st = 'verified');
end $$;

create or replace function public.reject_listing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); h app.houses;
begin
  update app.houses set mod = 'rejected' where id = (a->>'id')::uuid and mod = 'pending' returning * into h;
  if h.id is null then perform app.fail('Listing not found.'); end if;
  perform app.note(h.agent_id, format('%s was not approved.%s', h.title, coalesce(' ' || nullif(trim(a->>'note'), ''), '')));
  return '{}'::jsonb;
end $$;

-- Cancel booked visits matching a house or agent and refund them.
create or replace function app.cancel_visits_for(hid uuid, aid uuid, why text) returns int
language plpgsql as $$
declare i record; n int := 0;
begin
  for i in select i2.* from app.inspections i2 join app.houses h on h.id = i2.house_id
            where i2.status = 'booked' and (h.id = hid or h.agent_id = aid) for update of i2 loop
    update app.inspections set status = 'cancelled', by_admin = true, refunded = true where id = i.id;
    perform app.refund_payment_row(i.payment_id);
    perform app.note(i.student_id, format('%s, so your visit on %s was cancelled and your %s refunded.', why, app.fslot(i.slot), app.naira(i.fee)));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.take_down_listing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); h app.houses; nv int; why text := coalesce(nullif(a->>'reason', ''), 'Something else');
  nt text := nullif(trim(coalesce(a->>'note', '')), ''); b record;
begin
  update app.houses set mod = 'removed', removed_reason = why, removed_note = nt, removed_at = app.now()
   where id = (a->>'id')::uuid returning * into h;
  if h.id is null then perform app.fail('Listing not found.'); end if;
  nv := app.cancel_visits_for(h.id, null, format('{{APP_NAME}} took down %s', h.title));
  for b in select * from app.ballots where house_id = h.id and status = 'open' loop
    update app.ballots set status = 'cancelled' where id = b.id;
    perform app.note(e.student_id, format('The ballot at %s was cancelled because the listing was taken down.', h.title))
      from app.ballot_entries e where e.ballot_id = b.id;
  end loop;
  perform app.note(h.agent_id, format('{{APP_NAME}} took down %s: %s.%s Current tenants are not affected. Contact support to appeal.',
    h.title, why, coalesce(' ' || nt, '')));
  return jsonb_build_object('visits', nv, 'title', h.title);
end $$;

create or replace function public.restore_listing(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); h app.houses;
begin
  update app.houses set mod = 'live', removed_reason = null, removed_note = null where id = (a->>'id')::uuid and mod = 'removed' returning * into h;
  if h.id is null then perform app.fail('Listing not found.'); end if;
  perform app.note(h.agent_id, format('%s is live again.', h.title));
  return jsonb_build_object('title', h.title);
end $$;

-- a = {k:'agent'|'student', id, reason, note}
create or replace function public.suspend_user(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); id_ uuid := (a->>'id')::uuid; nv int := 0;
  why text := coalesce(nullif(a->>'reason', ''), 'Something else') || coalesce('. ' || nullif(trim(a->>'note'), ''), '');
begin
  if a->>'k' = 'agent' then
    update app.agents set status = 'suspended', suspend_reason = why where id = id_;
    if not found then perform app.fail('Agent not found.'); end if;
    nv := app.cancel_visits_for(null, id_, format('%s is no longer taking visits', app.pname(id_)));
    perform app.note(id_, format('Your {{APP_NAME}} account is suspended: %s. Your houses are hidden from students. Contact support to appeal.', why));
  else
    update app.profiles set suspended = true, suspend_reason = why where id = id_ and role = 'student';
    if not found then perform app.fail('Student not found.'); end if;
    delete from app.ballot_entries e using app.ballots b where e.ballot_id = b.id and b.status = 'open' and e.student_id = id_;
    update app.rooms set pay_hold_by = null, pay_hold_until = null where pay_hold_by = id_;
    perform app.note(id_, format('Your {{APP_NAME}} account is suspended: %s. You can see your key and payments, but you can''t book, pay or message. Contact support to appeal.', why));
  end if;
  return jsonb_build_object('name', app.pname(id_), 'visits', nv);
end $$;

create or replace function public.restore_user(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); id_ uuid := (a->>'id')::uuid;
begin
  if a->>'k' = 'agent' then
    update app.agents set status = 'verified', suspend_reason = null where id = id_ and status = 'suspended';
    if not found then perform app.fail('Only suspended agents can be restored. Approve new agents from their application.'); end if;
    perform app.note(id_, 'Your {{APP_NAME}} account is active again. Your houses are back in search.');
  else
    update app.profiles set suspended = false, suspend_reason = null where id = id_;
    perform app.note(id_, 'Your {{APP_NAME}} account is active again.');
  end if;
  return jsonb_build_object('name', app.pname(id_));
end $$;

create or replace function public.review_report(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); st text;
begin
  update app.threads set report_status = case when report_status = 'reviewed' then 'open' else 'reviewed' end
   where id = (a->>'id')::uuid returning report_status into st;
  return jsonb_build_object('status', st);
end $$;

-- Release held money to the agent now.
create or replace function public.release_payment(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); p app.payments; kid uuid;
begin
  select * into p from app.payments where id = (a->>'id')::uuid for update;
  if p.id is null then perform app.fail('Payment not found.'); end if;
  select id into kid from app.keys where payment_id = p.id;
  if kid is not null then perform app.release_key(kid, 'Released by admin');
  elsif p.status in ('held', 'paid') then update app.payments set status = 'released', released_at = app.now() where id = p.id;
  end if;
  perform app.ping(p.student_id);
  return '{}'::jsonb;
end $$;

create or replace function public.refund_payment(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); p app.payments; h app.houses; k app.keys;
begin
  select * into p from app.payments where id = (a->>'id')::uuid for update;
  if p.id is null then perform app.fail('Payment not found.'); end if;
  if p.status = 'refunded' then perform app.fail('Already refunded.'); end if;
  select * into h from app.houses where id = p.house_id;
  perform app.refund_payment_row(p.id);
  if p.kind = 'inspection' then
    update app.inspections set status = 'cancelled', by_admin = true, refunded = true where payment_id = p.id and status = 'booked';
  else
    update app.keys set status = 'cancelled' where payment_id = p.id and status = 'active' returning * into k;
    if k.id is not null then
      update app.ballots set status = 'cancelled' where key_id = k.id and status = 'open';
    end if;
  end if;
  perform app.note(p.student_id, format('%s refunded for %s.', app.naira(p.amount), coalesce(h.title, 'your payment')));
  if h.id is not null then
    perform app.note(h.agent_id, format('Admin refunded %s''s payment for %s.', app.pname(p.student_id), h.title));
  end if;
  return '{}'::jsonb;
end $$;

-- Admin marks that the agent's share was sent to their bank (manual payouts).
create or replace function public.mark_paid_out(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); p app.payments; h app.houses;
begin
  update app.payments set paid_out_at = app.now() where id = (a->>'id')::uuid and status in ('released', 'paid') and paid_out_at is null
  returning * into p;
  if p.id is null then perform app.fail('Only released payments can be marked as paid out.'); end if;
  select * into h from app.houses where id = p.house_id;
  perform app.note(h.agent_id, format('%s for %s was sent to your payout account.', app.naira(app.net(p.amount)), h.title));
  return '{}'::jsonb;
end $$;

create or replace function public.set_complaint_status(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); cp app.complaints; st text := a->>'status';
begin
  if st not in ('open', 'review', 'resolved') then perform app.fail('Unknown status.'); end if;
  update app.complaints set status = st where id = (a->>'id')::uuid returning * into cp;
  if cp.author_id is not null then perform app.ping(cp.author_id); end if;
  if cp.agent_id is not null then perform app.ping(cp.agent_id); end if;
  -- a resolved dispute counts against the agent's trust score
  if st = 'resolved' and cp.kind = 'dispute' and cp.agent_id is not null and coalesce((a->>'upheld')::boolean, false) then
    update app.agents set disputes = disputes + 1 where id = cp.agent_id;
    perform app.update_trust(cp.agent_id);
  end if;
  return '{}'::jsonb;
end $$;

create or replace function public.toggle_complaint_removed(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); r boolean;
begin
  update app.complaints set removed = not removed where id = (a->>'id')::uuid returning removed into r;
  return jsonb_build_object('removed', r);
end $$;

create or replace function public.toggle_support_done(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); st text;
begin
  update app.support set status = case when status = 'answered' then 'new' else 'answered' end
   where id = (a->>'id')::uuid returning status into st;
  return jsonb_build_object('status', st);
end $$;

-- Draw a ballot now / pass a ballot offer to the next person (admin tools).
create or replace function public.run_draw(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare b app.ballots; n int := 0;
begin
  if not (app.cfg()).demo then perform app.need_admin(); end if;  -- demo panel lets anyone run draws
  for b in select * from app.ballots where status = 'open' and (nullif(a->>'id', '') is null or id = (a->>'id')::uuid) loop
    perform app.draw_ballot(b.id); n := n + 1;
  end loop;
  return jsonb_build_object('drawn', n);
end $$;

create or replace function public.pass_offer(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_admin(); b app.ballots;
begin
  select * into b from app.ballots where id = (a->>'id')::uuid and status = 'drawn';
  if b.id is null then perform app.fail('This ballot is not waiting on a payment.'); end if;
  perform app.advance_ballot(b.id);
  select * into b from app.ballots where id = b.id;
  return jsonb_build_object('status', b.status, 'to', case when b.status = 'drawn' then app.pname(b.draw_order[b.offer_idx + 1]) end);
end $$;
