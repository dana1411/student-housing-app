-- Core: schemas, settings and helpers.
-- Every table lives in the private "app" schema. The only things exposed to the
-- client are the functions in "public" (called with supabase.rpc), and each of
-- them checks who is calling. Tables have row level security turned on with no
-- policies, so direct table access from the client is refused.
--
-- {{APP_NAME}} and {{KEY_PREFIX}} are filled in from app.config.json by
-- scripts/build-sql.mjs.

create schema if not exists app;

create table if not exists app.settings (
  id            int primary key default 1 check (id = 1),
  demo          boolean not null default false,      -- demo tools (time machine, personas)
  shift_ms      bigint  not null default 0,          -- demo clock offset
  payment_mode  text    not null default 'simulated' check (payment_mode in ('simulated','paystack')),
  insp_fee      int     not null default 3000,       -- naira
  commission    numeric not null default 0.10,
  term_days     int     not null default 360,
  hold_minutes  int     not null default 15,
  visit_cut_h   int     not null default 12,         -- hours before a visit when it can no longer be moved or refunded
  release_days  int     not null default 7,          -- rent is released this many days after payment if no move-in
  ballot_days   int     not null default 60,         -- ballot opens this many days before a room frees up
  offer_hours   int     not null default 48          -- a ballot winner has this long to pay
);
insert into app.settings (id) values (1) on conflict do nothing;

create or replace function app.cfg() returns app.settings
language sql stable as $$ select * from app.settings where id = 1 $$;

-- Clock. Uses the demo offset so the time machine works in demo mode.
create or replace function app.now() returns timestamptz
language sql stable as $$
  select now() + make_interval(secs => (select shift_ms from app.settings where id = 1) / 1000.0)
$$;

-- Epoch milliseconds <-> timestamptz (the UI works in milliseconds).
create or replace function app.ms(t timestamptz) returns bigint
language sql immutable as $$ select case when t is null then null else floor(extract(epoch from t) * 1000)::bigint end $$;

create or replace function app.ts(ms bigint) returns timestamptz
language sql immutable as $$ select case when ms is null then null else to_timestamp(ms / 1000.0) end $$;

-- Wall-clock time in Nigeria (WAT, UTC+1, no daylight saving).
create or replace function app.wat(t timestamptz) returns timestamp
language sql immutable as $$ select (t at time zone 'UTC') + interval '1 hour' $$;

-- Naira formatting for notification text: 320000 -> ₦320,000
create or replace function app.naira(n numeric) returns text
language sql immutable as $$ select '₦' || to_char(round(n), 'FM999,999,999,990') $$;

-- 7 Nov 2026
create or replace function app.fdate(t timestamptz) returns text
language sql immutable as $$ select trim(to_char(app.wat(t), 'FMDD Mon YYYY')) $$;

-- Sat 7 Nov · 10:00 AM
create or replace function app.fslot(t timestamptz) returns text
language sql immutable as $$
  select to_char(app.wat(t), 'Dy FMDD Mon') || ' · ' || ltrim(to_char(app.wat(t), 'FMHH12:MI AM'))
$$;

-- Random helpers. gen_random_uuid() is core Postgres and uses a strong random source.
create or replace function app.rand_bytes(n int) returns bytea
language plpgsql volatile as $$
declare b bytea := ''::bytea;
begin
  while length(b) < n loop b := b || uuid_send(gen_random_uuid()); end loop;
  return substring(b from 1 for n);
end $$;

create or replace function app.rand_str(n int, alphabet text) returns text
language plpgsql volatile as $$
declare b bytea := app.rand_bytes(n); s text := ''; i int;
begin
  for i in 0 .. n - 1 loop
    s := s || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  end loop;
  return s;
end $$;

-- Subscription key: LDG-XXXX-XXXX-XXXX
create or replace function app.gen_key() returns text
language plpgsql volatile as $$
declare r text := app.rand_str(12, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
begin
  return '{{KEY_PREFIX}}-' || substr(r, 1, 4) || '-' || substr(r, 5, 4) || '-' || substr(r, 9, 4);
end $$;

-- Payment reference: PAY-7GQ2KD41
create or replace function app.gen_ref() returns text
language sql volatile as $$
  select 'PAY-' || app.rand_str(6, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') || app.rand_str(2, '0123456789')
$$;

create or replace function app.gen_digits(n int) returns text
language sql volatile as $$ select app.rand_str(n, '0123456789') $$;

-- Raise an error the UI shows to the person as is.
create or replace function app.fail(msg text) returns void
language plpgsql as $$ begin raise exception using message = msg, errcode = 'P0001'; end $$;

-- Who is calling. auth.uid() is provided by Supabase (and by db/local in demo mode).
create or replace function app.uid() returns uuid
language sql stable as $$ select auth.uid() $$;

-- Stable ids for the demo's sample people and houses (used by demo-only code paths).
create or replace function app.sid(x text) returns uuid
language sql immutable as $$ select md5('lodgely-seed:' || x)::uuid $$;
