# FundFellows

One engine that finds, writes, and tracks applications for organizations that win work through applications and proposals: nonprofits (grants), architecture, engineering, and construction firms (bids, RFPs, and the SF 330), research teams (research funding), and individuals (scholarships). Every claim in a draft cites the applicant's own records, and nothing is sent, priced, or submitted for them.

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Gemini · Playwright

## What works

- **Onboarding from a website.** Crawls up to eight pages (PDFs included), extracts a profile and facts, and keeps only facts whose quoted excerpt is actually on the page and whose numbers appear in that excerpt. A nonprofit's EIN is checked against the IRS exempt organization registry.
- **One opportunity database.** Grants, bids, research funding, and scholarships from public sources, loaded into Postgres by scheduled jobs and refreshed hourly to monthly per source: Grants.gov, SAM.gov contract opportunities and Assistance Listings, the Federal Register, NIH, NSF, SBIR.gov, seven state and local open data portals, the EU, two UK services, the World Bank, hand-checked scholarships, IRS 990-PF filings, and past award totals from USAspending.gov, NIH RePORTER, NSF, and SBIR.gov (never who won). Duplicates across sources merge into one record that links to each listing. Every source, its terms, and its limits are in [docs/data-sources.md](docs/data-sources.md).
- **Discovery.** With Supabase, matching for every kind of applicant reads the database: full text search with hard eligibility filters, plus the closest matches by meaning when `GEMINI_API_KEY` is set. Fit scores give reasons that point to a fact and a quoted line of the notice. `CATALOG_MATCHING=off` switches back to the live Grants.gov and SAM.gov APIs for debugging.
- **Private foundations from IRS 990-PF filings, in every state.** Every foundation that paid grants, with giving and assets; for those giving at least `IRS_990PF_MIN_GIVING` a year (default $100,000), detail read from the return: how to apply, deadlines, typical grant sizes, focus areas, and up to 15 organization grantees. Matched in plain code beside federal notices, with funder pages, peer organizations, "funders like you", suggested asks, and scholarship matching.
- **Grounded drafting.** Letters and proposal sections cite confirmed facts only. Unknown citations and unsourced numbers become highlighted gaps with a question attached; answering one saves the fact and redrafts the paragraph. Long drafts run as background jobs that survive a page reload ([docs/jobs.md](docs/jobs.md)).
- **Proposal workspace.** TipTap editor with citation and gap nodes, reviewer check, budget, versions, milestones, and DOCX export.
- **Teams.** Owners, editors, and reviewers, enforced in the app and again in the database. Invitations arrive as a one-time sign-in link sent only to the invitee.
- **Integrations.** Gmail and Outlook sending (tokens encrypted at rest), Google Calendar push and an ICS feed, and a weekly digest and deadline reminders through Resend, each with a one-click unsubscribe.
- **Free, with a monthly allowance.** No billing. Each workspace gets a monthly allowance of AI work (`src/lib/usage/limits.ts`), shown under Settings, Usage. Every model call is logged with token counts and cost on the Activity screen.

- **Four kinds of applicant.** Setup asks who is applying first (nonprofit, firm, research team, individual) and every later step adapts. Opportunities have a kind (grant, contract or bid, research funding, scholarship) with its own stages, sections, dates, and eligibility rules, all in one registry (`src/lib/segments`).
- **Bids for AEC firms.** A firm knowledge base (company profile, portfolio, people with registrations, certifications, bonding, insurance, safety), with projects and staff importable from a spreadsheet (CSV, a paste from Excel, or .xlsx, checked in a preview before saving). Add an RFP by link, PDF (read page by page), or text: plain rules build a compliance matrix with the quoted sentence and page for every requirement, so it works with no model key. Go/no-go with reasons and stoppers, drafting from records (projects, résumés, references, schedule, quality and safety built in code; cover letter, qualifications, and approach by the model), the SF 330 with a Word export, a fee proposal structure that never fills in a price, addenda tracking, bid deadlines, bid pipeline stages, and win analytics by client, sector, and project size. Contract opportunities come from the database (SAM.gov and the state and local portals), with saved bid searches by NAICS code, state, set-aside, and keyword whose new results join the weekly digest, and a market panel on each bid that shows who buys this kind of work and typical award sizes from federal award totals. Grants open to firms are on a separate tab.
- **Research teams.** Federal research notices open to universities, funded NSF and NIH projects like the team's (no keys needed), proposals in the standard sections with biosketches and facilities from records, and each funder's AI rule on the checklist with sources.
- **Individuals.** A résumé becomes a profile; scholarship funds from 990-PF filings; essays from the person's own experiences, asking instead of inventing.

