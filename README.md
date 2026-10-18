# Firstlight (working name)

A done-for-you funding team for small nonprofits. AI agents find grants, draft proposals from the organization's own documents, write funder emails, and plan deadlines. The executive director reviews everything in one Inbox.

The product name lives in `src/lib/brand.ts`; change it there and it changes everywhere. Brand concepts and the chosen system are in [BRAND.md](BRAND.md).

This repository holds the P0 front end running on mock data, plus the schema, types, service contracts, and agent tool definitions the backend plugs into. See [ARCHITECTURE.md](ARCHITECTURE.md) and [prd.md](prd.md).

## Run it

```bash
npm install && npm run dev
```

Open http://localhost:3000. The marketing page is at `/`, the app at `/inbox`, and the design system at `/design`.

```bash
npm run build
npm run lint
npx playwright test
```

The smoke test opens every route and checks for console errors. It starts the dev server itself if one is not running.

## Where things are

| Path | What |
| --- | --- |
| `src/app` | Routes. `(app)` is the signed-in product, `(auth)` is sign in and sign up, `onboarding` is the setup flow, `design` is the token and component gallery. |
| `src/components/ui` | Base components built on the tokens: button, input, select, card, badge, tabs, dialog, toast, empty state, skeleton, data table, and so on. |
| `src/components/app` | Product components: Inbox item, fit score, citation chip, verified source, stage and agent badges, sidebar. |
| `src/components/proposal` | The proposal workspace: TipTap editor with citation and gap nodes, checklist, panels, export. |
| `src/lib/types` | Domain types mirroring the Postgres schema. |
| `src/lib/mock` | Fictional organization, funders, and agent output. |
| `src/lib/services` | The data layer the UI calls. `contracts.ts` is the interface, `mock.ts` the in-memory adapter, `server.ts` the single switch for Supabase. |
| `src/lib/agents` | Claude tool schemas, agent input and output types, and stub implementations. |
| `supabase/migrations` | Postgres schema with RLS, pgvector, and storage policies. |
| `src/app/globals.css` | Every design token, dawn (light) and night (dark). |
| `src/components/brand` | Hand-drawn SVG scenes and glyphs: dawn scene, lantern, sealed letter, seedling, sunrise, margin notes, photo slots. |
| `src/components/marketing` | Landing page nav and the live demo components. |
