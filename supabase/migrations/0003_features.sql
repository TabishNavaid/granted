-- Features: saved searches, dismiss reasons, proposal mode, section versions, outreach status,
-- contacts and notes, social campaigns, budgets, reviewer checks, integration connections, calendar feed.

alter table matches add column if not exists dismiss_reason text;

create type proposal_mode as enum ('letter','proposal');
alter table applications add column if not exists mode proposal_mode not null default 'letter';

alter table organizations add column if not exists calendar_token text not null default encode(gen_random_bytes(16), 'hex');

create type email_status as enum ('draft','approved','sent');
alter table email_drafts add column if not exists "to" text;
alter table email_drafts add column if not exists to_name text;
alter table email_drafts add column if not exists status email_status not null default 'draft';
alter table email_drafts add column if not exists sent_at timestamptz;
alter table email_drafts add column if not exists sent_via text;
alter table email_drafts add column if not exists follow_up_at timestamptz;

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  keyword text not null,
  funding_categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_run_at timestamptz
);
create index if not exists saved_searches_org_idx on saved_searches (org_id);

create table if not exists section_versions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  body_html text not null,
  note text not null default '',
  by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists section_versions_section_idx on section_versions (section_id, created_at desc);

create type contact_kind as enum ('board','staff','funder','partner','volunteer','other');
create table if not exists org_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  organization text not null default '',
  role text not null default '',
  email text,
  phone text,
  kind contact_kind not null default 'other',
  relationship text not null default '',
  funder_id uuid references funders(id) on delete set null,
  source text not null default 'manual',
  last_touch_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists org_contacts_org_idx on org_contacts (org_id);

create table if not exists contact_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references org_contacts(id) on delete cascade,
  kind text not null default 'note',
  note text not null,
  next_step text,
  happened_at timestamptz not null default now()
);

create table if not exists social_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  month text not null,
  theme text not null default '',
  posts jsonb not null default '[]',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique (org_id, month)
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  application_id uuid not null unique references applications(id) on delete cascade,
  lines jsonb not null default '[]',
  justification text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists reviewer_checks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  overall int not null,
  criteria jsonb not null default '[]',
  summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists reviewer_checks_app_idx on reviewer_checks (application_id, created_at desc);

-- OAuth tokens for Gmail, Outlook, and Google Calendar. Service role only; never selected by the browser.
create table if not exists integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  account_email text not null default '',
  scopes text[] not null default '{}',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  unique (org_id, provider)
);

-- Documents keep their extracted text for fact extraction.
alter table documents add column if not exists fact_count int not null default 0;

do $$
declare t text;
begin
  foreach t in array array['saved_searches','org_contacts','contact_notes','social_campaigns','budgets','integration_connections'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "members all" on %I for all using (is_org_member(org_id)) with check (is_org_member(org_id))', t);
  end loop;
end $$;
alter table section_versions enable row level security;
create policy "members via section" on section_versions for all using (
  exists (select 1 from sections s join applications a on a.id = s.application_id where s.id = section_id and is_org_member(a.org_id))
);
alter table reviewer_checks enable row level security;
create policy "members via application" on reviewer_checks for all using (
  exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id))
);