- **Learning and planning.** Win analytics from logged outcomes, decline reasons and lessons, a monthly planner that learns from them, an annual plan, impact metrics, a voice profile, and an Ask screen that answers from the workspace.
- **Operations.** Security headers and a content policy (`next.config.ts`), server and browser errors grouped in the database and shown at `/admin/errors`, and the ingestion log at `/admin/ingestion`, both for the addresses in `ADMIN_EMAILS`.

With no keys set, the app runs as a public demo: six fictional samples (three nonprofits, an AEC firm, a university lab, a student), and the agents replaying recorded runs through the live code (`src/lib/replay`). The demo runs in the visitor's browser: their workspaces are saved in localStorage, recorded runs play back in the tab, and pages render from that state, so the server keeps nothing and the demo runs on serverless hosts (`src/lib/demo`). Grants.gov and SAM.gov notices, the sample VA solicitation, NSF and NIH funded projects, and foundation filings in the demo are real (see [docs/segments-data.md](docs/segments-data.md)). The demo's foundations are a smaller three-state set in `src/data/foundations.json` ([docs/foundations-data.md](docs/foundations-data.md)), and the source counts on `/data` and the home page come from a dated snapshot, `src/data/catalog-snapshot.json`. To host it on Vercel, see [docs/deploy-demo.md](docs/deploy-demo.md).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The marketing site is at `/`, the app at `/inbox`, and the token and component gallery at `/design`.

To run against real services, copy `.env.example` to `.env.local` and follow [docs/setup.md](docs/setup.md). `GEMINI_API_KEY` alone is enough to run the agents with `DEMO_MODE=true`; add Supabase for sign-in and persistence.

