-- Granted: initial schema
-- Postgres 15 on Supabase. Enables pgvector for knowledge search.
-- Every org-scoped table carries org_id and is protected by RLS keyed on org membership.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------- Enums ----------
create type document_type as enum ('annual_report','past_proposal','form_990','budget','board_list','determination_letter','other');
create type document_status as enum ('uploaded','extracting','ready','failed');
create type fact_category as enum ('reach','outcomes','finance','organization','geography','people');
create type fact_status as enum ('confirmed','needs_review','stale');
create type boilerplate_type as enum ('mission','history','program','staff_bio','evaluation','budget_narrative','need_statement');
create type funder_type as enum ('private_foundation','community_foundation','corporate','federal','state','family_fund');
create type deadline_type as enum ('fixed','rolling','loi');
create type match_status as enum ('new','saved','dismissed','applying');
create type application_stage as enum ('discovered','researching','drafting','review','submitted','won','lost');
create type requirement_kind as enum ('section','attachment','format','eligibility');
create type section_status as enum ('drafted','edited','approved','needs_facts','empty');
create type missing_fact_status as enum ('open','answered','skipped');
create type compliance_status as enum ('pass','warn','fail');
create type milestone_kind as enum ('deadline','draft_due','board_review','budget_signoff','submit','follow_up');
create type agent_name as enum ('profile','discovery','planner','proposal','outreach','calendar');
create type inbox_item_type as enum ('monthly_plan','proposal_draft','email_draft','new_matches','milestones','missing_facts','profile_update');
create type inbox_status as enum ('pending','approved','rejected','edited');
create type agent_run_status as enum ('queued','running','succeeded','failed');
create type agent_trigger as enum ('schedule','user','event');
create type outcome_result as enum ('won','lost','no_response','withdrawn');
create type email_kind as enum ('intro','question','loi_cover','thank_you','follow_up');
create type plan_tier as enum ('free','starter','growth');
create type member_role as enum ('owner','editor','reviewer');
create type member_status as enum ('active','invited');
create type effort_level as enum ('low','medium','high');

-- ---------- Workspace ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text,
  website_url text,
  mission text,
  annual_budget numeric(14,2),
  fiscal_year_end text,
  founded_year int,
  city text,
  state text,
  service_area text,
  causes text[] not null default '{}',
  populations text[] not null default '{}',
  staff_count int,
  volunteer_count int,
  onboarding_step text not null default 'start',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_email text,
  role member_role not null default 'editor',
  status member_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ---------- Knowledge base ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type document_type not null default 'other',
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  status document_status not null default 'uploaded',
  page_count int,
  extracted_text text,
  uploaded_at timestamptz not null default now()
);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  chunk_index int not null,
  page int,
  content text not null,
  embedding vector(1536)
);
create index document_chunks_embedding_idx on document_chunks using hnsw (embedding vector_cosine_ops);
create index document_chunks_org_idx on document_chunks (org_id);

create table facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  value text not null,
  category fact_category not null,
  source_document_id uuid references documents(id) on delete set null,
  source_excerpt text,
  source_page int,
  confidence numeric(3,2) not null default 1.0,
  status fact_status not null default 'needs_review',
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index facts_org_idx on facts (org_id);

create table boilerplates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type boilerplate_type not null,
  title text not null,
  body text not null,
  version int not null default 1,
  parent_id uuid references boilerplates(id) on delete set null,
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boilerplates_org_idx on boilerplates (org_id);

-- ---------- Funders and opportunities (shared, not org-scoped) ----------
create table funders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text,
  type funder_type not null,
  description text,
  focus_areas text[] not null default '{}',
  geography text,
  giving_min numeric(14,2),
  giving_max numeric(14,2),
  website_url text,
  source_url text not null,
  ai_policy text,
  recent_grantees jsonb not null default '[]',
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references funders(id) on delete cascade,
  title text not null,
  summary text,
  deadline date,
  deadline_type deadline_type not null default 'fixed',
  amount_min numeric(14,2),
  amount_max numeric(14,2),
  eligibility jsonb not null default '[]',
  guidelines_url text,
  source_url text not null,
  effort effort_level not null default 'medium',
  last_verified_at timestamptz not null default now(),
  is_active boolean not null default true,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index opportunities_deadline_idx on opportunities (deadline);
create index opportunities_embedding_idx on opportunities using hnsw (embedding vector_cosine_ops);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references funders(id) on delete cascade,
  name text not null,
  role text,
  email text,
  public_source_url text not null,
  created_at timestamptz not null default now()
);

-- ---------- Matching and applications ----------
create table matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  fit_score int not null check (fit_score between 0 and 100),
  reasons jsonb not null default '[]',
  cautions jsonb not null default '[]',
  eligibility_checks jsonb not null default '[]',
  status match_status not null default 'new',
  created_at timestamptz not null default now(),
  unique (org_id, opportunity_id)
);
create index matches_org_score_idx on matches (org_id, fit_score desc);

create table applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id),
  match_id uuid references matches(id) on delete set null,
  stage application_stage not null default 'discovered',
  ask_amount numeric(14,2),
  owner_id uuid references profiles(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_org_stage_idx on applications (org_id, stage);

create table requirements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  title text not null,
  kind requirement_kind not null,
  detail text,
  word_limit int,
  required boolean not null default true,
  "order" int not null default 0,
  satisfied boolean not null default false,
  parsed_from_url text
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  requirement_id uuid references requirements(id) on delete set null,
  title text not null,
  body_html text not null default '',
  word_limit int,
  status section_status not null default 'empty',
  "order" int not null default 0,
  updated_at timestamptz not null default now()
);
create index sections_application_idx on sections (application_id);

