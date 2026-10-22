-- Security fixes found by the row level security tests (tests/rls.spec.ts).

-- profiles held every user's email and name with no row level security, so the public anon key could read them.
-- A person reads and edits their own profile, and reads the profiles of people in their workspaces.
alter table profiles enable row level security;
drop policy if exists "read own profile" on profiles;
drop policy if exists "read teammates" on profiles;
drop policy if exists "update own profile" on profiles;
create policy "read own profile" on profiles for select using (id = auth.uid());
create policy "read teammates" on profiles for select using (
  exists (
    select 1 from org_members me join org_members them on them.org_id = me.org_id
    where me.user_id = auth.uid() and me.status = 'active' and them.user_id = profiles.id
  )
);
create policy "update own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Security definer functions run with a fixed search path, so nobody can shadow the tables they read.
alter function is_org_member(uuid) set search_path = public;
alter function catalog_dedupe() set search_path = public;
alter function catalog_expire() set search_path = public;

-- Workspace files live under <org_id>/... in the private documents bucket. Members may also replace and delete them.
drop policy if exists "members update own docs" on storage.objects;
drop policy if exists "members delete own docs" on storage.objects;
create policy "members update own docs" on storage.objects for update using (
  bucket_id = 'documents' and is_org_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'documents' and is_org_member((storage.foldername(name))[1]::uuid)
);
create policy "members delete own docs" on storage.objects for delete using (
  bucket_id = 'documents' and is_org_member((storage.foldername(name))[1]::uuid)
);

-- Reviewers read and comment; they do not change the workspace's records. Owners and editors write.
create or replace function is_org_editor(check_org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.org_id = check_org and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'editor')
  );
$$;

-- For the security tests and the operator: which public tables have row level security on. Service role only.
create or replace function rls_report() returns table (table_name text, rls boolean) language sql stable security definer set search_path = public as $$
  select c.relname::text, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1
$$;
revoke all on function rls_report() from public, anon, authenticated;
grant execute on function rls_report() to service_role;
