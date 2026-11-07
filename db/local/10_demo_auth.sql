-- Demo mode only: a small stand-in for real logins so people can sign up and log in
-- inside the browser. Passwords are hashed by the app before they get here.
-- The sample accounts (Tolu, Kunle, admin) accept any password.

create table if not exists app.demo_logins (
  email   text primary key,
  pw      text not null,
  user_id uuid not null references app.profiles(id) on delete cascade
);

create or replace function public.demo_signup(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare id_ uuid := gen_random_uuid(); r text := case when a->>'role' = 'agent' then 'agent' else 'student' end;
  e text := lower(trim(coalesce(a->>'email', '')));
begin
  if e = '' or coalesce(a->>'pw', '') = '' then perform app.fail('Enter your email address and a password.'); end if;
  if exists (select 1 from app.demo_logins where email = e) or exists (select 1 from app.profiles where lower(email) = e and not deleted) then
    perform app.fail('There is already an account with this email. Log in instead.');
  end if;
  insert into app.profiles(id, role, name, email, phone, dept, school, created_at)
  values (id_, r, trim(a->>'name'), e, nullif(trim(a->>'phone'), ''), nullif(trim(a->>'dept'), ''), coalesce(nullif(a->>'school', ''), 'oau'), app.now());
  if r = 'agent' then
    insert into app.agents(id, biz, btype, rel, created_at) values (id_, coalesce(trim(a->>'biz'), ''), a->>'btype', a->>'rel', app.now());
  end if;
  insert into app.demo_logins(email, pw, user_id) values (e, a->>'pw', id_);
  return jsonb_build_object('id', id_, 'role', r);
end $$;

create or replace function public.demo_login(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare idf text := lower(trim(coalesce(a->>'id', ''))); p app.profiles; l app.demo_logins;
  digits text := regexp_replace(idf, '\D', '', 'g');
begin
  select * into p from app.profiles
   where not deleted and (lower(email) = idf or (length(digits) >= 10 and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = digits))
   order by created_at limit 1;
  if p.id is null then perform app.fail('No account with that email or phone number.'); end if;
  if p.id in (app.sid('s1'), app.sid('a1'), app.sid('admin'), app.sid('a3')) then
    return jsonb_build_object('id', p.id, 'role', p.role);
  end if;
  select * into l from app.demo_logins where user_id = p.id;
  if l.pw is distinct from a->>'pw' then perform app.fail('That password is not right.'); end if;
  return jsonb_build_object('id', p.id, 'role', p.role);
end $$;

create or replace function public.demo_set_password(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare idf text := lower(trim(coalesce(a->>'id', ''))); p app.profiles;
begin
  select * into p from app.profiles where not deleted and lower(email) = idf;
  if p.id is null then perform app.fail('No account with that email.'); end if;
  insert into app.demo_logins(email, pw, user_id) values (idf, a->>'pw', p.id)
  on conflict (email) do update set pw = excluded.pw;
  return '{}'::jsonb;
end $$;

create or replace function public.demo_people(a jsonb) returns jsonb
language sql security definer set search_path = app, public as $$
  select jsonb_build_object('student', app.sid('s1'), 'agent', app.sid('a1'), 'admin', app.sid('admin'), 'pendingAgent', app.sid('a3'))
$$;
