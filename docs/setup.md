# Setup

Every outside service the app can use, what it turns on, and what goes in `.env.local`. The same list, with a present or missing flag for each, is shown at `/settings/integrations` (defined in `src/lib/integrations/index.ts`).

Copy `.env.example` to `.env.local` and restart `next dev` after every change; Next reads the file at startup.

With no keys, every screen runs on sample data. Gemini and Supabase are required to leave demo mode; everything else is optional. `DEMO_MODE=true` forces the demo even with Supabase keys set; with a `GEMINI_API_KEY` as well, onboarding runs the real loop against in-memory state, which is a quick way to try the agents without a database.

All redirect URIs below assume `http://localhost:3000`. If you run on another port, use it everywhere, including `NEXT_PUBLIC_SITE_URL`: OAuth callbacks and the links in emails are built from that variable and must match what the provider has registered exactly.

## Required

### Gemini

Powers every agent: website reading, fact extraction, scoring, drafting, the reviewer, outreach, social posts, and document uploads. It also embeds the opportunity database for matching by meaning.

1. Create a key at https://aistudio.google.com/apikey.
2. Add it:

```
GEMINI_API_KEY=AIza...
# Optional overrides; defaults are in src/lib/ai/gemini.ts and src/lib/ai/embed.ts
# GEMINI_LITE_MODEL=gemini-3.1-flash-lite
# GEMINI_STANDARD_MODEL=gemini-3.8-flash
# GEMINI_EMBEDDING_MODEL=gemini-embedding-2
# CATALOG_EMBED_MAX=3000
```

Check: Gemini shows Connected at `/settings/integrations`, and pasting a website at `/onboarding` produces facts quoted from the site. Runs appear on `/activity` with token counts and cost.

The free tier is enough to try the loop. Rate-limited calls retry after 4, 12, and 30 seconds (or the delay Google returns), then the screen offers a retry instead of failing; saved progress is kept. Free-tier prompts may be used by Google to improve its products, so production needs billing enabled on the key's Google Cloud project.

Embeddings: after each ingestion run, new or changed open opportunities get a 768-dimension embedding, at most `CATALOG_EMBED_MAX` rows per run (default 3,000), with the cost logged. A large backfill is filled over several days of runs. Search then adds the closest matches by meaning to its keyword hits. Without a key, search is full text only.

### Supabase

Sign-in, persistence, document storage, teams, background jobs, and the opportunity database.

1. Create a project at https://supabase.com/dashboard (US region).
2. From Project Settings → API, copy the project URL, the `anon` key, and the `service_role` key. The service role key bypasses row level security and stays on the server.
3. From Connect → Session pooler (port 5432), copy the connection string with the database password. This is `SUPABASE_DB_URL`, used by `npm run launch:db` and by ingestion.
4. Optional: create a personal access token at https://supabase.com/dashboard/account/tokens. Only `npm run launch:db` uses it, to configure Auth for you. Never deploy it.

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_DB_URL=postgresql://postgres.your-project-ref:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
SUPABASE_ACCESS_TOKEN=sbp_...
```

5. Run:

```bash
npm run launch:db
```

It reads `.env.local` and, against the project in `SUPABASE_DB_URL`:

1. Applies every migration in `supabase/migrations` that has not run yet, recorded in `supabase_migrations.schema_migrations` the same way the Supabase CLI records them, so it is safe to run again.
2. When `SUPABASE_ACCESS_TOKEN` is set, configures Auth through the Management API: the site URL (`NEXT_PUBLIC_SITE_URL`) and redirect URLs (that site, its `www` host, and `http://localhost:3000`), the five branded email templates from `supabase/templates`, Resend as the SMTP server when `RESEND_API_KEY` is set, and Google sign-in when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Without the token it skips this step and says so.
3. Backfills the opportunity database from every enabled source. Large sources take a while; each run is logged in `catalog_ingest_runs`.
4. Prints the database size against the free plan's 500 MB, and how much of it is the opportunity database.

