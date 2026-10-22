# Architecture

Sections 3 and 4 are the target design: the README lists what is implemented today, and several API routes and the stubbed agents there are planned. Sections 5 and 7 describe what runs now.

The product (working name in `src/lib/brand.ts`) is a Next.js App Router front end that talks to a thin service layer. The backend is Supabase (Postgres, auth, storage, pgvector), a shared opportunity database loaded by scheduled jobs, background jobs in Postgres for long agent runs, and a model provider behind `src/lib/ai` (Gemini today) called with tool use and structured output. Agents never talk to the user directly; every output lands in the Inbox as a row the user approves, edits, or rejects.

## 1. Folder structure

```
src/
  app/
    page.tsx                  Marketing landing
    (auth)/sign-in, sign-up   Auth screens (UI only)
    onboarding/               Five steps: website and EIN, documents, interview, profile, matches
    (app)/                    Signed-in product, shares the sidebar layout
      inbox/                  Home. Monthly plan plus every pending agent output
      opportunities/[id]      Ranked matches and funder detail
      applications/[id]       Proposal workspace
      pipeline/ calendar/ profile/ activity/ settings/
      connections/ social/    P1, shown as coming soon
    design/                   Every token and component in every state
  components/ui               Base components on the tokens (shadcn-style, Radix primitives)
  components/app              Product components (Inbox item, fit score, citation chip, ...)
  components/proposal         Editor, checklist, panels, export
  lib/types                   Domain types, one per table
  lib/mock                    Fictional seed data
  lib/services                contracts.ts (interfaces), mock.ts (adapter), server.ts (switch), index.ts (proxy)
  lib/agents                  tools.ts (tool schemas), index.ts (typed stubs), meta.ts (labels)
  lib/catalog                 The opportunity database: connectors, ingest, schedule, the app's read side
  lib/jobs, lib/email         Background jobs; email rendering, templates, unsubscribe
scripts/                      ingest.ts, launch-db.ts, catalog-snapshot.ts, data-quality.ts, eval-drafts.ts
supabase/migrations           0001_init.sql through 0014_errors.sql
.github/workflows             ci.yml, ingest.yml, sweep-jobs.yml
tests/                        Playwright: browser suites on the demo, plain-code suites, database suites
```

Why one `services` object: the UI imports `services` and nothing else. In the browser each call becomes a server action, so mock state lives in one place and survives navigation. Replacing the mock with Supabase touches `src/lib/services/server.ts` only.

## 2. Data model

The schema starts in `supabase/migrations/0001_init.sql`; later migrations add to it in order. Every org-scoped table carries `org_id` and is protected by row level security (section 7). Funders, opportunities, and contacts are shared reference data that signed-in users read and only the server writes, when a match copies a row in from the opportunity database or a live source.

| Table | Purpose | Note |
| --- | --- | --- |
| organizations, profiles, org_members | Workspace and team | Roles: owner, editor, reviewer |
| documents, document_chunks | Uploaded files and their embedded chunks | pgvector HNSW index for grounded drafting |
| facts | Every number an agent may use, with source document, excerpt, page, confidence, status | Facts without a source are rejected at the tool level |
| boilerplates | Versioned reusable paragraphs | New row per version, `parent_id` links history |
| funders, opportunities, contacts | Reference data with `source_url` and `last_verified_at` | The model never names a funder from memory |
| matches | Org to opportunity with fit score, reasons, cautions, eligibility checks | Unique per org and opportunity |
| applications, requirements, sections, citations, missing_facts, compliance_checks | One application and everything the Proposal agent produces | Sections store TipTap HTML; citation and gap nodes are inline spans |
| milestones | Backward-planned dates with reminder state | Reminder job reads `reminder_sent_at` |
| email_drafts | Outreach drafts | Sent only when the user sends them, from their own Gmail or Outlook |
| outcomes | Won, lost, no response, withdrawn, with award and feedback | Feeds the planner |
| monthly_plans, inbox_items, agent_runs | Orchestration | `inbox_items.payload` is a typed JSON union (see `InboxPayload`) |
| notification_settings, email_opt_outs | Preferences | Digest and reminder switches; one-click unsubscribes per person and workspace |
| saved_searches | Saved keyword searches and bid searches | A row with `filters` (NAICS, states, set-asides, keywords) is a bid search |
| jobs | Long work a person started | Progress, heartbeat, result, attempts (section 5) |
| integration_connections | Connected Gmail, Outlook, and Calendar accounts | Tokens encrypted with `TOKEN_ENCRYPTION_KEY`; server only |
| app_errors | Server and browser errors grouped by fingerprint | Service role only; shown at `/admin/errors` |
| catalog_* | The shared opportunity database | Section 7 |

