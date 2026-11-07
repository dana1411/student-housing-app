# Developer notes

## How it fits together

```
app.config.json          name, app id, key prefix (one place)
index.html, src/
  main.js                boot: pick a backend, start the UI
  app/app.js             the whole UI (views, modals, actions) - plain JS, string templates
  styles.css             design tokens, light/dark themes
  backend/
    index.js             Supabase if configured, else demo
    supabase.js          live: supabase-js (rpc, auth, storage, realtime) + Paystack functions
    local.js             demo: PGlite (Postgres in WebAssembly) with sample data
  native.js              Capacitor helpers (file share, in-app browser, back button)
db/
  core/*.sql             the database and every business rule (shared by both modes)
  local/*.sql            demo only: auth.uid() stand-in, demo logins, sample data
  supabase/*.sql         Supabase only: auth trigger, storage, realtime, permissions, cron
supabase/
  migrations/            generated from db/ by scripts/build-sql.mjs (don't edit)
  functions/             Paystack edge functions (Deno)
  templates/             auth email templates (6-digit codes)
android/, ios/           Capacitor native projects
tests/db/                business-rule tests against a real Postgres
tests/e2e/run.mjs        browser test of the demo build (Playwright)
```

### Data flow

- **Reading:** the app calls `public.get_state()`. It returns everything the signed-in person
  may see, in the same shape the UI uses (camelCase, times in epoch ms). Visitors get public
  listings. Other people's key codes, phone numbers and emails are filtered out on the server.
- **Writing:** every change is a `public.<action>(a jsonb)` function, for example
  `start_checkout`, `confirm_visit` or `approve_listing`. Each checks who is calling with
  `app.need_student()`, `app.need_agent()` or `app.need_admin()`, applies the rule, writes
  notifications, and raises a readable error if something isn't allowed. The UI shows those
  error messages as they are.
- **Security:** tables live in schema `app`. Row-level security is on with no policies, and the
  client has no grants there, so the client can only call the `public` functions. The
  Paystack confirm functions are granted to `service_role` only.
- **Time:** `app.now()` is `now()` plus the demo clock offset. `app.run_jobs()` handles
  everything time-based: release after 7 days, keys ending, ballots opening and drawing,
  reminders, holds expiring and auto-save. It runs every minute with pg_cron, or every few
  seconds in demo mode.
- **Live updates:** functions touch `public.pings` for each affected user. The app subscribes
  to its own row (Supabase Realtime) and refetches state. There is also a 60-second poll as a
  fallback.

### Payments

`start_checkout` creates a `pending` payment and returns its reference.

- **Simulated mode:** the app calls `simulate_pay`.
- **Paystack mode:** the app calls the `paystack-init` function and opens the checkout URL.
  Paystack's webhook (`paystack-webhook`, signature-checked) or `paystack-verify` confirms the
  transaction with Paystack, then calls `payment_confirmed`. That checks the amount and runs
  `app.finalize_payment`, which is idempotent.

## Commands

```bash
npm run dev            # demo mode with hot reload
npm run sql            # rebuild SQL bundles from db/ (also runs on build)
npm run build          # web build into dist/
npm run test:db        # needs Postgres; DATABASE_URL defaults to postgres://postgres@127.0.0.1:54329/postgres
npm run test:e2e       # needs a build and Playwright's Chromium
npm run cap:sync       # build + copy into android/ and ios/
node scripts/make-icons.mjs   # redraw launcher icons and splash
```

Quick Postgres for tests: `docker run -d -p 54329:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16`

## Adding a feature

1. Add or change the rule in `db/core/*.sql` as a `public.` function taking `a jsonb`.
   Keep the SQL re-runnable: `create or replace`, `if not exists`,
   `add column if not exists`.
2. If the UI needs new data, add it to `get_state()` in `db/core/30_state.sql`.
3. Add a test in `tests/db/`.
4. In `src/app/app.js`, call it with `run('function_name', args, {ok: 'Toast text'})`.
5. Deploy: rerun the **Deploy backend** action, or paste the regenerated migration into the
   Supabase SQL editor.
