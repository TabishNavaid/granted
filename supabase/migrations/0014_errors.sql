-- Error monitoring without a paid service: server errors (instrumentation onRequestError) and browser errors
-- (sent to /api/errors) are grouped by a fingerprint and counted. Only the service role reads or writes; operators
-- see them at /admin/errors. Messages are trimmed and query strings dropped before they arrive, so no tokens.
create table if not exists app_errors (
  fingerprint text primary key,
  kind text not null check (kind in ('server', 'client')),
  message text not null,
  digest text,
  route text,
  path text,
  detail jsonb not null default '{}'::jsonb,
  count int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists app_errors_last_seen_idx on app_errors (last_seen desc);
alter table app_errors enable row level security;
-- No policies: nobody but the service role.

create or replace function record_app_error(fp text, k text, msg text, dig text, rt text, pth text, det jsonb)
returns void language sql security definer set search_path = public as $$
  insert into app_errors (fingerprint, kind, message, digest, route, path, detail)
  values (fp, k, left(msg, 1000), left(dig, 200), left(rt, 300), left(pth, 300), coalesce(det, '{}'::jsonb))
  on conflict (fingerprint) do update set count = app_errors.count + 1, last_seen = now(), digest = excluded.digest,
    path = excluded.path, detail = excluded.detail;
  -- Keep the table small: groups not seen in 30 days go.
  delete from app_errors where last_seen < now() - interval '30 days';
$$;
revoke all on function record_app_error(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function record_app_error(text, text, text, text, text, text, jsonb) to service_role;
