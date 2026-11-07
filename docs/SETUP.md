# Setting up Lodgely

Work through these in order. Each part works on its own, so you can stop after any of them.

- **Part 1** (15 minutes, free): a website anyone can open, running the demo.
- **Part 2** (5 minutes, free): the Android app on your phone.
- **Part 3** (30 minutes, free): the real backend. Real accounts and shared data.
- **Part 4** (20 minutes, free in test mode): real payments with Paystack.
- **Part 5**: publishing to Google Play and the App Store.

---

## Part 1: Put the website online (Vercel)

1. Go to **vercel.com** and sign up with your GitHub account.
2. Click **Add New → Project**, find **student-housing-app** and click **Import**.
3. Leave every setting as it is and click **Deploy**.
4. After a minute or two you get a link like `student-housing-app.vercel.app`. That is the demo,
   with sample data, that you can share.

Every time new code is pushed to GitHub, Vercel updates the site by itself.

## Part 2: Install the Android app

1. On GitHub, open the repository and click the **Actions** tab.
2. Click **Android app** on the left, then the most recent run with a green tick.
3. Scroll to **Artifacts** and download **app-debug-apk**. It is a zip with `app-debug.apk` inside.
4. Copy the APK to an Android phone and open it. The phone asks you to allow installing apps
   from this source. Allow it once.

This test build uses demo mode until you finish Part 3.

## Part 3: The real backend (Supabase)

### 3.1 Create the project

1. Go to **supabase.com**, sign up, and click **New project**.
2. Name it, choose a strong database password and **save it somewhere safe**. For the region,
   pick the closest one to Nigeria that is offered (for example West EU / London).
3. Wait about two minutes for it to start.

### 3.2 Create the database

1. In your project, open **SQL Editor** and click **New query**.
2. In GitHub, open `supabase/migrations/20261107000000_core.sql`, click **Raw**, select all
   and copy.
3. Paste it into the SQL editor and click **Run**. You should see "Success".

You can run the same file again later, after an update, and it brings the database up to date
without losing data.

> If you see a note about **pg_cron**, open **Database → Extensions**, switch on **pg_cron**,
> then run this in the SQL editor:
> `select cron.schedule('app-jobs', '* * * * *', 'select app.run_jobs()');`
> This runs the timed rules every minute: reminders, releasing rent after 7 days, ballot draws
> and ending keys.

### 3.3 Email codes

The app confirms emails and resets passwords with 6-digit codes.

1. Open **Authentication → Emails** (or **Email Templates**).
2. **Confirm signup**: replace the message with the contents of
   `supabase/templates/confirmation.html` and set the subject to "Your sign-up code".
3. **Reset password**: replace the message with `supabase/templates/recovery.html` and set the
   subject to "Your password reset code".
4. Open **Authentication → URL Configuration** and set **Site URL** to your Vercel link.

> Supabase's built-in email sender only sends a few emails an hour and is meant for testing.
> Before real students sign up, connect your own email sender under
> **Authentication → Emails → SMTP settings**. Brevo and Resend both have free tiers.

### 3.4 Connect the website and the app to it

1. In Supabase, open **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. In Vercel, open your project, then **Settings → Environment Variables**, and add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
   - `VITE_PUBLIC_URL` = your Vercel link, for example `https://student-housing-app.vercel.app/`
3. Open **Deployments**, click the three dots on the latest one and choose **Redeploy**.
4. For the Android app, add the same three values on GitHub under
   **Settings → Secrets and variables → Actions → New repository secret**. Then open
   **Actions → Android app → Run workflow**.

The site and app now use real accounts. They start empty, with no sample data.

### 3.5 Make yourself an admin

1. Open your site and sign up as a student with your own email.
2. In the Supabase SQL editor, run (with your email):
   ```sql
   select app.make_admin('you@example.com');
   ```
3. Log out and back in. You now see the admin screens.

Agents sign up from the home page ("For agents"), upload their ID and proof of authority, and
appear under **Admin → Users** for you to approve. Their listings appear under
**Admin → Listings**.

## Part 4: Payments with Paystack

Until you do this, payments are simulated: nothing is charged and everything else works.
Anyone with an account can "pay" in this mode, so don't open the app to the public before
finishing this part.

### 4.1 Paystack account

1. Sign up at **paystack.com**. Test mode works straight away. Live mode needs your business
   documents.
