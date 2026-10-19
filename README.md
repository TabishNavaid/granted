# Firstlight

A done-for-you grants team for small nonprofits. Agents find open grants, draft proposals from the organization's own documents, write funder emails, and plan deadlines. The executive director reviews and approves everything from one Inbox.

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Gemini · Playwright

## What works

- **Onboarding from a website.** Crawls up to eight pages (PDFs included), extracts a profile and facts, and keeps only facts whose quoted excerpt is actually on the page and whose numbers appear in that excerpt.
- **Discovery on Grants.gov.** Keyword planning, hard eligibility filters, and fit scores whose reasons point to a fact and a quoted line of the notice. Requests are throttled to one per second and cached for six hours.
- **Private foundations from IRS 990-PF filings.** 390 foundations in Ohio, Kentucky, and North Carolina (public domain IRS data; see [docs/foundations-data.md](docs/foundations-data.md)), matched in plain code beside Grants.gov, with funder pages, trustees, peer organizations, "funders like you", suggested asks, and scholarship matching.
- **Grounded drafting.** Letters and proposal sections cite confirmed facts only. Unknown citations and unsourced numbers become highlighted gaps with a question attached; answering one saves the fact and redrafts the paragraph.
- **Proposal workspace.** TipTap editor with citation and gap nodes, reviewer check, budget, versions, milestones, and DOCX export.
- **Integrations.** Gmail and Outlook sending, Google Calendar push and an ICS feed, Stripe Checkout and portal, and a weekly digest through Resend.
- **Cost tracking.** Every model call is logged with token counts and cost on the Activity screen.

- **Learning and planning.** Win analytics from logged outcomes, decline reasons and lessons, a monthly planner that learns from them, an annual plan, impact metrics, a voice profile, and an Ask screen that answers from the workspace.

With no keys set, the app runs as a public demo: three fictional sample organizations, each visitor in their own session, and the agents replaying recorded runs through the live code (`src/lib/replay`). Grants.gov notices and foundation filings in the demo are real. To host it for free, see [docs/deploy-demo.md](docs/deploy-demo.md).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. The marketing site is at `/`, the app at `/inbox`, and the token and component gallery at `/design`.

To run against real services, copy `.env.example` to `.env.local` and follow [docs/setup.md](docs/setup.md). `GEMINI_API_KEY` alone is enough to run the agents with `DEMO_MODE=true`; add Supabase for sign-in and persistence.

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
| `npm test` | Playwright: smoke, route crawl, axe accessibility, responsive, demo flow, and plain-code logic suites. Starts a dev server on 3100 (recorded runs at ten times speed) unless `BASE_URL` is set. |
| `npx tsx --tsconfig tsconfig.json scripts/replay/check-letters.ts` | Runs every sample's recorded setup and letters through the live validators (set `REPLAY_SPEED=500`). |
| `npx tsx --tsconfig tsconfig.json scripts/replay/probe-foundations.ts` | Prints each sample's foundation matches with the grant behind each score, and the top three new matches, which need recorded letters (set `REPLAY_SPEED=500`). |
| `python3 -I scripts/foundations/build_foundations.py ...` | Rebuilds the foundation dataset from IRS files; see docs/foundations-data.md. |
| `npm run loop -- <domain>` | The real loop end to end, printed as a report. |
| `npm run drawings` | Rebuilds `public/drawings` from `scripts/drawings.json`. |

## Layout

| Path | What |
| --- | --- |
| `src/app` | Routes. `(marketing)` is the public site, `(app)` the signed-in product, `(auth)` sign in and sign up, `onboarding` the setup flow, `api` route handlers. |
| `src/components` | `ui` base components, `app` product components, `proposal` the workspace, `marketing` the site, `drawings` the watercolor accents. |
| `src/lib/services` | The data layer the UI calls. `contracts.ts` is the interface, `mock.ts` the in-memory adapter, `supabase.ts` the real one, `server.ts` the switch. |
| `src/lib/ai` | One `AiProvider` interface, the Gemini implementation with structured output and rate-limit backoff, and the price table. |
| `src/lib/loop` | Profile extraction, discovery, drafting with citation and number checks, and the features built on them. |
| `src/lib/crawl`, `src/lib/grantsgov` | Website reader and Grants.gov client. |
| `src/lib/integrations` | OAuth, Gmail, Outlook, Google Calendar, Stripe, and email adapters. |
| `src/lib/agents` | Tool schemas and typed contracts for agents that still run on stubs. |
| `supabase/migrations` | Postgres schema with row level security, pgvector, and storage policies. |
| `tests` | Playwright suites. |

The longer design, including the data model and the agent and job plan, is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Credits

The botanical watercolors are by Mary Vaux Walcott, from the Smithsonian American Art Museum, released as CC0 through Smithsonian Open Access. Details are in [public/drawings/CREDITS.md](public/drawings/CREDITS.md).
