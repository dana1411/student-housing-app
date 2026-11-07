-- Chat, notifications, support, waitlist, profile and settings.

-- Messages that look like a request to pay outside the app.
create or replace function app.scam(txt text) returns boolean
language sql immutable as $$
  select txt ~* '(account\s*(no|number|details)|acct\s*no|send\s+(it|the\s+money|money)\s+to|pay\s+(?:\w+\s+)?(directly|outside|in\s+cash|cash)|transfer\s+(it\s+)?to\s+(my|me)|\y\d{10}\y)'
$$;

-- Open (or find) the chat between the signed-in student and a house's agent.
create or replace function public.open_thread(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_student(); h app.houses; tid uuid;
begin
  select * into h from app.houses where id = (a->>'houseId')::uuid and not deleted;
  if h.id is null then perform app.fail('House not found.'); end if;
  if not app.house_live(h) and not exists (select 1 from app.threads where house_id = h.id and student_id = u)
     and not exists (select 1 from app.keys where house_id = h.id and student_id = u) then
    perform app.fail('This house is not taking messages right now.');
  end if;
  insert into app.threads(house_id, student_id, agent_id, created_at) values (h.id, u, h.agent_id, app.now())
  on conflict (house_id, student_id) do nothing;
  select id into tid from app.threads where house_id = h.id and student_id = u;
  update app.messages set read = true where thread_id = tid and sender = 'a' and not read;
  return jsonb_build_object('id', tid);
end $$;

create or replace function public.mark_thread_read(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); th app.threads;
begin
  select * into th from app.threads where id = (a->>'id')::uuid;
  if th.student_id = u then update app.messages set read = true where thread_id = th.id and sender = 'a' and not read;
  elsif th.agent_id = u then update app.messages set read = true where thread_id = th.id and sender = 's' and not read;
  end if;
  return '{}'::jsonb;
end $$;

create or replace function public.send_message(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); th app.threads; h app.houses; txt text := trim(coalesce(a->>'text', '')); s text; fl boolean;
begin
  if txt = '' then perform app.fail('Write a message first.'); end if;
  if length(txt) > 2000 then perform app.fail('Keep messages under 2,000 characters.'); end if;
  select * into th from app.threads where id = (a->>'id')::uuid;
  if th.id is null or (th.student_id <> u and th.agent_id <> u) then perform app.fail('Chat not found.'); end if;
  if th.student_id = u then perform app.need_student(); s := 's'; else perform app.need_agent(true); s := 'a'; end if;
  if th.blocked then perform app.fail('This chat is blocked.'); end if;
  fl := app.scam(txt);
  select * into h from app.houses where id = th.house_id;
  insert into app.messages(thread_id, sender, body, flag, created_at) values (th.id, s, txt, fl, clock_timestamp() + (app.now() - now()));
  if s = 's' then
    update app.messages set read = true where thread_id = th.id and sender = 'a' and not read;
    perform app.note(th.agent_id, format('New message from %s about %s.', app.pname(u), h.title));
  else
    update app.messages set read = true where thread_id = th.id and sender = 's' and not read;
    perform app.note(th.student_id, format('%s replied about %s.', app.pname(u), h.title));
  end if;
  if fl then perform app.note(null, format('Chat about %s flagged for a possible off-app payment request.', h.title)); end if;
  return jsonb_build_object('flag', fl);
end $$;

-- Demo only: the sample agent answers the sample student.
create or replace function public.demo_reply(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); th app.threads; h app.houses; lt text := lower(coalesce(a->>'text', '')); r text;
begin
  perform app.need_demo();
  select * into th from app.threads where id = (a->>'id')::uuid and student_id = u;
  if th.id is null or th.blocked then return '{}'::jsonb; end if;
  select * into h from app.houses where id = th.house_id;
  r := case
    when app.scam(a->>'text') then 'Please pay only through {{APP_NAME}}. I can''t accept money outside the app.'
    when lt ~ '(water|light|power|nepa|meter|electric)' then 'Water is steady and light is on a prepaid meter. You can check both during the inspection.'
    when lt ~ '(price|reduce|discount|last price|negotiat)' then 'The price is fixed for this session. You pay it on {{APP_NAME}} after the inspection, and {{APP_NAME}} holds it until you move in.'
    when lt ~ '(inspect|visit|see it|come|when)' then 'Sure. Book any slot on the listing and I will meet you there with the door code.'
    else format('Thanks, %s. The room is still available. Book an inspection on the listing and I will meet you there.', app.first_name(u)) end;
  update app.messages set read = true where thread_id = th.id and sender = 's';
  insert into app.messages(thread_id, sender, body, created_at) values (th.id, 'a', r, clock_timestamp() + (app.now() - now()));
  perform app.note(u, format('%s replied about %s.', app.pname(th.agent_id), h.title));
  return '{}'::jsonb;
end $$;

create or replace function public.report_thread(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); th app.threads; h app.houses; by_ text; blk boolean := coalesce((a->>'block')::boolean, false);
begin
  select * into th from app.threads where id = (a->>'id')::uuid;
  if th.id is null or (th.student_id <> u and th.agent_id <> u) then perform app.fail('Chat not found.'); end if;
  by_ := case when th.agent_id = u then 'agent' else 'student' end;
  update app.threads set reported = true, report_reason = coalesce(nullif(a->>'reason', ''), 'Something else'),
    reported_by = by_, reported_at = app.now(), report_status = 'open',
    blocked = blocked or blk, blocked_by = case when blk then by_ else blocked_by end
   where id = th.id;
  select * into h from app.houses where id = th.house_id;
  perform app.note(null, format('A chat about %s was reported.', h.title));
  perform app.ping(case when by_ = 'agent' then th.student_id else th.agent_id end);
  return '{}'::jsonb;
end $$;

create or replace function public.mark_notes_read(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login();
begin
  update app.notifications set read = true where not read and (user_id = u or (user_id is null and app.role_of(u) = 'admin'));
  return '{}'::jsonb;
end $$;

-- Contact form (anyone, signed in or not).
create or replace function public.contact_support(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare nm text := trim(coalesce(a->>'name', '')); ct text := trim(coalesce(a->>'contact', '')); msg text := trim(coalesce(a->>'msg', ''));
  topic text := coalesce(nullif(a->>'topic', ''), 'Something else');
begin
  if nm = '' then perform app.fail('Add your name.'); end if;
  if not (ct ~ '^\S+@\S+\.\S+$' or ct ~ '^\+?\d[\d\s]{9,16}$') then perform app.fail('Add an email address or phone number so we can reply.'); end if;
  if length(msg) < 10 then perform app.fail('Tell us a little more in your message.'); end if;
  if length(msg) > 4000 then perform app.fail('Keep your message under 4,000 characters.'); end if;
  if (select count(*) from app.support where contact = ct and created_at > now() - interval '1 hour') >= 5 then
    perform app.fail('You have sent several messages in the last hour. We will reply soon.');
  end if;
  insert into app.support(user_id, name, contact, who, topic, msg, created_at)
  values (auth.uid(), nm, ct, coalesce(nullif(a->>'who', ''), 'Student'), topic, msg, app.now());
  perform app.note(null, format('New support message from %s: %s.', nm, topic));
  return '{}'::jsonb;
end $$;

create or replace function public.join_waitlist(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare ct text := trim(coalesce(a->>'contact', '')); sc text := coalesce(a->>'school', '');
begin
  if not (ct ~ '^\S+@\S+\.\S+$' or ct ~ '^\+?\d[\d\s]{9,16}$') then perform app.fail('Enter an email address or a phone number like 0803 123 4567.'); end if;
  if sc = '' then perform app.fail('Pick a school.'); end if;
  if not exists (select 1 from app.waitlist where school = sc and contact = ct) then
    insert into app.waitlist(school, contact, who, created_at) values (sc, ct, coalesce(nullif(a->>'who', ''), 'student'), app.now());
    perform app.note(null, format('New %s on the %s waitlist.', coalesce(nullif(a->>'who', ''), 'student'), upper(sc)));
  end if;
  return '{}'::jsonb;
end $$;

-- Profile. a = {email, dept, bio, photo} (only the fields sent are changed)
create or replace function public.save_profile(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); e text := trim(coalesce(a->>'email', ''));
begin
  if a ? 'email' and lower(e) is distinct from lower((select email from app.profiles where id = u)) then
    perform app.fail('Your email is your login. Contact support to change it.');
  end if;
  update app.profiles set
    dept = case when a ? 'dept' and trim(a->>'dept') <> '' then trim(a->>'dept') else dept end,
    photo = case when a ? 'photo' then nullif(a->>'photo', '') else photo end,
    name = case when a ? 'name' and trim(a->>'name') <> '' then trim(a->>'name') else name end
   where id = u;
  if a ? 'bio' and app.role_of(u) = 'agent' then update app.agents set bio = trim(a->>'bio') where id = u; end if;
  return '{}'::jsonb;
end $$;

create or replace function public.save_prefs(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login();
begin
  update app.profiles set prefs = coalesce(a->'prefs', '{}'::jsonb) where id = u;
  return '{}'::jsonb;
end $$;

-- Phone number is confirmed by the app (demo code, or an SMS provider later).
create or replace function public.set_phone(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); ph text := trim(coalesce(a->>'phone', ''));
begin
  if ph !~ '^\+?\d[\d\s]{9,16}$' then perform app.fail('Enter a phone number like 0812 345 6789.'); end if;
  update app.profiles set phone = ph, phone_ok = false where id = u;
  perform app.note(u, format('Your phone number was changed to %s. If this wasn''t you, contact support.', ph));
  return '{}'::jsonb;
end $$;

create or replace function public.note_password_changed(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login();
begin
  perform app.note(u, 'Your password was changed. If this wasn''t you, contact support.');
  return '{}'::jsonb;
end $$;

-- What stops an account from being deleted right now.
create or replace function public.delete_account_check(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login();
begin
  return jsonb_build_object('busy', to_jsonb(array_remove(array[
    case when exists (select 1 from app.keys where student_id = u and status = 'active') then 'an active key' end,
    case when exists (select 1 from app.payments where student_id = u and status = 'held') then 'rent held by {{APP_NAME}}' end,
    case when exists (select 1 from app.inspections where student_id = u and status = 'booked') then 'a booked visit' end,
    case when exists (select 1 from app.houses where agent_id = u and not deleted) then 'listings that are not deleted' end,
    case when app.savings_balance(u) > 0 then 'money in rent savings' end
  ], null)));
end $$;

-- Supabase replaces this to also remove the login (see db/supabase).
create or replace function app.delete_login(u uuid) returns void language sql as $$ select null::void $$;

-- Removes personal details; payment records stay (they are needed for accounting).
create or replace function public.delete_account(a jsonb) returns jsonb
language plpgsql security definer set search_path = app, public as $$
declare u uuid := app.need_login(); busy jsonb := public.delete_account_check('{}') -> 'busy';
begin
  if jsonb_array_length(busy) > 0 then perform app.fail('Finish these first: ' || (select string_agg(x, ', ') from jsonb_array_elements_text(busy) x) || '.'); end if;
  delete from app.favs where student_id = u;
  delete from app.savings_goals where student_id = u;
  delete from app.ballot_entries where student_id = u;
  update app.profiles set deleted = true, name = 'Deleted user', email = null, phone = null, photo = null, dept = null, prefs = '{}'::jsonb where id = u;
  perform app.delete_login(u);
  return '{}'::jsonb;
end $$;
