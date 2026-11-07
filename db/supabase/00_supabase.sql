-- Supabase-only setup: logins, file storage, live refresh, the scheduler and permissions.

-- New login -> profile. The sign-up form passes role, name, phone, dept, school (and biz for agents).
-- Only 'student' and 'agent' can be chosen; admins are promoted by hand with app.make_admin().
create or replace function app.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = app, public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
        r text := case when m->>'role' = 'agent' then 'agent' else 'student' end;
begin
  insert into app.profiles(id, role, name, email, phone, dept, school, created_at)
  values (new.id, r, coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)), new.email,
          nullif(trim(m->>'phone'), ''), nullif(trim(m->>'dept'), ''), coalesce(nullif(m->>'school', ''), 'oau'), now())
  on conflict (id) do nothing;
  if r = 'agent' then
    insert into app.agents(id, biz, btype, rel) values (new.id, coalesce(trim(m->>'biz'), ''), m->>'btype', m->>'rel')
    on conflict (id) do nothing;
    perform app.note(null, format('New agent sign-up: %s. Documents to follow.', coalesce(m->>'name', new.email)));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.on_auth_user_created();

create or replace function app.on_auth_user_email() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.email is distinct from old.email then update app.profiles set email = new.email where id = new.id; end if;
  return new;
end $$;

drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function app.on_auth_user_email();

-- Deleting an account also removes the login (the anonymised profile and payments stay).
create or replace function app.delete_login(u uuid) returns void
language sql security definer as $$ delete from auth.users where id = u $$;

-- Run once in the SQL editor to make yourself an admin:  select app.make_admin('you@example.com');
create or replace function app.make_admin(p_email text) returns text
language plpgsql security definer set search_path = app, public as $$
declare u uuid; n int;
begin
  select count(*) into n from auth.users where lower(email) = lower(p_email);
  if n = 0 then return 'No account with that email. Sign up in the app first.'; end if;
  if n > 1 then return 'More than one login uses that email. Check auth.users first.'; end if;
  select id into u from auth.users where lower(email) = lower(p_email);
  if not exists (select 1 from app.profiles where id = u) then return 'That login has no profile yet. Open the app once, then try again.'; end if;
  delete from app.agents where id = u and not exists (select 1 from app.houses where agent_id = u);
  update app.profiles set role = 'admin' where id = u;
  return 'Done. Log out and back in.';
end $$;

-- Used by the paystack-resolve edge function (service role only).
create or replace function public.user_role(p_user uuid) returns text
language sql stable security definer set search_path = app, public as $$ select app.role_of(p_user) $$;

-- Used by storage policies (they run as the signed-in user, who can't read app.*).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from app.profiles where id = auth.uid() and role = 'admin' and not deleted)
$$;

-- File storage.
--   media    public: listing photos, profile photos. Each person uploads into a folder named after their id.
--   private  agent verification documents. Readable by the owner and admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private', 'private', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "media upload own folder" on storage.objects;
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media change own files" on storage.objects;
create policy "media change own files" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media delete own files" on storage.objects;
create policy "media delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "private upload own folder" on storage.objects;
create policy "private upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "private read own or admin" on storage.objects;
create policy "private read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'private' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Live refresh: the app subscribes to its own row in public.pings.
grant select on public.pings to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.pings;
exception when duplicate_object then null; when undefined_object then raise notice 'Realtime publication not found; live refresh falls back to polling.';
end $$;

-- Permissions: the client only gets the API functions. Tables in "app" stay closed.
revoke all on schema app from public, anon, authenticated;
revoke execute on function public.payment_for_provider(text) from public, anon, authenticated;
revoke execute on function public.payment_confirmed(text, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.set_payout_verified(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.user_role(uuid) from public, anon, authenticated;
grant execute on function public.user_role(uuid) to service_role;
grant execute on function public.payment_for_provider(text) to service_role;
grant execute on function public.payment_confirmed(text, bigint, text, text) to service_role;
grant execute on function public.set_payout_verified(uuid, text, text, text) to service_role;

-- Scheduler: run the time-based rules every minute (needs the pg_cron extension, on by default in new projects).
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'app-jobs';
  perform cron.schedule('app-jobs', '* * * * *', 'select app.run_jobs()');
exception when others then
  raise notice 'pg_cron is not available (%). Turn it on under Database > Extensions, then run: select cron.schedule(''app-jobs'', ''* * * * *'', ''select app.run_jobs()'');', sqlerrm;
end $$;
