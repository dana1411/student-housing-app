-- Core tables. All in schema "app"; none are reachable from the client directly.

create table if not exists app.profiles (
  id             uuid primary key,                -- same id as the login (auth.users.id)
  role           text not null check (role in ('student','agent','admin')),
  name           text not null,
  email          text,
  phone          text,
  phone_ok       boolean not null default false,
  photo          text,
  dept           text,                            -- students: department and level
  school         text not null default 'oau',
  suspended      boolean not null default false,  -- students (agents use agents.status)
  suspend_reason text,
  prefs          jsonb not null default '{}'::jsonb,
  deleted        boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists app.agents (
  id             uuid primary key references app.profiles(id) on delete cascade,
  biz            text not null default '',
  btype          text,
  rel            text,
  status         text not null default 'pending' check (status in ('pending','verified','rejected','suspended')),
  verified_at    timestamptz,
  resp           text not null default 'not rated yet',
  rating         numeric not null default 0,
  ratings        int not null default 0,
  trust          int not null default 0,
  insp_done      int not null default 0,
  disputes       int not null default 0,
  cancels        int not null default 0,
  mismatches     int not null default 0,
  no_shows       int not null default 0,
  bio            text not null default '',
  payout_bank    text,
  payout_acct    text,
  payout_name    text,
  docs           jsonb not null default '[]'::jsonb,   -- readable lines shown to admin
  doc_files      jsonb not null default '[]'::jsonb,   -- storage paths of uploaded documents
  reject_reason  text,
  suspend_reason text,
  created_at     timestamptz not null default now()
);

create table if not exists app.houses (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references app.agents(id),
  title          text not null,
  area           text not null,
  address        text not null,
  km             numeric not null default 1,
  type           text not null,
  shared         boolean not null default false,
  art            jsonb not null default '{"wall":0,"roof":0,"kind":"storey"}'::jsonb,
  times          text[] not null default '{10:00}',
  days           int[]  not null default '{1,2,3,4,5,6}',
  baths          int not null default 1,
  avail_from     date,
  descr          text not null default '',
  amenities      text[] not null default '{}',
  rules          text[] not null default '{}',
  photos         text[] not null default '{}',
  mod            text not null default 'pending' check (mod in ('pending','live','rejected','removed','deleted')),
  paused         boolean not null default false,
  deleted        boolean not null default false,
  removed_reason text,
  removed_note   text,
  removed_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists houses_agent on app.houses(agent_id);

create table if not exists app.rooms (
  id              uuid primary key default gen_random_uuid(),
  house_id        uuid not null references app.houses(id) on delete cascade,
  name            text not null,
  price           int not null check (price > 0),
  cap             int not null default 1 check (cap between 1 and 6),
  cap_saved       int,
  paused          boolean not null default false,
  furnished       boolean not null default false,
  hold_ballot     uuid,                         -- room held for a ballot winner
  pay_hold_by     uuid,                         -- 15-minute hold while a student pays
  pay_hold_until  timestamptz,
  archived        boolean not null default false,
  sort            int not null default 0
);
create index if not exists rooms_house on app.rooms(house_id);

-- Each new 15-minute room hold, to stop one student blocking a room forever.
create table if not exists app.hold_log (
  student_id uuid not null,
  room_id    uuid not null,
  at         timestamptz not null default now()
);
create index if not exists hold_log_idx on app.hold_log(student_id, room_id, at);

create table if not exists app.payments (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('inspection','rent','renewal','deposit')),
  student_id     uuid not null references app.profiles(id),
  house_id       uuid references app.houses(id),
  room_id        uuid references app.rooms(id),
  amount         int not null check (amount > 0),
  savings_used   int not null default 0,
  method         text not null default '',
  ref            text not null unique,
  status         text not null check (status in ('pending','paid','held','released','refunded','failed','expired')),
  provider       text not null default 'simulated',
  provider_txn   text,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  released_at    timestamptz,
  refunded_at    timestamptz,
  paid_out_at    timestamptz                   -- admin marked the agent's share as sent
);
create index if not exists payments_student on app.payments(student_id);
create index if not exists payments_house on app.payments(house_id);

create table if not exists app.keys (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  payment_id    uuid references app.payments(id),
  house_id      uuid not null references app.houses(id),
  room_id       uuid not null references app.rooms(id),
  student_id    uuid not null references app.profiles(id),
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  status        text not null default 'active' check (status in ('active','expired','cancelled')),
  moved_in      boolean not null default false,
  auto_renew    boolean not null default false,
  shown         int[] not null default '{}',
  not_renewing  boolean not null default false,
  renewals      int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists keys_room on app.keys(room_id);
create index if not exists keys_student on app.keys(student_id);

create table if not exists app.inspections (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid not null references app.houses(id),
  student_id  uuid not null references app.profiles(id),
  slot        timestamptz not null,
  fee         int not null,
  payment_id  uuid references app.payments(id),
  status      text not null default 'booked' check (status in ('booked','completed','cancelled','stuCancelled','noshow','missed')),
  code        text not null,
  code_tries  int not null default 0,
  rating      int check (rating between 1 and 5),
  mismatch    boolean not null default false,
  moves       int not null default 0,
  r24         boolean not null default false,
  r1          boolean not null default false,
  refunded    boolean not null default false,
  by_admin    boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists insp_house on app.inspections(house_id);
create index if not exists insp_student on app.inspections(student_id);

create table if not exists app.ballots (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid not null references app.houses(id),
  room_id     uuid not null references app.rooms(id),
  key_id      uuid not null references app.keys(id),
  draw_at     timestamptz not null,
  status      text not null default 'open' check (status in ('open','drawn','filled','lapsed','cancelled')),
  draw_order  uuid[] not null default '{}',
  offer_idx   int not null default 0,
  offer_at    timestamptz,
  winner_key  uuid,
  created_at  timestamptz not null default now()
);

create table if not exists app.ballot_entries (
  ballot_id   uuid not null references app.ballots(id) on delete cascade,
  student_id  uuid not null references app.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (ballot_id, student_id)
);

create table if not exists app.threads (
  id             uuid primary key default gen_random_uuid(),
  house_id       uuid not null references app.houses(id),
  student_id     uuid not null references app.profiles(id),
  agent_id       uuid not null references app.agents(id),
  reported       boolean not null default false,
  report_reason  text,
  reported_by    text,
  reported_at    timestamptz,
  report_status  text,
  blocked        boolean not null default false,
  blocked_by     text,
  created_at     timestamptz not null default now(),
  unique (house_id, student_id)
);

create table if not exists app.messages (
  id         bigint generated always as identity primary key,
  thread_id  uuid not null references app.threads(id) on delete cascade,
  sender     text not null check (sender in ('s','a')),
  body       text not null,
  flag       boolean not null default false,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread on app.messages(thread_id);

create table if not exists app.complaints (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('public','mismatch','dispute')),
  author_id    uuid references app.profiles(id),
  author_name  text not null,
  author_role  text not null,
  about        text not null check (about in ('house','agent','tenant')),
  house_id     uuid references app.houses(id),
  agent_id     uuid references app.agents(id),
  tenant_id    uuid references app.profiles(id),
  tenant_name  text,
  reason       text,
  payment_id   uuid references app.payments(id),
  body         text not null,
  status       text not null default 'open' check (status in ('open','review','resolved')),
  reply        text not null default '',
  reply_by     text,
  removed      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists app.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid references app.profiles(id) on delete cascade,  -- null = for admins
  body        text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notif_user on app.notifications(user_id);

create table if not exists app.favs (
  student_id uuid not null references app.profiles(id) on delete cascade,
  house_id   uuid not null references app.houses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, house_id)
);

create table if not exists app.savings_goals (
  student_id uuid primary key references app.profiles(id) on delete cascade,
  name       text not null default 'Next session rent',
  target     int not null default 300000,
  due        date not null,
  mode       text not null default 'flexible' check (mode in ('flexible','locked')),
  sched      text not null default 'none' check (sched in ('none','weekly','monthly')),
  sched_amt  int not null default 0,
  next_auto  timestamptz
);

create table if not exists app.savings_txns (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references app.profiles(id) on delete cascade,
  type        text not null check (type in ('deposit','applied','withdrawal')),
  amt         int not null check (amt > 0),
  note        text not null default '',
  payment_id  uuid references app.payments(id),
  created_at  timestamptz not null default now()
);
create index if not exists sav_student on app.savings_txns(student_id);

create table if not exists app.support (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references app.profiles(id) on delete set null,
  name       text not null,
  contact    text not null,
  who        text not null,
  topic      text not null,
  msg        text not null,
  status     text not null default 'new' check (status in ('new','answered')),
  created_at timestamptz not null default now()
);

create table if not exists app.waitlist (
  id         uuid primary key default gen_random_uuid(),
  school     text not null,
  contact    text not null,
  who        text not null default 'student',
  created_at timestamptz not null default now()
);

-- One row per user whose data changed. The app subscribes to its own row
-- (Supabase Realtime) and refreshes when it changes. Lives in public so Realtime
-- can check the row-level policy below.
create table if not exists public.pings (
  user_id uuid primary key,
  at      timestamptz not null default now()
);
alter table public.pings enable row level security;
drop policy if exists pings_own on public.pings;
create policy pings_own on public.pings for select using (user_id = auth.uid());

alter table app.inspections add column if not exists code_tries int not null default 0;

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
  end loop;
end $$;