Options: `--dry-run` (print the migrations it would apply and change nothing), `--skip-backfill`, `--only grantsgov,sam_opportunities` (backfill just these sources), `--env FILE` (default `.env.local`). It refuses a connection string that points at this machine unless you pass `--allow-local`. Nothing secret is printed.

Doing it by hand instead: in the SQL editor, run every file in `supabase/migrations` in order, each in its own step (0005 must be separate: Postgres cannot use a new enum value in the transaction that adds it). Under Authentication → URL Configuration, set the Site URL and add `<site>/**` and `http://localhost:3000/**` as redirect URLs. Under Authentication → Emails, paste each file in `supabase/templates` into the matching template. The templates send people to `/auth/callback` with a token hash, so do not swap them back to the default `{{ .ConfirmationURL }}` links.

Sign-in is magic link (or Google); keep the Email provider enabled.

Check: the demo-mode notice on `/settings/integrations` is gone. Sign up at `/sign-up`, open the link, and you land in setup with a new workspace; `profiles`, `organizations`, `org_members` (you as owner), and `notification_settings` each get a row. A PDF uploaded on `/profile` lands in Storage under `documents/<org id>/`. The ingestion log is at `/admin/ingestion` for the addresses in `ADMIN_EMAILS`.

### Server secrets

Generate each one; none comes from an outside service.

```
# AES-256-GCM key for stored OAuth tokens (Gmail, Outlook, Google Calendar). Required before anyone connects an account.
TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>
# TOKEN_ENCRYPTION_KEY_PREVIOUS=
# Signs one-click unsubscribe links. Falls back to CRON_SECRET.
EMAIL_SIGNING_SECRET=<openssl rand -hex 32>
# Sent by schedulers to /api/cron/*, as Authorization: Bearer <secret> or ?secret=.
CRON_SECRET=<openssl rand -hex 32>
# Operators, comma separated. They can open /admin/ingestion and /admin/errors; everyone else gets a 404.
ADMIN_EMAILS=you@example.com
```

`TOKEN_ENCRYPTION_KEY` is 32 bytes, as base64 or 64 hex characters (`src/lib/crypto/tokens.ts`). The database never sees it. To rotate, put the new key in `TOKEN_ENCRYPTION_KEY` and the old one in `TOKEN_ENCRYPTION_KEY_PREVIOUS`: reads try both, and tokens move to the new key as they refresh.

## Optional

### Opportunity database

Ingestion runs outside the web app, as scheduled GitHub Actions jobs (`.github/workflows/ingest.yml`), in four slots: hourly (SAM.gov contract opportunities), daily, weekly, and monthly (the IRS registry). Each source's own schedule decides its slot (`src/lib/catalog/schedule.ts`). Nothing runs until the `SUPABASE_DB_URL` secret is set. Sources, terms, and limits are in [data-sources.md](data-sources.md).

```
# Free SAM.gov public API key. Adds hourly SAM.gov updates between the daily bulk extracts.
SAM_GOV_API_KEY=...
# Smallest yearly giving for a private foundation to get full detail from its 990-PF. Lower means a bigger database.
# IRS_990PF_MIN_GIVING=100000
# off makes matching call the live Grants.gov and SAM.gov APIs instead of the database (for debugging).
# CATALOG_MATCHING=
```

SAM.gov key: sign in at https://sam.gov, open your Workspace, then Profile, then Public API Key, and request one. A key tied to a SAM.gov role allows 1,000 requests a day; one without a role allows 10. Without a key, contract opportunities still arrive from the daily extract. With no database at all, the key lets a firm's Opportunities page search SAM.gov directly.

`IRS_990PF_MIN_GIVING`: every foundation that paid grants is stored with its giving and assets; only those at or above this amount (default $100,000) get the detail read from the full return. The default keeps the whole database well inside the free plan.

The scheduled jobs read only the GitHub Actions secrets below; `IRS_990PF_MIN_GIVING`, `CATALOG_EMBED_MAX`, and `GEMINI_EMBEDDING_MODEL` use their defaults there unless you add them to the workflow's `env`.

