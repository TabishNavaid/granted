-- Roles at the database, as defense in depth. Members of a workspace read its rows; only owners and editors write
-- them directly. (The app writes through the server after its own role checks; this closes the door on anyone
-- using their session token against the REST API.) Reviewers read, comment, and approve through the app.

do $$
declare t text;
begin
  for t in select distinct p.tablename from pg_policies p where p.schemaname = 'public' and p.policyname = 'members all' and p.tablename <> 'integration_connections' loop
    execute format('drop policy if exists "members all" on %I', t);
    execute format('create policy "members read" on %I for select using (is_org_member(org_id))', t);
    execute format('create policy "editors insert" on %I for insert with check (is_org_editor(org_id))', t);
    execute format('create policy "editors update" on %I for update using (is_org_editor(org_id)) with check (is_org_editor(org_id))', t);
    execute format('create policy "editors delete" on %I for delete using (is_org_editor(org_id))', t);
  end loop;

  for t in select distinct p.tablename from pg_policies p where p.schemaname = 'public' and p.policyname = 'members via application' loop
    execute format('drop policy if exists "members via application" on %I', t);
    execute format('create policy "members read" on %I for select using (exists (select 1 from applications a where a.id = application_id and is_org_member(a.org_id)))', t);
    execute format('create policy "editors write" on %I for all using (exists (select 1 from applications a where a.id = application_id and is_org_editor(a.org_id))) with check (exists (select 1 from applications a where a.id = application_id and is_org_editor(a.org_id)))', t);
  end loop;

  for t in select distinct p.tablename from pg_policies p where p.schemaname = 'public' and p.policyname = 'members via section' loop
    execute format('drop policy if exists "members via section" on %I', t);
    execute format('create policy "members read" on %I for select using (exists (select 1 from sections s join applications a on a.id = s.application_id where s.id = section_id and is_org_member(a.org_id)))', t);
    execute format('create policy "editors write" on %I for all using (exists (select 1 from sections s join applications a on a.id = s.application_id where s.id = section_id and is_org_editor(a.org_id))) with check (exists (select 1 from sections s join applications a on a.id = s.application_id where s.id = section_id and is_org_editor(a.org_id)))', t);
  end loop;
end $$;

-- Connected accounts hold (encrypted) OAuth tokens. Only the server reads them; no user policy at all.
drop policy if exists "members all" on integration_connections;

-- Workspace files: members read, editors add, replace, and remove.
drop policy if exists "members upload own docs" on storage.objects;
drop policy if exists "members update own docs" on storage.objects;
drop policy if exists "members delete own docs" on storage.objects;
create policy "editors upload own docs" on storage.objects for insert with check (
  bucket_id = 'documents' and is_org_editor((storage.foldername(name))[1]::uuid)
);
create policy "editors update own docs" on storage.objects for update using (
  bucket_id = 'documents' and is_org_editor((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'documents' and is_org_editor((storage.foldername(name))[1]::uuid)
);
create policy "editors delete own docs" on storage.objects for delete using (
  bucket_id = 'documents' and is_org_editor((storage.foldername(name))[1]::uuid)
);
