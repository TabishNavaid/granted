-- Background jobs for long work a person starts: reading a long RFP, drafting a full proposal or bid, reading a website.
-- The server records the job here, runs it after answering the request, and writes progress as it goes, so any
-- server instance can answer "how far along is it". A sweeper resumes jobs whose worker stopped (see docs/jobs.md).
create table if not exists jobs (
  id text primary key,                       -- job_..., made by the browser so it can watch before the start returns
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  user_email text not null default '',
  user_name text not null default '',
  kind text not null,                        -- 'loop.draftProposal', 'bids.addRfp', ...
  args jsonb not null default '[]',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  progress jsonb,
  result jsonb,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz
);
create index if not exists jobs_org_idx on jobs (org_id, created_at desc);
create index if not exists jobs_stale_idx on jobs (heartbeat_at) where status in ('queued', 'running');

alter table jobs enable row level security;
drop policy if exists "members read" on jobs;
create policy "members read" on jobs for select using (is_org_member(org_id));
-- Written only by the server.