create table citations (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  fact_id uuid references facts(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  excerpt text,
  created_at timestamptz not null default now()
);

create table missing_facts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  section_id uuid references sections(id) on delete set null,
  question text not null,
  why_it_matters text,
  suggested_label text,
  status missing_fact_status not null default 'open',
  answer text,
  created_at timestamptz not null default now()
);

create table compliance_checks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  section_id uuid references sections(id) on delete cascade,
  rule text not null,
  status compliance_status not null,
  detail text,
  checked_at timestamptz not null default now()
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  title text not null,
  due_date date not null,
  kind milestone_kind not null,
  assignee_id uuid references profiles(id),
  done boolean not null default false,
  done_at timestamptz,
  reminder_sent_at timestamptz
);
create index milestones_org_due_idx on milestones (org_id, due_date);

create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  funder_id uuid references funders(id),
  contact_id uuid references contacts(id),
  kind email_kind not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table outcomes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  result outcome_result not null,
  award_amount numeric(14,2),
  feedback text,
  decided_at timestamptz not null default now()
);

-- ---------- Orchestration ----------
create table monthly_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  month date not null,
  summary text,
  items jsonb not null default '[]',
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  unique (org_id, month)
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent agent_name not null,
  trigger agent_trigger not null,
  title text not null,
  status agent_run_status not null default 'queued',
  input jsonb not null default '{}',
  output jsonb,
  tools_called jsonb not null default '[]',
  sources_used jsonb not null default '[]',
  output_summary text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_usd numeric(8,4) not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index agent_runs_org_started_idx on agent_runs (org_id, started_at desc);

create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent agent_name not null,
  type inbox_item_type not null,
  title text not null,
  summary text,
  payload jsonb not null,
  status inbox_status not null default 'pending',
  priority text not null default 'normal',
  source_count int not null default 0,
  agent_run_id uuid references agent_runs(id) on delete set null,
  related_application_id uuid references applications(id) on delete cascade,
  related_opportunity_id uuid references opportunities(id) on delete cascade,
  rejection_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index inbox_items_org_status_idx on inbox_items (org_id, status, created_at desc);

-- ---------- Billing and settings ----------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organizations(id) on delete cascade,
  plan plan_tier not null default 'free',
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  seats int not null default 1,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table notification_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  weekly_digest boolean not null default true,
  milestone_reminders boolean not null default true,
  inbox_alerts boolean not null default true,
  reminder_days_before int not null default 3
);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger organizations_updated before update on organizations for each row execute function set_updated_at();
create trigger facts_updated before update on facts for each row execute function set_updated_at();
create trigger boilerplates_updated before update on boilerplates for each row execute function set_updated_at();
create trigger applications_updated before update on applications for each row execute function set_updated_at();
create trigger sections_updated before update on sections for each row execute function set_updated_at();

-- ---------- Row level security ----------
create or replace function is_org_member(check_org uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from org_members m
    where m.org_id = check_org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','org_members','documents','document_chunks','facts','boilerplates','matches','applications',
    'requirements','sections','citations','missing_facts','compliance_checks','milestones','email_drafts','outcomes',
    'monthly_plans','agent_runs','inbox_items','subscriptions','notification_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy "members read org" on organizations for select using (is_org_member(id));
create policy "owners update org" on organizations for update using (
  exists (select 1 from org_members m where m.org_id = id and m.user_id = auth.uid() and m.role = 'owner')
);
create policy "members read members" on org_members for select using (is_org_member(org_id));

-- Org-scoped tables: members can read and write rows for their org.
do $$
declare t text;
begin
  foreach t in array array[
    'documents','document_chunks','facts','boilerplates','matches','applications','milestones','email_drafts',
    'monthly_plans','agent_runs','inbox_items','subscriptions','notification_settings'
  ] loop
    execute format('create policy "members all" on %I for all using (is_org_member(org_id)) with check (is_org_member(org_id))', t);
  end loop;
end $$;

-- Child tables scoped through applications / sections.
create policy "members via application" on requirements for all using (
  exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id))
);
create policy "members via application" on sections for all using (
  exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id))
);
create policy "members via application" on missing_facts for all using (
  exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id))
);
create policy "members via application" on compliance_checks for all using (
  exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id))
);
create policy "members via application" on outcomes for all using (
  exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id))
);
create policy "members via section" on citations for all using (
  exists (select 1 from sections s join applications a on a.id = s.application_id where s.id = section_id and is_org_member(a.org_id))
);

-- Funders, opportunities, and contacts are shared reference data: readable by every signed-in user, written only by the ingest job (service role).
alter table funders enable row level security;
alter table opportunities enable row level security;
alter table contacts enable row level security;
create policy "authenticated read" on funders for select to authenticated using (true);
create policy "authenticated read" on opportunities for select to authenticated using (true);
create policy "authenticated read" on contacts for select to authenticated using (true);

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
create policy "members read own docs" on storage.objects for select using (
  bucket_id = 'documents' and is_org_member((storage.foldername(name))[1]::uuid)
);
create policy "members upload own docs" on storage.objects for insert with check (
  bucket_id = 'documents' and is_org_member((storage.foldername(name))[1]::uuid)
);

-- ---------- Knowledge search RPC ----------
create or replace function match_document_chunks(query_embedding vector(1536), match_org uuid, match_count int default 8)
returns table (id uuid, document_id uuid, content text, page int, similarity float)
language sql stable as $$
  select c.id, c.document_id, c.content, c.page, 1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  where c.org_id = match_org
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
