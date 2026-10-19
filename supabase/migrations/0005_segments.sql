-- One engine for four kinds of applicant and four kinds of opportunity.
-- Organizations: nonprofit, firm (architecture, engineering, construction first), research team, individual.
-- Opportunities: grant, contract or bid, research funding, scholarship or fellowship.

-- New values on existing enums. Postgres cannot use a new enum value in the same transaction it is added in,
-- so nothing below depends on these values.
alter type application_stage add value if not exists 'go_no_go';
alter type application_stage add value if not exists 'shortlisted';
alter type application_stage add value if not exists 'interview';
alter type milestone_kind add value if not exists 'go_no_go';
alter type milestone_kind add value if not exists 'questions_due';
alter type milestone_kind add value if not exists 'prebid_meeting';
alter type milestone_kind add value if not exists 'site_visit';
alter type milestone_kind add value if not exists 'addendum';
alter type milestone_kind add value if not exists 'interview';
alter type requirement_kind add value if not exists 'evaluation';
alter type requirement_kind add value if not exists 'submission';
alter type requirement_kind add value if not exists 'form';
alter type proposal_mode add value if not exists 'bid';
alter type proposal_mode add value if not exists 'sf330';
alter type proposal_mode add value if not exists 'research';
alter type proposal_mode add value if not exists 'essay';
alter type fact_category add value if not exists 'portfolio';
alter type fact_category add value if not exists 'credentials';
alter type boilerplate_type add value if not exists 'approach';
alter type boilerplate_type add value if not exists 'quality_control';
alter type boilerplate_type add value if not exists 'safety_plan';
alter type boilerplate_type add value if not exists 'facilities';
alter type boilerplate_type add value if not exists 'personal_statement';
alter type funder_type add value if not exists 'local_government';
alter type funder_type add value if not exists 'university';
alter type funder_type add value if not exists 'private_owner';
alter type inbox_item_type add value if not exists 'go_no_go';
alter type inbox_item_type add value if not exists 'addendum';
alter type document_type add value if not exists 'rfp';
alter type document_type add value if not exists 'addendum';
alter type document_type add value if not exists 'resume';
alter type document_type add value if not exists 'capability_statement';
alter type document_type add value if not exists 'bond_letter';
alter type document_type add value if not exists 'insurance_certificate';
alter type document_type add value if not exists 'project_photo';

-- What kind of applicant an organization is. Setup asks first.
alter table organizations add column if not exists org_type text not null default 'nonprofit'
  check (org_type in ('nonprofit', 'firm', 'research', 'individual'));

-- What kind of opportunity, and for contracts the solicitation as issued (dates, set-aside, NAICS, forms, evaluation).
alter table opportunities add column if not exists kind text not null default 'grant'
  check (kind in ('grant', 'contract', 'research', 'scholarship'));
alter table opportunities add column if not exists solicitation jsonb;

-- The compliance matrix: where each requirement is set, the sentence it comes from, and what answers it.
alter table requirements add column if not exists ref text;
alter table requirements add column if not exists excerpt text;
alter table requirements add column if not exists section_key text;
alter table requirements add column if not exists answered_in_section_id uuid references sections(id) on delete set null;
alter table requirements add column if not exists matrix_status text not null default 'open'
  check (matrix_status in ('met', 'partial', 'open', 'firm_action', 'not_applicable'));

-- A firm's knowledge base. Record bodies are jsonb; ids and org scoping are columns.
create table if not exists firm_profiles (
  org_id uuid primary key references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_projects_org_idx on portfolio_projects (org_id);

create table if not exists personnel (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists personnel_org_idx on personnel (org_id);

create table if not exists certifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists certifications_org_idx on certifications (org_id);

-- Per bid: go/no-go scores, the fee proposal structure, addenda, selections, and the solicitation's pages.
create table if not exists go_no_go (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists go_no_go_app_idx on go_no_go (application_id, created_at desc);

create table if not exists fee_proposals (
  application_id uuid primary key references applications(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists addenda (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists addenda_app_idx on addenda (application_id, created_at);

create table if not exists bid_meta (
  application_id uuid primary key references applications(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  data jsonb not null
);

create table if not exists rfp_pages (
  opportunity_id uuid primary key references opportunities(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  pages jsonb not null
);

create table if not exists document_pages (
  document_id uuid primary key references documents(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  pages jsonb not null
);

-- Research teams and individuals keep one profile each.
create table if not exists research_profiles (
  org_id uuid primary key references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists person_profiles (
  org_id uuid primary key references organizations(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['firm_profiles','portfolio_projects','personnel','certifications','go_no_go','fee_proposals','addenda','bid_meta','rfp_pages','document_pages','research_profiles','person_profiles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "members all" on %I for all using (is_org_member(org_id)) with check (is_org_member(org_id))', t);
  end loop;
end $$;