2. Open **Settings → API Keys & Webhooks** and copy the **Test Secret Key** (`sk_test_...`).

### 4.2 Deploy the payment functions

The quickest way is the ready-made GitHub Action.

1. In Supabase, open **Account → Access Tokens** (supabase.com/dashboard/account/tokens) and
   create a token.
2. In Supabase, open **Project Settings → Database → Connection string**. Choose
   **Session pooler** and copy the URI. Replace `[YOUR-PASSWORD]` with your database password.
3. On GitHub (**Settings → Secrets and variables → Actions**), add these repository secrets:
   - `SUPABASE_ACCESS_TOKEN`: the token from step 1
   - `SUPABASE_PROJECT_REF`: the id in your project URL (`https://<this part>.supabase.co`)
   - `SUPABASE_DB_URL`: the URI from step 2
   - `PAYSTACK_SECRET_KEY`: your `sk_test_...` key
   - `VITE_PUBLIC_URL`: your website link (you added this in 3.4). Paystack only sends people
     back to this address after paying.
4. Open **Actions → Deploy backend (Supabase) → Run workflow**.

This also updates the database. Run it again whenever the backend code changes.

### 4.3 Webhook and switch-on

1. In Paystack, under **Settings → API Keys & Webhooks**, set the **Test Webhook URL** to
   `https://<your project ref>.supabase.co/functions/v1/paystack-webhook`
2. In the Supabase SQL editor, turn on Paystack:
   ```sql
   select app.go_live();
   ```
   This clears the test bookings, payments, keys and savings made while payments were
   simulated, so no free test money carries over. Accounts, listings and chats stay. Run it
   once, before you open the app to real students.
3. Try a booking. The app opens Paystack's checkout page. Pay with one of Paystack's test cards
   (paystack.com/docs/payments/test-payments).

To go live later, swap in your live secret key (`sk_live_...`) as `PAYSTACK_SECRET_KEY`, rerun
the deploy action, and set the **Live Webhook URL** in Paystack to the same address.

### How money moves

- Students pay through Paystack into your Paystack balance.
- Rent shows as **held** until the student confirms move-in, or for 7 days.
- When it is released, the agent's share (90%) is due. Pay agents from your Paystack dashboard
  or bank, then press **Mark as sent to agent** under **Admin → Payments**. Automatic payouts
  through Paystack Transfers can be added later.
- Refunds work the same way. The app marks the payment refunded and shows **Refund to send**.
  Send the money back from Paystack (**Transactions → Refund**).
- Agents check their payout account with their bank inside the app, through Paystack.

## Part 5: App stores

### Google Play ($25 one-time)

1. Create a Google Play Console account.
2. Create an upload key once. Any Android developer can do this in two minutes, or use
   Android Studio's "Generate Signed Bundle" wizard. Keep the file and passwords safe.
3. Add these GitHub secrets: `ANDROID_KEYSTORE_BASE64` (the keystore file, base64-encoded),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`.
4. The **Android app** action then also produces **app-release-aab**. Upload that file to Play
   Console.

Decide the final name and the app id (`appId` in `app.config.json`, for example
`com.yourcompany.app`) **before** the first upload. The app id can't change after that.

### iPhone App Store ($99 a year)

You need an Apple Developer account and a Mac with Xcode, or a cloud build service such as
Codemagic or Ionic Appflow. On the Mac:

```bash
npm install && npm run build && npx cap sync ios && npx cap open ios
```

In Xcode, choose your team under **Signing**, then **Product → Archive** and upload.

## What still needs a decision or a provider

| Item | Status |
|---|---|
| Final name | Placeholder "Lodgely" in `app.config.json` |
| Refund policy after rent is paid | Admin can refund while rent is held. The rules are yours to set. |
| Rent savings | Works, but holding students' savings needs a licensed partner (a bank or wallet). Keep it in test mode until one is chosen. |
| Commission on inspection fees | Currently 10%, like rent (in `app.settings`) |
| SMS | Phone numbers are collected but not confirmed by SMS. Add an SMS provider (for example Termii). |
| Push notifications | In-app notifications only for now. Phone push needs Firebase. |
| Reminder emails | Only sign-up and password emails are sent. Other alerts are in the app. |
| Terms and Privacy pages | Drafts. A lawyer should review them before launch. |