TypeScript types in `src/lib/types/index.ts` mirror these tables in camelCase. The Supabase adapter is the only place that maps column names.

## 3. API routes

All routes are under `/api` and are thin: validate input, check membership, call a service or enqueue a job. The UI mostly uses server actions through `services`. Route handlers that exist today: `/api/uploads/sign` (a one-time URL so the browser uploads straight to private storage), `/api/documents/upload`, `/api/import/sheet` (reads a spreadsheet for the firm import preview), `/api/progress/[jobId]`, `/api/cron/digest`, `/api/cron/reminders`, `/api/cron/jobs`, `/api/email/unsubscribe`, `/api/errors`, `/api/contact`, the OAuth callbacks under `/api/integrations`, the SF 330 Word export, RFP, addendum, and résumé uploads, the ICS calendar feed, and the demo. The table below is the fuller target.

| Method and path | Does |
| --- | --- |
| POST /api/onboarding/start | Save website and EIN, enqueue `profile.build` |
| POST /api/documents | Create document row and signed upload URL; enqueue `documents.extract` on upload complete |
| DELETE /api/documents/:id | Remove document, chunks, and orphaned facts |
| POST /api/interview/answer | Store an interview answer, return the next question |
| GET /api/facts, PATCH /api/facts/:id, POST /api/facts/:id/confirm | Knowledge base |
| GET /api/boilerplates, POST /api/boilerplates/:id/versions | Versioned boilerplate |
| GET /api/matches, PATCH /api/matches/:id | Ranked matches, save or dismiss |
| GET /api/opportunities/:id | Opportunity with funder and public contacts |
| POST /api/applications | Start an application from an opportunity; enqueue `proposal.draft` |
| GET /api/applications/:id/workspace | Requirements, sections, questions, checks, facts |
| PATCH /api/sections/:id | Save section HTML; recompute word count checks |
| POST /api/sections/:id/revise | Inline AI action (rewrite, shorten, expand, tone) |
| POST /api/missing-facts/:id/answer | Store answer, create a fact with the user as source, replace the gap node |
| POST /api/applications/:id/compliance | Run compliance check now |
| POST /api/applications/:id/export | Build DOCX or PDF, return a signed download URL |
| PATCH /api/applications/:id/stage, POST /api/applications/:id/outcome | Pipeline and outcomes |
| GET /api/inbox, POST /api/inbox/:id/approve, POST /api/inbox/:id/reject | Review Inbox |
| GET /api/plans/current, PATCH /api/plans/:id/items | Monthly plan decisions |
| GET /api/milestones, PATCH /api/milestones/:id | Calendar |
| GET /api/agent-runs, GET /api/agent-runs/:id | Activity log |
| POST /api/webhooks/jobs | Inbound webhooks |
| POST /api/team/invite | Invite a teammate |

## 4. Agents

Every agent runs as a job with a tool-use loop against the model provider. Tool schemas are in `src/lib/agents/tools.ts`; `agentToolsets` lists which tools each agent gets. Each run writes an `agent_runs` row with tools called, sources used, and cost, and ends by calling `create_inbox_item` or writing rows that the UI reads.

