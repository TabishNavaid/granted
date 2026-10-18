# Architecture

The product (working name in `src/lib/brand.ts`) is a Next.js App Router front end that talks to a thin service layer. The backend is Supabase (Postgres, auth, storage, pgvector), a job runner for agent runs, and the Claude API with tool use. Agents never talk to the user directly; every output lands in the Inbox as a row the user approves, edits, or rejects.

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
  lib/agents                  tools.ts (Claude tool schemas), index.ts (typed stubs), meta.ts (labels)
supabase/migrations           0001_init.sql
tests/smoke.spec.ts           One Playwright test: every route renders
```

Why one `services` object: the UI imports `services` and nothing else. In the browser each call becomes a server action, so mock state lives in one place and survives navigation. Replacing the mock with Supabase touches `src/lib/services/server.ts` only.

## 2. Data model

The full schema is in `supabase/migrations/0001_init.sql`. Every org-scoped table carries `org_id` and is protected by row level security through `is_org_member()`. Funders, opportunities, and contacts are shared reference data written only by the ingest job.

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
| email_drafts | Outreach drafts the user sends themselves | No send path exists in P0 |
| outcomes | Won, lost, no response, withdrawn, with award and feedback | Feeds the planner |
| monthly_plans, inbox_items, agent_runs | Orchestration | `inbox_items.payload` is a typed JSON union (see `InboxPayload`) |
| subscriptions, notification_settings | Billing and preferences | Stripe ids live here |

TypeScript types in `src/lib/types/index.ts` mirror these tables in camelCase. The Supabase adapter is the only place that maps column names.

## 3. API routes

All routes are under `/api` and are thin: validate input, check membership, call a service or enqueue a job. The UI does not call them directly in P0 (it uses server actions through `services`), but webhooks, the job runner, and future clients need them.

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
| GET /api/billing, POST /api/billing/checkout, POST /api/billing/portal | Stripe |
| POST /api/webhooks/stripe, POST /api/webhooks/jobs | Inbound webhooks |
| POST /api/team/invite | Invite a teammate |

## 4. Agents

Every agent runs as a job with a Claude tool-use loop. Tool schemas are in `src/lib/agents/tools.ts`; `agentToolsets` lists which tools each agent gets. Each run writes an `agent_runs` row with tools called, sources used, and cost, and ends by calling `create_inbox_item` or writing rows that the UI reads.

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

## 5. Background jobs

Jobs run on Inngest or Trigger.dev (either works; the contract is a named event with a JSON payload and retries).

| Job | Trigger | Flow |
| --- | --- | --- |
| profile.build | Onboarding step 1 | fetch website, pull 990 from public data, run Profile agent, write facts and boilerplate, mark onboarding step |
| documents.extract | Storage upload complete | extract text, chunk, embed into document_chunks, run Profile agent in update mode, propose fact updates to Inbox |
| discovery.weekly | Cron, Monday 06:00 org local time | run Discovery agent, create matches, send digest email through Resend |
| planner.monthly | Cron, 1st of month 06:00 | run Planner agent, write monthly_plan and Inbox item |
| plan.approved | Inbox approve on monthly_plan | for each kept item: create application, enqueue proposal.draft and calendar.plan |
| proposal.draft | Application created or user asks | run Proposal agent, write requirements, sections, missing_facts, compliance_checks, Inbox items |
| calendar.plan | Application created | run Calendar agent, write milestones as a pending Inbox item; on approve, schedule reminders |
| reminders.send | Cron, hourly | find milestones due in `reminder_days_before`, email via Resend, set reminder_sent_at |
| outreach.draft | Application reaches Researching, or outcome logged | run Outreach agent for a question, thank-you, or follow-up email |
| funders.ingest | Cron, nightly | pull Grants.gov and IRS 990 bulk data, upsert funders and opportunities, set last_verified_at |
| export.build | Export requested | render DOCX (docx) or PDF (headless Chromium), upload to storage, return signed URL |

## 6. Backend build order

1. Supabase project: apply `0001_init.sql`, enable email auth, create the `documents` bucket. Wire the Supabase adapter into `src/lib/services/server.ts` for org, members, billing, and notification settings. Sign in and settings work end to end.
2. Documents and knowledge: upload to storage, `documents.extract` job, embeddings, `facts` and `boilerplates` CRUD. Profile page runs on real data.
3. Profile agent and onboarding: `fetch_url`, 990 lookup, interview, fact extraction with sources. Onboarding produces a real profile.
4. Funder ingest: Grants.gov API and IRS 990 bulk data into `funders` and `opportunities` with verification dates. Eligibility rules stored as structured JSON.
5. Discovery agent and weekly job: matches with scores and reasons, digest email. Opportunities page runs on real data.
6. Applications and the Proposal agent: guidelines fetch, requirement parsing, grounded drafting with citations, missing facts, compliance checks, `revise_text`. Workspace runs on real data.
7. Inbox and orchestration: `inbox_items` with the typed payload union, approve and reject side effects, Planner agent and monthly job.
8. Calendar agent, milestones, and reminders through Resend.
9. Outreach agent and email drafts.
10. Pipeline stages and outcomes; feed outcomes into the planner's scoring.
11. Export: DOCX and PDF rendering with citation chips stripped and gaps marked.
12. Stripe: plans, checkout, portal, webhook, usage limits enforced in the job runner.
13. Eval set: ten real past proposals from early users; run the Proposal agent against them on every prompt change and track draft acceptance rate.