Check: as a firm, the Opportunities page says "Open bids from the opportunity database". `/data` shows live counts.

### GitHub Actions secrets

Set these under the repository's Settings → Secrets and variables → Actions. Each workflow does nothing, and says so, until its secrets exist.

| Secret | Used by | Why |
| --- | --- | --- |
| `SUPABASE_DB_URL` | `ingest.yml` | The database the sources load into. |
| `SAM_GOV_API_KEY` | `ingest.yml` | Hourly SAM.gov reads through the API. Optional. |
| `GEMINI_API_KEY` | `ingest.yml` | Embeddings after each run. Optional. |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `ingest.yml` | The IRS registry job writes its shards to the private `registry` Storage bucket. |
| `SITE_URL`, `CRON_SECRET` | `sweep-jobs.yml` | Calls `<SITE_URL>/api/cron/jobs` every ten minutes to restart background jobs whose server stopped mid-run (see [jobs.md](jobs.md)). |

`ci.yml` needs no secrets: it runs lint, the type check, the build, the plain-code tests, and the database tests against a local Supabase it starts itself.

### Google: sign-in, Gmail, Calendar

One OAuth client covers all three.

1. In https://console.cloud.google.com, configure the OAuth consent screen (External) with scopes `openid`, `email`, `profile`. While in Testing, add your accounts as test users.
2. Create an OAuth client ID (Web application) with these redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback` (sign-in, handled by Supabase)
   - `http://localhost:3000/api/integrations/google/callback` (Gmail and Calendar)
3. For sign-in, `npm run launch:db` turns on the Google provider in Supabase when these keys and `SUPABASE_ACCESS_TOKEN` are set. Otherwise enable it under Authentication → Providers with the same client ID and secret.
4. For Gmail, enable the Gmail API and add the `gmail.send` scope (restricted; publishing beyond test users needs Google verification).
5. For Calendar, enable the Google Calendar API and add the `calendar.events` scope.

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

Connecting Gmail or Calendar needs `TOKEN_ENCRYPTION_KEY`.

Check: Continue with Google appears on `/sign-in`. Gmail and Google Calendar show "Key present, not connected yet" at `/settings/integrations` until a workspace connects its account. After connecting, drafts on `/outreach` can be sent from Gmail, and Push milestones creates events for everything on `/calendar`.

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

Email the app sends itself: the weekly digest, deadline reminders, "draft ready" notices, team invitations, and the contact form. With `npm run launch:db` and `SUPABASE_ACCESS_TOKEN`, it also becomes the SMTP server for Supabase's sign-in emails. Every email is rendered by `src/lib/email`; the auth templates in `supabase/templates` are generated from the same code by `npm run email:templates`. Without Resend the digest returns 503, invitations are not sent, and `/contact` shows the contact address instead.

1. Create an API key at https://resend.com and verify your sending domain (SPF, DKIM, return path).
2. Without `EMAIL_FROM` the app falls back to `onboarding@resend.dev`, which only delivers to your own Resend account address.

```
RESEND_API_KEY=re_...
EMAIL_FROM=FundFellows <no-reply@fundfellows.com>
NEXT_PUBLIC_CONTACT_EMAIL=hello@your-domain.example
```

Non-essential mail (digest, reminders, draft ready) carries a one-click unsubscribe link signed with `EMAIL_SIGNING_SECRET`; opt-outs are kept per person and workspace in `email_opt_outs`. Sign-in and invitation emails are always sent.

### Weekly digest and reminders

