# Setup

Every outside service the app can use, what it turns on, and what goes in `.env.local`. The same list, with a present or missing flag for each, is shown at `/settings/integrations` (defined in `src/lib/integrations/index.ts`).

Copy `.env.example` to `.env.local` and restart `next dev` after every change; Next reads the file at startup.

With no keys, every screen runs on sample data. Gemini and Supabase are required to leave demo mode; everything else is optional.

All redirect URIs below assume `http://localhost:3000`. If you run on another port, use it everywhere, including `NEXT_PUBLIC_SITE_URL`: OAuth callbacks are built from that variable and must match what the provider has registered exactly.

## Required

### Gemini

Powers every agent: website reading, fact extraction, scoring, drafting, the reviewer, outreach, social posts, and document uploads.

1. Create a key at https://aistudio.google.com/apikey.
2. Add it:

```
GEMINI_API_KEY=AIza...
# Optional overrides; defaults are in src/lib/ai/gemini.ts
# GEMINI_LITE_MODEL=gemini-3.1-flash-lite
# GEMINI_STANDARD_MODEL=gemini-3.8-flash
```

Check: Gemini shows Connected at `/settings/integrations`, and pasting a website at `/onboarding` produces facts quoted from the site. Runs appear on `/activity` with token counts and cost.

The free tier is enough to try the loop. Rate-limited calls retry after 4, 12, and 30 seconds (or the delay Google returns), then the screen offers a retry instead of failing; saved progress is kept. Free-tier prompts may be used by Google to improve its products, so production needs billing enabled on the key's Google Cloud project.

### Supabase

Sign-in, persistence, document storage, teams, and the calendar feed.

1. Create a project at https://supabase.com/dashboard (US region).
2. In the SQL editor, run in order: `supabase/migrations/0001_init.sql` (schema, RLS, pgvector, the private `documents` bucket), `0002_real_loop.sql` (cache table, profile trigger), `0003_features.sql` (searches, versions, contacts, campaigns, budgets, reviewer checks, `integration_connections`).
3. Authentication → Providers → Email: enabled. Sign-in is magic link only; keep `{{ .ConfirmationURL }}` in the Magic Link template.
4. Authentication → URL Configuration: Site URL `http://localhost:3000`, redirect URL `http://localhost:3000/auth/callback`. Add the production equivalents when you deploy.
5. Copy the project URL, `anon` key, and `service_role` key from Project Settings → API. The service role key bypasses RLS and stays on the server.

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Check: the demo-mode notice on `/settings/integrations` is gone. Sign up at `/sign-up`, open the magic link, and you land on `/inbox` with a new workspace; `organizations`, `org_members`, `subscriptions`, and `notification_settings` each get a row. A PDF uploaded on `/profile` lands in Storage under `documents/<org id>/`.

## Optional

### Google: sign-in, Gmail, Calendar

One OAuth client covers all three.

1. In https://console.cloud.google.com, configure the OAuth consent screen (External) with scopes `openid`, `email`, `profile`. While in Testing, add your accounts as test users.
2. Create an OAuth client ID (Web application) with these redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback` (sign-in, handled by Supabase)
   - `http://localhost:3000/api/integrations/google/callback` (Gmail and Calendar)
3. For sign-in, enable the Google provider in Supabase (Authentication → Providers) with the same client ID and secret.
4. For Gmail, enable the Gmail API and add the `gmail.send` scope (restricted; publishing beyond test users needs Google verification).
5. For Calendar, enable the Google Calendar API and add the `calendar.events` scope.

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Check: Continue with Google appears on `/sign-in`. Gmail and Google Calendar show "Key present, not connected yet" at `/settings/integrations` until a workspace connects its account. After connecting, drafts on `/outreach` can be sent from Gmail, and Push milestones now creates events for everything on `/calendar`.

### Outlook

Sends outreach through Microsoft Graph.

1. In https://entra.microsoft.com, create an app registration for "Accounts in any organizational directory and personal Microsoft accounts" (the app uses the `common` endpoint).
2. Redirect URI (Web): `http://localhost:3000/api/integrations/microsoft/callback`.
3. Create a client secret and note its expiry.
4. API permissions → Microsoft Graph → Delegated: `Mail.Send`, `User.Read`.

```
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

### Resend

Email the app sends itself: the weekly digest and the contact form. Without it the digest returns 503 and `/contact` shows the contact address instead.

1. Create an API key at https://resend.com and verify your sending domain (SPF, DKIM, return path).
2. Without `EMAIL_FROM` the app falls back to `onboarding@resend.dev`, which only delivers to your own Resend account address.

```
RESEND_API_KEY=re_...
EMAIL_FROM=Firstlight <hello@your-domain.example>
NEXT_PUBLIC_CONTACT_EMAIL=hello@your-domain.example
```

### Stripe

Starter and Growth plans through Checkout, and the customer portal. The Free plan and its limits work without it. The app calls the Stripe REST API directly; no SDK is installed.

1. In test mode, create Starter and Growth products with monthly recurring prices and copy each `price_` ID.
2. Copy the secret key (`sk_test_`) from Developers → API keys.
3. Webhook:
   - Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the `whsec_` it prints.
   - Deployed: add an endpoint at `https://your-domain.example/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
4. Settings → Billing → Customer portal: allow payment method updates, invoices, and cancellation. The portal is configured per mode.

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
```

Check: on `/settings` → Billing, buy Starter with `4242 4242 4242 4242`. The plan changes once `checkout.session.completed` arrives; cancelling in the portal returns it to Free. If payment succeeds but the plan doesn't change, the webhook secret is almost always the cause. The webhook answers 400 only on a bad signature.

For production, repeat with live mode off: live prices, `sk_live_` key, a live webhook endpoint, and live portal settings, set only in the deployed environment.

### Weekly digest

`GET /api/cron/digest` emails each workspace its new matches and deadlines in the next 14 days. It requires a secret, sent as `Authorization: Bearer <secret>` or `?secret=`, and Resend.

```
CRON_SECRET=<openssl rand -hex 32>
```

On Vercel, set `CRON_SECRET` and Vercel's cron adds the header itself.

### Milestone reminders

`GET /api/cron/reminders`, with the same `CRON_SECRET` and Resend, emails the person assigned to each milestone a few days before it is due (the number of days is each workspace's setting). Run it once a day. Each milestone is reminded once.

## Costs

A full onboarding run (crawl, extraction, search planning, triage, scoring a dozen notices, one letter) comes to about five cents on the standard tier; redrafting a paragraph is under a cent. Actual figures for your key are on `/activity` and in the `agent_runs` table. Grants.gov is free and needs no key.
