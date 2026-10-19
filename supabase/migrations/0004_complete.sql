-- Complete product: impact metrics, boilerplate history, decline reasons and
-- lessons, workspace settings (voice note, agent autonomy, scholarship
-- profile), and the new enum values the app now writes.

alter type document_type add value if not exists 'w9';
alter type document_type add value if not exists 'audit';
alter type milestone_kind add value if not exists 'report_due';
alter type email_kind add value if not exists 'feedback_request';
alter type proposal_mode add value if not exists 'concept_note';

-- Why a request was declined, and what to do differently next time.
alter table outcomes add column if not exists loss_reasons text[] not null default '{}';
alter table outcomes add column if not exists lessons text;

-- Workspace settings that belong to the organization.
alter table organizations add column if not exists voice_note text not null default '';
alter table organizations add column if not exists agent_autonomy jsonb not null default '{"profile":"draft","discovery":"draft","planner":"draft","proposal":"draft","outreach":"draft","calendar":"schedule"}';
alter table organizations add column if not exists scholarship_profile jsonb;

-- Every saved version of a boilerplate paragraph, so an edit can be undone.
create table if not exists boilerplate_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  boilerplate_id uuid not null references boilerplates(id) on delete cascade,
  version int not null,
  body text not null,
  saved_at timestamptz not null default now()
);
create index if not exists boilerplate_versions_idx on boilerplate_versions (boilerplate_id, saved_at desc);

-- Program outcomes logged month by month. The newest value is also written to facts.
create table if not exists impact_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  unit text not null default '',
  program text,
  entries jsonb not null default '[]',
  fact_id uuid references facts(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['boilerplate_versions','impact_metrics'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "members all" on %I for all using (is_org_member(org_id)) with check (is_org_member(org_id))', t);
  end loop;
end $$;