| Agent | Purpose | Inputs | Outputs | Tools |
| --- | --- | --- | --- | --- |
| Profile | Build and maintain the knowledge base | website URL, EIN, document ids, interview answers | profile fields, facts with sources, boilerplate versions, follow-up questions, proposed fact updates | fetch_url, extract_document_text, get_facts, upsert_fact, propose_fact_update, upsert_boilerplate, ask_user |
| Discovery | Weekly scan for eligible opportunities | org id, mode (weekly or onboarding) | matches with fit score, reasons, cautions, eligibility checks; a `new_matches` Inbox item | get_org_profile, get_facts, search_opportunities, check_eligibility, fetch_url, score_fit, create_match |
| Planner | Propose the month's applications | org id, month, hours available | a `monthly_plans` row and `monthly_plan` Inbox item | list_matches, list_applications, estimate_effort, create_inbox_item |
| Proposal | Parse guidelines and draft a grounded proposal | application id, ask amount | requirements, sections with citation and gap nodes, missing facts, compliance checks; `proposal_draft` and `missing_facts` Inbox items | fetch_guidelines, parse_requirements, get_facts, get_boilerplate, search_knowledge, draft_section, flag_missing_fact, run_compliance_check, revise_text |
| Outreach | Draft funder emails | funder id, application id, email kind | an `email_drafts` row and `email_draft` Inbox item | get_funder, get_contacts, get_application_summary, draft_email |
| Calendar | Plan milestones backward from a deadline | application id, deadline, effort, board review flag | milestones and reminders; `milestones` Inbox item | get_deadline, plan_milestones, create_milestones, schedule_reminder |

Rules enforced in tool handlers, not prompts: `upsert_fact` rejects facts without a source document; `search_opportunities` is the only source of funders; `draft_section` rejects a claim without a citation or gap; nothing sends email or touches a portal.

Inline editor actions call `revise_text`, which must return citation and gap nodes unchanged. The stub in `src/lib/agents/index.ts` protects those nodes with placeholders and the real handler does the same before and after the model call.

## 5. Background work

Details are in [docs/jobs.md](docs/jobs.md).

Long work a person starts (reading a website, scoring matches, reading a long RFP, drafting a letter, proposal, bid, or essay) runs as a row in `jobs` (migration 0011). The server writes the row, answers at once, and runs the step with `after()` as the person who started it, so row level security applies as if they had clicked (`src/lib/jobs/runner.ts`). Progress is written to the row; the browser polls `/api/progress/[jobId]`, so any server instance can answer. A sweeper (`/api/cron/jobs`, called every ten minutes by `.github/workflows/sweep-jobs.yml`) restarts a step whose heartbeat stopped, up to three tries. The zero-key demo runs its steps in the visitor's tab instead.

| Scheduled work | Where | When |
| --- | --- | --- |
| Opportunity database ingestion | GitHub Actions, `ingest.yml` | Hourly, daily, weekly, and monthly slots (section 7) |
| Restart stalled jobs | GitHub Actions, `sweep-jobs.yml` | Every ten minutes |
| Weekly digest | Vercel Cron, `/api/cron/digest` | Mondays 13:00 UTC |
| Milestone reminders | Vercel Cron, `/api/cron/reminders` | Daily 12:00 UTC |

Ingestion stays out of Vercel because its downloads run to hundreds of megabytes and many minutes. There is no hosted queue: Postgres and `after()` cover the load and keep every job visible in the database.

## 6. Backend build order

1. Supabase project: apply the migrations (which create the `documents` bucket) and configure email auth; `npm run launch:db` does both and the backfill. Wire the Supabase adapter into `src/lib/services/server.ts` for org, members, and notification settings. Sign in and settings work end to end.
2. Documents and knowledge: upload to storage, text extraction, embeddings, `facts` and `boilerplates` CRUD. Profile page runs on real data.
3. Profile agent and onboarding: `fetch_url`, 990 lookup, interview, fact extraction with sources. Onboarding produces a real profile.
4. Opportunity database: a connector per public source into the `catalog_*` tables with verification dates, scheduled ingestion, and matching that reads it (section 7).
5. Discovery agent and weekly job: matches with scores and reasons, digest email. Opportunities page runs on real data.
6. Applications and the Proposal agent: guidelines fetch, requirement parsing, grounded drafting with citations, missing facts, compliance checks, `revise_text`. Workspace runs on real data.
7. Inbox and orchestration: `inbox_items` with the typed payload union, approve and reject side effects, Planner agent and monthly job.
8. Calendar agent, milestones, and reminders through Resend.
9. Outreach agent and email drafts.
10. Pipeline stages and outcomes; feed outcomes into the planner's scoring.
11. Export: DOCX and PDF rendering with citation chips stripped and gaps marked.
12. Usage: a monthly allowance of AI work per workspace (src/lib/usage/limits.ts), enforced where every run is recorded.
13. Eval set: a design partner's winning proposals beside our drafts for the same solicitations, compared by `scripts/eval-drafts.ts` (plain measures always, model scoring against the evaluation criteria with a key). The material stays in the gitignored `eval/` folder. Run it on every prompt change.

