-- Per-person opt-outs from non-essential mail, per workspace. Sign-in and invitation emails are never affected.
create table if not exists email_opt_outs (
  email text not null,
  org_id uuid not null references organizations(id) on delete cascade,
  category text not null check (category in ('digest', 'reminders', 'drafts')),
  created_at timestamptz not null default now(),
  primary key (email, org_id, category)
);
alter table email_opt_outs enable row level security;
-- Written and read only by the server (the unsubscribe link and the senders).
