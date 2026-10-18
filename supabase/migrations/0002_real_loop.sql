-- Real loop: website facts with URLs, Grants.gov opportunities, letter gaps, run models, a cache, and profile bootstrap.

-- Facts read from the organization's own website carry the page they came from.
alter table facts add column if not exists source_url text;
alter table facts add column if not exists source_label text;

-- Opportunities and funders from Grants.gov keep their external ids so a rerun updates instead of duplicating.
alter table funders add column if not exists external_id text unique;
alter table opportunities add column if not exists external_id text unique;
alter table opportunities add column if not exists forecasted boolean not null default false;
-- The plain text of the notice the match was scored on; the letter writer reads it too.
alter table opportunities add column if not exists notice_text text;

-- The [[gap:KEY]] mark a letter used, so a redraft can find the same question again.
alter table missing_facts add column if not exists gap_key text;

alter table agent_runs add column if not exists models text[] not null default '{}';

-- Shared cache for Grants.gov responses and model results (service role only).
create table if not exists cache_entries (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);
alter table cache_entries enable row level security;
create index if not exists cache_entries_expires_idx on cache_entries (expires_at);

-- Make a profile row for every new auth user. The organization is created on first sign-in by the app.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
