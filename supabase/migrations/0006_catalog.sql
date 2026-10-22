-- The shared opportunity database ("catalog"): every grant, contract or bid, research funding notice, and
-- scholarship or fellowship we can find in trusted public sources, normalized into one model.
--
-- Shared reference data, not workspace data: signed-in users read it, only ingestion jobs write it
-- (they connect with the database owner role or the service role, which bypass row level security).
-- The app's `opportunities` table stays the per-workspace working copy; a match copies a catalog row there.
--
-- Size: the Supabase free plan allows 500 MB. Long documents stay as links at the source, summaries are
-- trimmed, raw payloads are never stored, and past awards are kept as aggregates. See docs/data-sources.md.

create extension if not exists pg_trgm;

-- ---------- Sources ----------
create table if not exists catalog_sources (
  id text primary key,                  -- 'grantsgov', 'sam_opportunities', ...
  name text not null,
  homepage text not null,
  docs_url text,
  terms_url text,
  license text not null,
  attribution text,
  kinds text[] not null default '{}',   -- opportunity types it feeds
  region text not null default 'us' check (region in ('us', 'state', 'local', 'international')),
  cadence text not null,                -- plain words: 'Daily', 'Hourly', 'Weekly'
  needs_key text,                       -- env var name when a free key is required
  enabled boolean not null default true,
  priority int not null default 50,     -- lower wins when the same opportunity is listed by two sources
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------- Funders and buying agencies ----------
create table if not exists catalog_funders (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,             -- 'agency:HHS-NIH', 'ein:123456789', 'state:CA:caleprocure'
  name text not null,
  kind text not null check (kind in ('federal_agency', 'state_agency', 'local_government', 'private_foundation',
    'community_foundation', 'corporate', 'university', 'international', 'other')),
  parent_key text,
  ein text,
  website text,
  city text,
  state text,
  country text not null default 'US',
  focus text[] not null default '{}',
  geography text[] not null default '{}',     -- states or regions where it gives or buys
  accepts_applications boolean,
  grants_to_individuals boolean,
  typical_grant_min numeric(16,2),
  typical_grant_median numeric(16,2),
  typical_grant_max numeric(16,2),
  total_giving numeric(16,2),
  assets numeric(18,2),
  tax_year int,
  source text not null references catalog_sources(id),
  source_url text not null,
  extra jsonb not null default '{}',          -- small, source-specific fields (application info, top grantees)
  first_seen timestamptz not null default now(),
  last_checked timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists catalog_funders_kind_idx on catalog_funders (kind);
create index if not exists catalog_funders_state_idx on catalog_funders (state);
create index if not exists catalog_funders_ein_idx on catalog_funders (ein) where ein is not null;
create index if not exists catalog_funders_name_trgm on catalog_funders using gin (name gin_trgm_ops);

-- Giving history per funder and year (foundations from 990-PF; agencies from award data).
create table if not exists catalog_funder_giving (
  funder_id uuid not null references catalog_funders(id) on delete cascade,
  year int not null,
  total_giving numeric(16,2),
  grant_count int,
  grant_median numeric(16,2),
  grant_min numeric(16,2),
  grant_max numeric(16,2),
  assets numeric(18,2),
  source_url text,
  primary key (funder_id, year)
);

-- ---------- Opportunities ----------
create table if not exists catalog_opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null references catalog_sources(id),
  source_id text not null,
  source_url text not null,
  opportunity_number text,
  canonical_key text,                   -- same key across sources means the same opportunity
  duplicate_of uuid references catalog_opportunities(id) on delete set null,
  also_listed jsonb not null default '[]',
  type text not null check (type in ('grant', 'contract', 'research', 'scholarship')),
  notice_type text,                     -- 'solicitation', 'presolicitation', 'sources_sought', 'nofo', 'forecast', 'program', 'foundation', ...
  title text not null,
  summary text,                         -- trimmed; the full notice stays at source_url
  funder_id uuid references catalog_funders(id) on delete set null,
  funder_name text,
  agency_code text,
  status text not null check (status in ('forecasted', 'open', 'closed', 'archived', 'cancelled', 'awarded')),
  posted_at date,
  open_at date,
  close_at timestamptz,
  close_text text,                      -- deadline as written when it is not one date ("rolling", "quarterly")
  archive_at date,
  rolling boolean not null default false,
  key_dates jsonb not null default '[]',  -- [{kind, date, label}]
  amount_min numeric(16,2),
  amount_max numeric(16,2),
  amount_total numeric(18,2),
  award_count int,
  currency text not null default 'USD',
  eligibility text[] not null default '{}',   -- normalized codes, see src/lib/catalog/vocab.ts
  eligibility_text text,
  naics text[] not null default '{}',
  psc text,
  set_aside text,                       -- plain label: 'Total small business', 'SDVOSB', '8(a)', ...
  set_aside_code text,
  assistance_listings text[] not null default '{}',
  research_areas text[] not null default '{}',
  causes text[] not null default '{}',
  categories text[] not null default '{}',
  place_state text,
  place_city text,
  place_country text not null default 'US',
  place_zip text,
  place_text text,
  attachments jsonb not null default '[]',  -- links only: [{name, url, size}]
  amendments jsonb not null default '[]',   -- [{number, date, summary, url}]
  contact jsonb,                            -- public point of contact as published
  extra jsonb not null default '{}',
  license text,
  content_hash text not null,
  search tsvector,
  embedding vector(768),
  first_seen timestamptz not null default now(),
  last_checked timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_detected_at timestamptz,
  unique (source, source_id)
);

create index if not exists catalog_opps_search_idx on catalog_opportunities using gin (search);
create index if not exists catalog_opps_open_idx on catalog_opportunities (type, close_at)
  where duplicate_of is null and status in ('open', 'forecasted');
create index if not exists catalog_opps_status_idx on catalog_opportunities (status, source);
create index if not exists catalog_opps_canonical_idx on catalog_opportunities (canonical_key) where canonical_key is not null;
create index if not exists catalog_opps_naics_idx on catalog_opportunities using gin (naics);
create index if not exists catalog_opps_elig_idx on catalog_opportunities using gin (eligibility);
create index if not exists catalog_opps_aln_idx on catalog_opportunities using gin (assistance_listings);
create index if not exists catalog_opps_causes_idx on catalog_opportunities using gin (causes);
create index if not exists catalog_opps_areas_idx on catalog_opportunities using gin (research_areas);
create index if not exists catalog_opps_state_idx on catalog_opportunities (place_state);
create index if not exists catalog_opps_funder_idx on catalog_opportunities (funder_id);
create index if not exists catalog_opps_categories_idx on catalog_opportunities using gin (categories);
create index if not exists catalog_opps_embedding_idx on catalog_opportunities using hnsw (embedding vector_cosine_ops);

-- The search document: title first, then funder and numbers, then the summary and labels.
-- Only live notices (open or forecasted) are searchable; closed history keeps no search document or summary,
-- which keeps the database small.
create or replace function catalog_opportunity_search_doc() returns trigger language plpgsql as $$
begin
  if new.status in ('open', 'forecasted') then
    new.search :=
      setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(new.funder_name, '') || ' ' || coalesce(new.opportunity_number, '') || ' ' ||
        array_to_string(new.assistance_listings, ' ') || ' ' || array_to_string(new.naics, ' ')), 'B') ||
      setweight(to_tsvector('english', array_to_string(new.research_areas, ' ') || ' ' || array_to_string(new.causes, ' ') || ' ' ||
        array_to_string(new.categories, ' ') || ' ' || coalesce(new.set_aside, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(new.summary, '') || ' ' || coalesce(new.eligibility_text, '')), 'C');
  else
    new.search := null;
    new.summary := null;
    new.eligibility_text := null;
    new.embedding := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists catalog_opportunities_search on catalog_opportunities;
create trigger catalog_opportunities_search before insert or update of status, title, funder_name, opportunity_number, summary,
  eligibility_text, assistance_listings, naics, research_areas, causes, categories, set_aside
  on catalog_opportunities for each row execute function catalog_opportunity_search_doc();

-- History of the fields people plan around, for analytics and for "the deadline moved" notices.
create table if not exists catalog_opportunity_changes (
  id bigserial primary key,
  opportunity_id uuid not null references catalog_opportunities(id) on delete cascade,
  changed_at timestamptz not null default now(),
  field text not null,
  old_value text,
  new_value text
);
create index if not exists catalog_changes_opp_idx on catalog_opportunity_changes (opportunity_id, changed_at desc);

create or replace function catalog_opportunity_track_changes() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into catalog_opportunity_changes (opportunity_id, field, old_value, new_value) values (new.id, 'status', old.status, new.status);
    if new.status in ('closed', 'archived', 'cancelled', 'awarded') and old.status in ('open', 'forecasted') then
      new.closed_detected_at := now();
    end if;
  end if;
  if new.close_at is distinct from old.close_at then
    insert into catalog_opportunity_changes (opportunity_id, field, old_value, new_value) values (new.id, 'close_at', old.close_at::text, new.close_at::text);
  end if;
  if new.amount_max is distinct from old.amount_max then
    insert into catalog_opportunity_changes (opportunity_id, field, old_value, new_value) values (new.id, 'amount_max', old.amount_max::text, new.amount_max::text);
  end if;
  return new;
end $$;

drop trigger if exists catalog_opportunities_changes on catalog_opportunities;
create trigger catalog_opportunities_changes before update of status, close_at, amount_max
  on catalog_opportunities for each row execute function catalog_opportunity_track_changes();

-- ---------- Past awards, as aggregates ----------
-- Who buys and funds what, and for how much. Recipient names of contracts are never stored.
create table if not exists catalog_award_stats (
  id bigserial primary key,
  source text not null references catalog_sources(id),
  award_type text not null check (award_type in ('contract', 'grant', 'research', 'scholarship')),
  agency text not null,
  sub_agency text,
  naics text,
  psc text,
  assistance_listing text,
  activity_code text,                   -- NIH activity code (R01), NSF program element, SBIR phase
  program text,
  place_state text,
  set_aside text,
  fiscal_year int not null,
  award_count int not null,
  total_amount numeric(18,2) not null,
  median_amount numeric(16,2),
  p25_amount numeric(16,2),
  p75_amount numeric(16,2),
  min_amount numeric(16,2),
  max_amount numeric(16,2),
  source_url text,
  last_checked timestamptz not null default now(),
  unique nulls not distinct (source, award_type, agency, sub_agency, naics, psc, assistance_listing, activity_code, program, place_state, set_aside, fiscal_year)
);
create index if not exists catalog_awards_naics_idx on catalog_award_stats (naics, fiscal_year);
create index if not exists catalog_awards_aln_idx on catalog_award_stats (assistance_listing, fiscal_year);
create index if not exists catalog_awards_agency_idx on catalog_award_stats (agency, fiscal_year);

-- ---------- Ingestion log ----------
create table if not exists catalog_ingest_runs (
  id bigserial primary key,
  source text not null,
  mode text not null check (mode in ('backfill', 'incremental')),
  trigger text not null default 'manual' check (trigger in ('schedule', 'manual', 'launch', 'test')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int,
  rows_seen int not null default 0,
  rows_added int not null default 0,
  rows_updated int not null default 0,
  rows_closed int not null default 0,
  funders_upserted int not null default 0,
  awards_upserted int not null default 0,
  error_count int not null default 0,
  errors jsonb not null default '[]',
  notes text,
  host text
);
create index if not exists catalog_runs_source_idx on catalog_ingest_runs (source, started_at desc);

-- ---------- Dedupe ----------
-- Rows that share a canonical key are one opportunity. The source with the lowest priority number is primary;
-- the others point at it and are listed on it.
create or replace function catalog_dedupe() returns int language plpgsql as $$
declare changed int;
begin
  with ranked as (
    select o.id, o.canonical_key,
      first_value(o.id) over (partition by o.canonical_key order by s.priority, o.first_seen, o.id) as primary_id
    from catalog_opportunities o join catalog_sources s on s.id = o.source
    where o.canonical_key is not null
  ), target as (
    select id, case when id = primary_id then null else primary_id end as dup from ranked
  )
  update catalog_opportunities o set duplicate_of = t.dup
  from target t where o.id = t.id and o.duplicate_of is distinct from t.dup;
  get diagnostics changed = row_count;

  update catalog_opportunities p set also_listed = coalesce(x.listed, '[]'::jsonb)
  from (
    select o.id, (select jsonb_agg(jsonb_build_object('source', d.source, 'url', d.source_url) order by d.source)
                  from catalog_opportunities d where d.duplicate_of = o.id) as listed
    from catalog_opportunities o where o.duplicate_of is null and o.canonical_key is not null
  ) x
  where p.id = x.id and p.also_listed is distinct from coalesce(x.listed, '[]'::jsonb);
  return changed;
end $$;

-- Anything past its deadline is closed, whatever the source last said.
create or replace function catalog_expire() returns int language plpgsql as $$
declare n int;
begin
  update catalog_opportunities set status = 'closed'
  where status in ('open', 'forecasted') and rolling = false and close_at is not null and close_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Search ----------
create or replace function catalog_search(
  q text default null,
  types text[] default null,
  statuses text[] default array['open', 'forecasted'],
  eligibility text[] default null,
  naics_prefixes text[] default null,
  set_asides text[] default null,
  states text[] default null,
  assistance_listings text[] default null,
  research_areas text[] default null,
  causes text[] default null,
  sources text[] default null,
  categories text[] default null,
  amount_at_least numeric default null,
  amount_at_most numeric default null,
  closes_after timestamptz default null,
  closes_before timestamptz default null,
  include_rolling boolean default true,
  seen_after timestamptz default null,
  lim int default 25,
  off int default 0
) returns table (
  id uuid, source text, source_url text, opportunity_number text, type text, notice_type text, title text, summary text,
  funder_id uuid, funder_name text, status text, posted_at date, close_at timestamptz, close_text text, rolling boolean,
  amount_min numeric, amount_max numeric, eligibility text[], naics text[], set_aside text, assistance_listings text[],
  research_areas text[], causes text[], place_state text, place_country text, also_listed jsonb, last_checked timestamptz,
  rank real, total bigint
) language sql stable as $$
  with query as (select case when coalesce(trim(q), '') = '' then null else websearch_to_tsquery('english', q) end as tsq)
  select o.id, o.source, o.source_url, o.opportunity_number, o.type, o.notice_type, o.title, o.summary,
    o.funder_id, o.funder_name, o.status, o.posted_at, o.close_at, o.close_text, o.rolling,
    o.amount_min, o.amount_max, o.eligibility, o.naics, o.set_aside, o.assistance_listings,
    o.research_areas, o.causes, o.place_state, o.place_country, o.also_listed, o.last_checked,
    case when query.tsq is null then 0 else ts_rank_cd(o.search, query.tsq) end::real as rank,
    count(*) over () as total
  from catalog_opportunities o, query
  where o.duplicate_of is null
    and (statuses is null or o.status = any(statuses))
    and (query.tsq is null or o.search @@ query.tsq)
    and (types is null or o.type = any(types))
    and (eligibility is null or o.eligibility && eligibility or 'unrestricted' = any(o.eligibility))
    and (naics_prefixes is null or exists (select 1 from unnest(o.naics) n, unnest(naics_prefixes) p where n like p || '%'))
    and (set_asides is null or o.set_aside = any(set_asides))
    and (states is null or o.place_state is null or o.place_state = any(states))
    and (assistance_listings is null or o.assistance_listings && assistance_listings)
    and (research_areas is null or o.research_areas && research_areas)
    and (causes is null or o.causes && causes)
    and (sources is null or o.source = any(sources))
    and (categories is null or o.categories && categories)
    and (amount_at_least is null or coalesce(o.amount_max, o.amount_min) is null or coalesce(o.amount_max, o.amount_min) >= amount_at_least)
    and (amount_at_most is null or coalesce(o.amount_min, o.amount_max) is null or coalesce(o.amount_min, o.amount_max) <= amount_at_most)
    and (closes_after is null or o.close_at >= closes_after or (include_rolling and o.close_at is null))
    and (closes_before is null or o.close_at <= closes_before or (include_rolling and o.close_at is null))
    and (seen_after is null or o.first_seen >= seen_after)
  order by
    case when query.tsq is null then 0 else ts_rank_cd(o.search, query.tsq) end desc,
    o.close_at asc nulls last,
    o.id
  limit greatest(1, least(lim, 200)) offset greatest(0, off)
$$;

-- Semantic matching, used when embeddings exist (GEMINI_API_KEY at ingestion time).
create or replace function catalog_match_embedding(
  query_embedding vector(768),
  types text[] default null,
  eligibility text[] default null,
  states text[] default null,
  lim int default 50
) returns table (id uuid, similarity real) language sql stable as $$
  select o.id, (1 - (o.embedding <=> query_embedding))::real as similarity
  from catalog_opportunities o
  where o.embedding is not null and o.duplicate_of is null and o.status in ('open', 'forecasted')
    and (types is null or o.type = any(types))
    and (eligibility is null or o.eligibility && eligibility or 'unrestricted' = any(o.eligibility))
    and (states is null or o.place_state is null or o.place_state = any(states))
  order by o.embedding <=> query_embedding
  limit greatest(1, least(lim, 200))
$$;

-- Public counts for the /data page. Anyone may read totals; nobody reads rows without signing in.
create or replace function catalog_public_stats() returns table (
  source text, type text, open_count bigint, forecasted_count bigint, total_count bigint, last_checked timestamptz
) language sql stable security definer set search_path = public as $$
  select o.source, o.type,
    count(*) filter (where o.status = 'open' and o.duplicate_of is null),
    count(*) filter (where o.status = 'forecasted' and o.duplicate_of is null),
    count(*),
    max(o.last_checked)
  from catalog_opportunities o
  group by o.source, o.type
$$;

create or replace function catalog_public_runs() returns table (
  source text, status text, finished_at timestamptz, rows_added int, rows_updated int
) language sql stable security definer set search_path = public as $$
  select distinct on (r.source) r.source, r.status, r.finished_at, r.rows_added, r.rows_updated
  from catalog_ingest_runs r where r.status in ('succeeded', 'partial')
  order by r.source, r.finished_at desc nulls last
$$;

create or replace function catalog_public_funder_counts() returns table (kind text, funder_count bigint)
language sql stable security definer set search_path = public as $$
  select kind, count(*) from catalog_funders group by kind
$$;

-- ---------- Access ----------
alter table catalog_sources enable row level security;
alter table catalog_funders enable row level security;
alter table catalog_funder_giving enable row level security;
alter table catalog_opportunities enable row level security;
alter table catalog_opportunity_changes enable row level security;
alter table catalog_award_stats enable row level security;
alter table catalog_ingest_runs enable row level security;

drop policy if exists "signed in read" on catalog_sources;
drop policy if exists "signed in read" on catalog_funders;
drop policy if exists "signed in read" on catalog_funder_giving;
drop policy if exists "signed in read" on catalog_opportunities;
drop policy if exists "signed in read" on catalog_opportunity_changes;
drop policy if exists "signed in read" on catalog_award_stats;
create policy "signed in read" on catalog_sources for select to authenticated using (true);
create policy "signed in read" on catalog_funders for select to authenticated using (true);
create policy "signed in read" on catalog_funder_giving for select to authenticated using (true);
create policy "signed in read" on catalog_opportunities for select to authenticated using (true);
create policy "signed in read" on catalog_opportunity_changes for select to authenticated using (true);
create policy "signed in read" on catalog_award_stats for select to authenticated using (true);
-- catalog_ingest_runs has no policy: only the service role (the admin page, through the server) reads it.

revoke all on function catalog_dedupe() from public, anon, authenticated;
revoke all on function catalog_expire() from public, anon, authenticated;
grant execute on function catalog_public_stats() to anon, authenticated;
grant execute on function catalog_public_runs() to anon, authenticated;
grant execute on function catalog_public_funder_counts() to anon, authenticated;
revoke all on function catalog_search(text, text[], text[], text[], text[], text[], text[], text[], text[], text[], text[], text[], numeric, numeric, timestamptz, timestamptz, boolean, timestamptz, int, int) from public, anon;
grant execute on function catalog_search(text, text[], text[], text[], text[], text[], text[], text[], text[], text[], text[], text[], numeric, numeric, timestamptz, timestamptz, boolean, timestamptz, int, int) to authenticated, service_role;
revoke all on function catalog_match_embedding(vector, text[], text[], text[], int) from public, anon;
grant execute on function catalog_match_embedding(vector, text[], text[], text[], int) to authenticated, service_role;