To work on the database without touching the real project, run a local Supabase (Docker and the Supabase CLI) and `npm run dev:localdb`; [docs/setup.md](docs/setup.md#local-database) has the steps. To set up the real project, put its keys in `.env.local` and run `npm run launch:db`: it applies the migrations, configures sign-in and email, and loads the opportunity database.

```bash
npm run loop -- riverbendyouth.org   # run onboarding, discovery, and the letter from the CLI
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 (or `PORT`). |
| `npm run build` / `npm start` | Production build and server. |
| `npm run lint` | ESLint. |
| `npx tsc --noEmit` | Type check. |
| `npm test` | Playwright: the browser suites on the demo, plain-code suites, and database suites against the local Supabase (skipped when it is not running). Starts a dev server on 3100 (recorded runs at ten times speed) unless `BASE_URL` is set. See [docs/setup.md](docs/setup.md#tests). |
| `npm run dev:localdb` | Dev server on port 3210 against the local Supabase, with the keys in `.env.localdb`. |
| `npm run launch:db` | Sets up the real Supabase project from `.env.local`: migrations, auth settings, backfill, size report. `--dry-run` prints the plan. |
| `npm run ingest -- <source...\|all>` | Loads sources into the opportunity database. `--list` shows every source, its slot, and its key; `--due hourly\|daily\|weekly\|monthly` is what the scheduled jobs run; `--env .env.localdb` targets the local database. |
| `npm run catalog:snapshot -- --env .env.localdb` | Rewrites `src/data/catalog-snapshot.json` from the connectors and the counts in that database. |
| `npm run email:templates` | Regenerates the Supabase auth email templates in `supabase/templates` from `src/lib/email`. |
| `npx tsx --tsconfig tsconfig.json scripts/data-quality.ts --env .env.localdb` | Data checks on the opportunity database: deadlines, links, duplicates, search speed. `--out FILE` writes the report. |
| `npx tsx --tsconfig tsconfig.json scripts/eval-drafts.ts eval/` | Compares drafts with a design partner's winning proposals, one folder per case. `eval/` is gitignored. |
| `npx tsx --tsconfig tsconfig.json scripts/replay/check-letters.ts` | Runs every sample's recorded setup and letters through the live validators (set `REPLAY_SPEED=500`). |
| `npx tsx --tsconfig tsconfig.json scripts/replay/probe-foundations.ts` | Prints each sample's foundation matches with the grant behind each score, and the top three new matches, which need recorded letters (set `REPLAY_SPEED=500`). |
| `npx tsx --tsconfig tsconfig.json scripts/replay/check-bids.ts` | Runs the sample firm's bid end to end (RFP to matrix, go/no-go, draft, addenda, SF 330, SAM.gov) through the live code (set `REPLAY_SPEED=500`). |
| `python3 -I scripts/samgov/convert_capture.py CAPTURE_DIR OUT.json` | Maps a keyless SAM.gov capture to the official Opportunities API v2 fields for the demo; see docs/segments-data.md. |
| `python3 -I scripts/foundations/build_foundations.py ...` | Rebuilds the demo's foundation dataset from IRS files; see docs/foundations-data.md. |
| `npm run loop -- <domain>` | The real loop end to end, printed as a report. |

## Layout

| Path | What |
| --- | --- |
| `src/app` | Routes. `(marketing)` is the public site, `(app)` the signed-in product, `(auth)` sign in and sign up, `onboarding` the setup flow, `api` route handlers. A product page's body lives in `render.tsx` next to its `page.tsx`, so the same code renders on the server or in the browser demo. |
| `src/components` | `ui` base components, `app` product components, `proposal` the workspace, `marketing` the site, `brand` the logo and the approval mark. |
| `src/lib/services` | The data layer the UI calls. `contracts.ts` is the interface, `mock.ts` the in-memory adapter, `supabase.ts` the real one, `server.ts` the switch. |
| `src/lib/demo`, `src/components/demo` | The browser demo: the flag the server sets, the runtime that runs the in-memory adapter in the tab and saves it (`demo-session.ts` in services), and the page and layout shells that render each page's `render.tsx` in the browser. |
| `src/lib/ai` | One `AiProvider` interface, the Gemini implementation with structured output and rate-limit backoff, and the price table. |
| `src/lib/loop` | Profile extraction, discovery, drafting with citation and number checks, and the features built on them. |
| `src/lib/crawl`, `src/lib/grantsgov` | Website reader and Grants.gov client (which reads the opportunity database when it is active). |
| `src/lib/catalog` | The opportunity database. `connectors` has one module per source, `ingest` the polite fetcher, store, runner, and embedding fill, `schedule.ts` the slot each source runs in, and `app.ts` the app's read side. |
| `src/lib/jobs`, `src/lib/email`, `src/lib/usage`, `src/lib/crypto`, `src/lib/errors` | Background jobs, the email renderer and templates with signed unsubscribe links, monthly AI allowances, OAuth token encryption, and the error log. |
| `src/lib/integrations` | OAuth, Gmail, Outlook, Google Calendar, and email adapters. |
| `src/lib/agents` | Labels for agents, stages, and milestones, and the demo's inline revise stub. |
| `src/lib/segments` | The registry of applicant types and opportunity kinds, setup and discovery for firms, research teams, and individuals. |
| `src/lib/bids` | RFP reader, compliance matrix, go/no-go, project and personnel selection, sections built from records, SF 330 and its Word export, fee structure, addenda, and the bid workflow over a store. |
| `src/lib/firm`, `src/lib/research`, `src/lib/person`, `src/lib/samgov` | Firm records as citable facts; NSF and NIH lookups and funders' AI rules; résumés and essays; the SAM.gov client. |
| `src/app/admin` | Operator pages: `/admin/ingestion` and `/admin/errors`, for `ADMIN_EMAILS` only. |
| `supabase/migrations`, `supabase/templates`, `supabase/config.toml` | Postgres schema with row level security, pgvector, and storage policies; the auth email templates; the local stack's ports. |
| `.github/workflows` | CI, scheduled ingestion, and the sweeper that restarts stalled jobs. |
| `tests` | Playwright suites; `tests/catalog` runs each connector on recorded responses. |

The longer design, including the data model and the agent and job plan, is in [ARCHITECTURE.md](ARCHITECTURE.md).
