# Firstlight (working name)

A done-for-you funding team for small nonprofits. AI agents find grants, draft proposals from the organization's own documents, write funder emails, and plan deadlines. The executive director reviews everything in one Inbox.

The product name lives in `src/lib/brand.ts`; change it there and it changes everywhere. Brand concepts and the chosen system are in [BRAND.md](BRAND.md).

This repository holds the P0 front end plus one real, thin, end-to-end loop: paste a website, confirm the facts we read from it, get open Grants.gov opportunities scored against those facts, and get a one-page letter of inquiry that cites only what you confirmed. See [ARCHITECTURE.md](ARCHITECTURE.md), [prd.md](prd.md), and the test report in [docs/real-loop-report.md](docs/real-loop-report.md).

## Run it

```bash
npm install && npm run dev
```

Open http://localhost:3000. The marketing page is at `/`, the app at `/inbox`, the design system at `/design`, and every drawing with its credit at `/drawings-review`. With no keys set, every screen runs on mock data (demo mode).

## Run the real loop

1. Copy `.env.example` to `.env.local`.
2. Add a `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey). The free tier is enough to try it; the agents back off on rate limits and tell you when to wait.
3. For real sign-in and persistence, create a Supabase project, run `supabase/migrations/0001_init.sql` then `0002_real_loop.sql` and `0003_features.sql` in the SQL editor, enable Email auth with magic links, add `http://localhost:3000/auth/callback` to the Auth redirect URLs, and fill in the three Supabase keys plus `NEXT_PUBLIC_SITE_URL`.
4. `npm run dev`, create a workspace at `/sign-up`, and paste a website at `/onboarding`.

To try the loop without a database, set `DEMO_MODE=true` with only the Gemini key. Onboarding then runs for real against in-memory state that resets when the server restarts.

Grants.gov needs no key. Requests are throttled to one per second and cached for six hours. Model calls go through `src/lib/ai/` (one interface, Gemini behind it), use structured JSON output, and every run is logged with tokens and cost on the Activity screen.

```bash
npm run loop -- riverbendyouth.org        # run the loop from the command line and print a report
```

```bash
npm run build
npm run lint
npx playwright test
npm run drawings
```

The smoke test opens every route and checks for console errors. It starts the dev server itself if one is not running. `npm run drawings` rebuilds the watercolor drawings in `public/drawings` from `scripts/drawings.json`.

## Where things are

| Path | What |
| --- | --- |
| `src/app` | Routes. `(app)` is the signed-in product, `(auth)` is sign in and sign up, `onboarding` is the setup flow, `design` is the token and component gallery. |
| `src/components/ui` | Base components built on the tokens: button, input, select, card, badge, tabs, dialog, toast, empty state, skeleton, data table, and so on. |
| `src/components/app` | Product components: Inbox item, plan form, fit score, citation chip, verified source, stage and milestone tags, sidebar, wordmark. |
| `src/components/proposal` | The proposal workspace: TipTap editor with citation and gap nodes, checklist, panels, export. |
| `src/lib/types` | Domain types mirroring the Postgres schema. |
| `src/lib/mock` | Fictional organization, funders, and agent output. |
| `src/lib/services` | The data layer the UI calls. `contracts.ts` is the interface, `mock.ts` the in-memory adapter, `server.ts` the single switch for Supabase. |
| `src/lib/agents` | Tool schemas, agent input and output types, and stubs for the agents that are not real yet. |
| `src/lib/ai` | The one model interface (`AiProvider`), the Gemini implementation, and the price table. |
| `src/lib/crawl` | Reads an organization's website into text, up to eight pages, PDFs included. |
| `src/lib/grantsgov` | Grants.gov search2 and fetchOpportunity, throttled and cached, mapped to our types. |
| `src/lib/loop` | The real loop: profile extraction, discovery, the letter with citation and number checks, and the stores it writes to. |
| `src/lib/supabase` | Server clients, session bootstrap, and the shared cache table. |
| `supabase/migrations` | Postgres schema with RLS, pgvector, and storage policies. |
| `src/app/globals.css` | Every design token: paper, ink, rules, the count, and the bloom animation. See BRAND.md. |
| `src/components/drawings` | The watercolor drawings (framing only): `Drawing`, `Bloom` (the small flower that opens on approval), `Meadow` (a strip of wildflowers), and `WonMeadow` (the Funded screen). Catalog in `src/lib/drawings.ts`, credits in `public/drawings/CREDITS.md`, look in `docs/design-references.md`. |
| `scripts/clean-drawing.mjs` | Cuts each drawing out of its paper and writes 2x PNG and WebP, the manifest, and the credits. |
| `src/components/marketing` | Landing page nav and the hero Inbox, which is the real Inbox component on a sheet of paper. |
