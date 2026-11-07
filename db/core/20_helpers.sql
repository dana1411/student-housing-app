-- Shared helpers for the API functions.

-- Tell a user's open app to refresh.
create or replace function app.ping(u uuid) returns void
language sql as $$
  insert into public.pings(user_id, at) values (u, clock_timestamp())
  on conflict (user_id) do update set at = excluded.at
$$;

create or replace function app.ping_admins() returns void
language sql as $$
  select app.ping(id) from app.profiles where role = 'admin' and not deleted
$$;

-- In-app notification. u = null sends it to the admin inbox.
create or replace function app.note(u uuid, msg text) returns void
language plpgsql as $$
begin
  insert into app.notifications(user_id, body, created_at) values (u, msg, app.now());
  if u is null then perform app.ping_admins(); else perform app.ping(u); end if;
end $$;

create or replace function app.pname(u uuid) returns text
language sql stable as $$ select coalesce((select name from app.profiles where id = u), 'A student') $$;

create or replace function app.first_name(u uuid) returns text
language sql stable as $$ select split_part(app.pname(u), ' ', 1) $$;

-- "Tolu A."
create or replace function app.short_name(u uuid) returns text
language sql stable as $$
  select case when position(' ' in n) > 0
              then split_part(n, ' ', 1) || ' ' || left(split_part(n, ' ', 2), 1) || '.'
              else n end
  from (select app.pname(u) as n) x
$$;

create or replace function app.role_of(u uuid) returns text
language sql stable as $$ select role from app.profiles where id = u and not deleted $$;

-- Guards. Each returns the caller's id or raises a readable error.
create or replace function app.need_login() returns uuid
language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null or app.role_of(u) is null then perform app.fail('Log in first.'); end if;
  return u;
end $$;

create or replace function app.need_student(allow_suspended boolean default false) returns uuid
language plpgsql stable as $$
declare u uuid := app.need_login(); p app.profiles;
begin
  select * into p from app.profiles where id = u;
  if p.role <> 'student' then perform app.fail('Only students can do this.'); end if;
  if p.suspended and not allow_suspended then
    perform app.fail('Your account is suspended. Reason: ' || coalesce(p.suspend_reason, 'not given') || '. Contact support to appeal.');
  end if;
  return u;
end $$;

create or replace function app.need_agent(allow_unverified boolean default false) returns uuid
language plpgsql stable as $$
declare u uuid := app.need_login(); st text;
begin
  if app.role_of(u) <> 'agent' then perform app.fail('Only agents can do this.'); end if;
  select status into st from app.agents where id = u;
  if st = 'suspended' then perform app.fail('Your account is suspended. Contact support to appeal.'); end if;
  if not allow_unverified and st <> 'verified' then perform app.fail('Your account is waiting for verification.'); end if;
  return u;
end $$;

create or replace function app.need_admin() returns uuid
language plpgsql stable as $$
declare u uuid := app.need_login();
begin
  if app.role_of(u) <> 'admin' then perform app.fail('Only admins can do this.'); end if;
  return u;
end $$;

create or replace function app.need_demo() returns void
language plpgsql stable as $$
begin
  if not (app.cfg()).demo then perform app.fail('This is only available in demo mode.'); end if;
end $$;

-- Agent trust score (same formula as the demo).
create or replace function app.update_trust(a uuid) returns void
language sql as $$
  update app.agents set trust = case
    when ratings = 0 and insp_done = 0 then 0
    else greatest(0, least(100, round(40 + rating * 8 + least(insp_done, 50) * 0.2
           - disputes * 5 - cancels * 3 - mismatches * 4 - no_shows * 8)))::int end
  where id = a
$$;

create or replace function app.house_live(h app.houses) returns boolean
language sql stable as $$
  select h.mod = 'live' and not h.deleted and not h.paused
     and exists (select 1 from app.agents a where a.id = h.agent_id and a.status = 'verified')
$$;

create or replace function app.active_count(r uuid) returns int
language sql stable as $$ select count(*)::int from app.keys where room_id = r and status = 'active' $$;

-- paused | taken | reserved | pending | open
create or replace function app.room_state(r app.rooms) returns text
language sql stable as $$
  select case
    when r.paused then 'paused'
    when app.active_count(r.id) >= r.cap then 'taken'
    when r.hold_ballot is not null then 'reserved'
    when r.pay_hold_until is not null and r.pay_hold_until > app.now() then 'pending'
    else 'open' end
$$;

create or replace function app.savings_balance(s uuid) returns int
language sql stable as $$
  select coalesce(sum(case when type = 'deposit' then amt else -amt end), 0)::int
  from app.savings_txns where student_id = s
$$;

create or replace function app.insp_done(s uuid, h uuid) returns boolean
language sql stable as $$
  select exists (select 1 from app.inspections where student_id = s and house_id = h and status = 'completed')
$$;

-- When a key's room becomes free for the next tenant: the key's end, or now if later.
create or replace function app.ballot_start(b app.ballots) returns timestamptz
language sql stable as $$
  select greatest(app.now(), coalesce((select end_at from app.keys where id = b.key_id and status = 'active'), app.now()))
$$;

-- Agent's share after commission.
create or replace function app.net(amount numeric) returns numeric
language sql stable as $$ select amount * (1 - (app.cfg()).commission) $$;