## 7. Opportunity database, email, and security

### Opportunity database

One set of `catalog_*` tables (migration 0006) holds every grant, bid, research funding notice, and scholarship from public sources, normalized into one model: sources, funders and buying agencies, giving history, opportunities (with a weighted full text column and a 768-dimension embedding), a history of changes to the fields people plan around, past award totals, and the ingestion log. Past awards are aggregates only; who won a contract is never stored. The IRS exempt organization registry (about two million rows) is not in Postgres: the ingestion job writes it as small gzip shards by EIN prefix to the private `registry` bucket (migration 0007), and setup reads one shard to check an EIN (`src/lib/catalog/registry.ts`).

Ingestion (`src/lib/catalog`):

- `connectors/` has one module per source, each exporting `connectors`. Each source declares its schedule, priority, license, and any key it needs. Modules load on demand, so one broken source never stops the others.
- `ingest/http.ts` is the polite fetcher: an identifying User-Agent, a minimum gap per host, robots.txt honored, backoff on 429 and 5xx, and timeouts. `ingest/store.ts` writes over a direct Postgres connection (`DATABASE_URL` or `SUPABASE_DB_URL`) as the database owner. `ingest/runner.ts` runs a connector into the database or into memory for tests and dry runs, and logs each run in `catalog_ingest_runs`. `ingest/embed.ts` fills missing embeddings after a run when `GEMINI_API_KEY` is set, capped by `CATALOG_EMBED_MAX`.
- `schedule.ts` maps each source's cron to the hourly, daily, weekly, or monthly slot that `scripts/ingest.ts --due` runs. Full-snapshot sources close notices that disappear; others read incrementally. Expired notices close after each run, and duplicates across sources merge under the highest-priority source.
- `app.ts` is the read side. When the app runs on Supabase and `CATALOG_MATCHING` is not `off`, discovery for every applicant type reads here: `catalog_search` for full text with filters, plus `catalog_match_embedding` for the closest matches by meaning. The demo keeps its recorded runs.

Sources, terms, and refresh rules are in [docs/data-sources.md](docs/data-sources.md).

### Email

`src/lib/email` renders every email from one layout, as HTML and a plain-text twin. The Supabase auth templates in `supabase/templates` are generated from it by `scripts/email-templates.ts`, so sign-in mail matches the rest. Non-essential mail carries an HMAC-signed one-click unsubscribe link (`EMAIL_SIGNING_SECRET`) that writes to `email_opt_outs`. Invitations use `auth.admin.generateLink` and go only to the invitee, so the inviter never holds a link that signs in as someone else.

### Security model

- Row level security on every table. Members of a workspace read its rows through `is_org_member()`; only owners and editors write them directly through `is_org_editor()` (migration 0010). Reviewers read, comment, and approve through the app. The server checks roles too, so this is defense in depth against anyone using a session token against the REST API.
- Shared reference data (`catalog_*` except the log, funders, opportunities, contacts) is readable by signed-in users and written only by the server or ingestion.
- Service role only, with no user policy at all: `catalog_ingest_runs`, `integration_connections`, `email_opt_outs`, `app_errors`, and the `registry` bucket. A few `security definer` functions with a fixed search path expose public counts to anonymous visitors.
- Profiles are readable only by the person and their workspace colleagues (migration 0009). Workspace files live under `<org_id>/` in the private `documents` bucket; the browser uploads there directly with a one-time signed URL.
- OAuth tokens are encrypted with AES-256-GCM before they reach the database (`src/lib/crypto/tokens.ts`).
- `next.config.ts` sets a content security policy, HSTS, frame denial, and related headers. Errors from `src/instrumentation.ts` and `src/instrumentation-client.ts` (through `/api/errors`) are scrubbed of emails and long tokens and grouped in `app_errors`. `/admin/ingestion` and `/admin/errors` return 404 to any signed-in person not in `ADMIN_EMAILS`.
- Tests prove it against a real Postgres: `tests/rls.spec.ts` checks that one workspace can never read or change another's data.
