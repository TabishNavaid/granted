# Firstlight (working name)

A done-for-you funding team for small nonprofits. AI agents find grants, draft proposals from the organization's own documents, write funder emails, and plan deadlines. The executive director reviews everything in one Inbox.

The product name lives in `src/lib/brand.ts`; change it there and it changes everywhere. Brand concepts and the chosen system are in [BRAND.md](BRAND.md).

This repository holds the P0 front end running on mock data, plus the schema, types, service contracts, and agent tool definitions the backend plugs into. See [ARCHITECTURE.md](ARCHITECTURE.md) and [prd.md](prd.md).

## Run it

```bash
npm install && npm run dev
```

Open http://localhost:3000. The marketing page is at `/`, the app at `/inbox`, the design system at `/design`, and every drawing with its credit at `/drawings-review`.

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
| `src/lib/agents` | Claude tool schemas, agent input and output types, and stub implementations. |
| `supabase/migrations` | Postgres schema with RLS, pgvector, and storage policies. |
| `src/app/globals.css` | Every design token: paper, ink, rules, the count, and the bloom animation. See BRAND.md. |
| `src/components/drawings` | The watercolor drawings (framing only): `Drawing`, `Bloom` (the small flower that opens on approval), `Meadow` (a strip of wildflowers), and `WonMeadow` (the Funded screen). Catalog in `src/lib/drawings.ts`, credits in `public/drawings/CREDITS.md`, look in `docs/design-references.md`. |
| `scripts/clean-drawing.mjs` | Cuts each drawing out of its paper and writes 2x PNG and WebP, the manifest, and the credits. |
| `src/components/marketing` | Landing page nav and the hero Inbox, which is the real Inbox component on a sheet of paper. |
