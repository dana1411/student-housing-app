# Lodgely (working name)

A student housing marketplace for OAU, Ile-Ife. Students find rooms, book a paid inspection,
pay rent that is held until they move in, and get a subscription key with a countdown.
Agents list houses and manage visits, tenants and payouts. Admins verify agents, moderate
listings and complaints, and handle money.

One codebase gives you three apps:

- a **website** (deploy to Vercel)
- an **Android app** (built automatically by GitHub Actions)
- an **iPhone app** (needs a Mac or a cloud Mac to build)

## Two modes

| | Demo mode | Live mode |
|---|---|---|
| When | No Supabase keys set | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set |
| Data | Sample houses and people, stored on the device | Your Supabase database, shared by everyone |
| Logins | Sample accounts, plus any account you create | Real accounts with email codes |
| Payments | Simulated | Simulated until you switch on Paystack |
| Extras | Role switcher, time machine, demo guide | None of the demo tools |

Both modes run the **same database rules**. Demo mode runs Postgres inside the browser
(PGlite), so what you test in the demo is what the live app does.

## Start here

- **Set it up:** [docs/SETUP.md](docs/SETUP.md) walks through Vercel, Supabase, Paystack and the
  Android app step by step.
- **Change the name:** edit `"name"` in [`app.config.json`](app.config.json). It changes the
  website, the phone apps, emails from the app, receipts and the key prefix (`keyPrefix`).
- **For developers:** [docs/DEVELOPERS.md](docs/DEVELOPERS.md).

## Run it on a computer

```bash
npm install
npm run dev          # opens the app in demo mode at http://localhost:5173
npm run test:db      # business-rule tests (needs a Postgres server; see docs/DEVELOPERS.md)
npm run build        # production build into dist/
```