`GET /api/cron/digest` emails each workspace its new matches, new results from its saved bid searches, and deadlines in the next 14 days. `GET /api/cron/reminders` emails the person assigned to each milestone a few days before it is due (the number of days is each workspace's setting); each milestone is reminded once. Both require `CRON_SECRET` and Resend.

On Vercel, `vercel.json` schedules both (digest Mondays at 13:00 UTC, reminders daily at 12:00 UTC); set `CRON_SECRET` and Vercel's cron adds the header itself.

### Analytics

Vercel Web Analytics counts page views without cookies. Enable it on the Vercel project, then set `VERCEL_ANALYTICS=on` and redeploy. Without both, no analytics script loads.

## Local database

Work against a local Supabase without touching the real project. Needs Docker and the Supabase CLI.

```bash
supabase start
```

From the repo root this applies every migration and the auth email templates. Ports come from `supabase/config.toml`: API 55421, Postgres 55422, Studio 55423, and Mailpit (where sign-in emails land) 55424.

```bash
cp .env.localdb.example .env.localdb
supabase status -o env   # copy ANON_KEY and SERVICE_ROLE_KEY into .env.localdb, and add a TOKEN_ENCRYPTION_KEY
npm run dev:localdb      # http://localhost:3210
```

`dev:localdb` (`scripts/dev-localdb.mjs`) loads `.env.localdb` over `.env.local`, so local database keys win and keys such as `GEMINI_API_KEY` still come from `.env.local`. Never copy local values into `.env.local`.

Load sources into the local database:

```bash
npx tsx --tsconfig tsconfig.json scripts/ingest.ts --env .env.localdb --list
npx tsx --tsconfig tsconfig.json scripts/ingest.ts grantsgov sam_opportunities --env .env.localdb --mode backfill
npx tsx --tsconfig tsconfig.json scripts/ingest.ts all --env .env.localdb --mode backfill
```

`--list` prints every source with its slot and the key it needs. Other options: `--limit N`, `--dry-run` (read the source and print sample rows without writing), and `--due hourly|daily|weekly|monthly` (the sources in one scheduled slot, as GitHub Actions runs them). Sources missing a key they need are skipped and say so.

Then:

```bash
npm run catalog:snapshot -- --env .env.localdb    # rewrites src/data/catalog-snapshot.json
npx tsx --tsconfig tsconfig.json scripts/data-quality.ts --env .env.localdb --out docs/data-quality-report.md
```

The snapshot holds each source's description and the counts in that database. `/data` and the home page show it, dated, when the app has no database (the zero-key demo). The data checks report open rows per source, deadline and link coverage, a polite live check of sample links, the duplicate rate, and search speed.

## Tests

Playwright runs every suite in `tests/`. Without `BASE_URL` it starts a dev server on port 3100 with recorded runs at ten times speed.

| Suites | Need |
| --- | --- |
| `smoke`, `crawl`, `a11y`, `responsive`, `demo`, `persistence`, `segments-flow` | The app in demo mode (no keys). |
| `logic`, `segments`, `tests/catalog` (each connector on recorded responses), `email`, `usage`, `crypto`, `firm-import`, `eval` | Nothing. Plain code. |
| `rls`, `jobs`, `search`, `embed`, `errors` | The local Supabase and `.env.localdb`. Skipped when it is not running. |
| `auth-real` | `REAL_BASE_URL=http://localhost:3210` with `npm run dev:localdb` running: sign-up by email link through Mailpit, sign out and in, and a direct upload to storage. |

Plain-code and database suites need no web server; point `BASE_URL` at a closed port to skip it:

```bash
BASE_URL=http://127.0.0.1:9 npx playwright test tests/catalog tests/logic.spec.ts tests/rls.spec.ts
```

The full run is faster and steadier on a production build:

```bash
npm run build
REPLAY_SPEED=10 npx next start -p 3100
BASE_URL=http://localhost:3100 npx playwright test --workers=4
```

## Costs

A full onboarding run (crawl, extraction, search planning, triage, scoring a dozen notices, one letter) comes to about five cents on the standard tier; redrafting a paragraph is under a cent. Actual figures for your key are on `/activity` and in the `agent_runs` table. Embedding the opportunity database is logged with each ingestion run. The public sources need no paid key.

The product is free. Each workspace has a monthly allowance of AI work, 50 drafts and 400 assistant runs, set in `src/lib/usage/limits.ts` and shown under Settings → Usage. The count starts again on the first of each month (UTC).
