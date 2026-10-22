import postgres from "postgres";
import { canonicalKey, contentHash, sha1, stableStringify, trimSummary } from "../normalize";
import type { AwardStatInput, FunderInput, OpportunityInput, SourceDefinition } from "../types";

/**
 * Writes to the catalog over a direct Postgres connection. Ingestion runs in
 * GitHub Actions or on a laptop, never in a Vercel function, so it connects
 * with DATABASE_URL (the database owner role) and bypasses row level security
 * by design: the catalog is readable by signed-in users and writable only here.
 */
export type Sql = postgres.Sql<Record<string, unknown>>;

export function connect(url = databaseUrl()): Sql {
  if (!url) throw new Error("Set DATABASE_URL (or SUPABASE_DB_URL) to the Postgres connection string. Local: postgresql://postgres:postgres@127.0.0.1:55422/postgres");
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  return postgres(url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 30,
    ssl: local ? false : "require",
    onnotice: () => undefined,
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !/:6543\//.test(url),
  });
}

export function databaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.DATABASE_URL?.trim() || env.SUPABASE_DB_URL?.trim() || undefined;
}

const BATCH = 400;

function chunks<T>(xs: T[], n = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export async function upsertSources(sql: Sql, defs: SourceDefinition[]) {
  for (const d of defs) {
    await sql`
      insert into catalog_sources (id, name, homepage, docs_url, terms_url, license, attribution, kinds, region, cadence, needs_key, enabled, priority, notes, updated_at)
      values (${d.id}, ${d.name}, ${d.homepage}, ${d.docsUrl ?? null}, ${d.termsUrl ?? null}, ${d.license}, ${d.attribution ?? null}, ${d.kinds}, ${d.region}, ${d.cadence}, ${d.needsKey ?? null}, ${d.enabled}, ${d.priority}, ${d.notes ?? d.covers}, now())
      on conflict (id) do update set name = excluded.name, homepage = excluded.homepage, docs_url = excluded.docs_url, terms_url = excluded.terms_url,
        license = excluded.license, attribution = excluded.attribution, kinds = excluded.kinds, region = excluded.region, cadence = excluded.cadence,
        needs_key = excluded.needs_key, enabled = excluded.enabled, priority = excluded.priority, notes = excluded.notes, updated_at = now()`;
  }
}

/** Funder keys to ids, filled as funders are written so opportunities can point at them. */
export class FunderIndex {
  private ids = new Map<string, string>();
  constructor(private sql: Sql) {}

  set(key: string, id: string) {
    this.ids.set(key, id);
  }

  async resolve(keys: string[]): Promise<Map<string, string>> {
    const missing = [...new Set(keys.filter((k) => k && !this.ids.has(k)))];
    for (const part of chunks(missing, 1000)) {
      const rows = await this.sql<{ id: string; key: string }[]>`select id, key from catalog_funders where key = any(${part})`;
      for (const r of rows) this.ids.set(r.key, r.id);
    }
    return this.ids;
  }
}

export async function upsertFunders(sql: Sql, source: string, rows: FunderInput[], index: FunderIndex): Promise<number> {
  let n = 0;
  // Last write wins inside one batch: Postgres refuses two updates of the same row in one statement.
  const unique = [...new Map(rows.map((r) => [r.key, r])).values()];
  for (const part of chunks(unique)) {
    const values = part.map((f) => ({
      key: f.key,
      name: f.name.slice(0, 300),
      kind: f.kind,
      parent_key: f.parentKey ?? null,
      ein: f.ein ?? null,
      website: f.website ?? null,
      city: f.city ?? null,
      state: f.state ?? null,
      country: f.country ?? "US",
      focus: f.focus ?? [],
      geography: f.geography ?? [],
      accepts_applications: f.acceptsApplications ?? null,
      grants_to_individuals: f.grantsToIndividuals ?? null,
      typical_grant_min: f.typicalGrantMin ?? null,
      typical_grant_median: f.typicalGrantMedian ?? null,
      typical_grant_max: f.typicalGrantMax ?? null,
      total_giving: f.totalGiving ?? null,
      assets: f.assets ?? null,
      tax_year: f.taxYear ?? null,
      source,
      source_url: f.sourceUrl,
      extra: sql.json((f.extra ?? {}) as postgres.JSONValue),
      content_hash: sha1(stableStringify({ ...f, giving: undefined })),
    }));
    const out = await sql<{ id: string; key: string }[]>`
      insert into catalog_funders ${sql(values)}
      on conflict (key) do update set
        name = case when catalog_funders.source = excluded.source then excluded.name else catalog_funders.name end,
        kind = case when catalog_funders.source = excluded.source then excluded.kind else catalog_funders.kind end, parent_key = coalesce(excluded.parent_key, catalog_funders.parent_key),
        ein = coalesce(excluded.ein, catalog_funders.ein), website = coalesce(excluded.website, catalog_funders.website),
        city = coalesce(excluded.city, catalog_funders.city), state = coalesce(excluded.state, catalog_funders.state), country = excluded.country,
        focus = case when cardinality(excluded.focus) > 0 then excluded.focus else catalog_funders.focus end,
        geography = case when cardinality(excluded.geography) > 0 then excluded.geography else catalog_funders.geography end,
        accepts_applications = coalesce(excluded.accepts_applications, catalog_funders.accepts_applications),
        grants_to_individuals = coalesce(excluded.grants_to_individuals, catalog_funders.grants_to_individuals),
        typical_grant_min = coalesce(excluded.typical_grant_min, catalog_funders.typical_grant_min),
        typical_grant_median = coalesce(excluded.typical_grant_median, catalog_funders.typical_grant_median),
        typical_grant_max = coalesce(excluded.typical_grant_max, catalog_funders.typical_grant_max),
        total_giving = coalesce(excluded.total_giving, catalog_funders.total_giving), assets = coalesce(excluded.assets, catalog_funders.assets),
        tax_year = coalesce(excluded.tax_year, catalog_funders.tax_year),
        source_url = excluded.source_url, extra = catalog_funders.extra || excluded.extra, content_hash = excluded.content_hash, last_checked = now(), updated_at = now()
      where catalog_funders.content_hash is distinct from excluded.content_hash
      returning id, key`;
    // Unchanged funders were skipped by the update and returned no id; look theirs up.
    await index.resolve(part.map((f) => f.key));
    for (const r of out) index.set(r.key, r.id);
    n += out.length;
    const giving = part.flatMap((f) => (f.giving ?? []).map((g) => ({ f, g })));
    if (giving.length) {
      const ids = await index.resolve(giving.map((x) => x.f.key));
      const gv = giving
        .filter((x) => ids.get(x.f.key))
        .map(({ f, g }) => ({
          funder_id: ids.get(f.key)!,
          year: g.year,
          total_giving: g.totalGiving ?? null,
          grant_count: g.grantCount ?? null,
          grant_median: g.grantMedian ?? null,
          grant_min: g.grantMin ?? null,
          grant_max: g.grantMax ?? null,
          assets: g.assets ?? null,
          source_url: g.sourceUrl ?? null,
        }));
      const dedup = [...new Map(gv.map((r) => [`${r.funder_id}|${r.year}`, r])).values()];
      if (dedup.length)
        await sql`insert into catalog_funder_giving ${sql(dedup)}
          on conflict (funder_id, year) do update set total_giving = excluded.total_giving, grant_count = excluded.grant_count,
          grant_median = excluded.grant_median, grant_min = excluded.grant_min, grant_max = excluded.grant_max, assets = excluded.assets, source_url = excluded.source_url`;
    }
  }
  return n;
}

function cleanArray(xs: string[] | undefined): string[] {
  return [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];
}

export function toRow(sql: Sql, source: string, license: string, o: OpportunityInput, funderId: string | null) {
  const summary = trimSummary(o.summary);
  const normalized: OpportunityInput = { ...o, summary };
  return {
    source,
    source_id: o.sourceId.slice(0, 300),
    source_url: o.sourceUrl,
    opportunity_number: o.opportunityNumber?.trim() || null,
    canonical_key: canonicalKey(o),
    type: o.type,
    notice_type: o.noticeType ?? null,
    title: o.title.trim().slice(0, 500),
    summary,
    funder_id: funderId,
    funder_name: o.funderName?.trim() || null,
    agency_code: o.agencyCode ?? null,
    status: o.status,
    posted_at: o.postedAt ?? null,
    open_at: o.openAt ?? null,
    close_at: o.closeAt ?? null,
    close_text: o.closeText?.slice(0, 300) ?? null,
    archive_at: o.archiveAt ?? null,
    rolling: o.rolling ?? false,
    key_dates: sql.json((o.keyDates ?? []) as unknown as postgres.JSONValue),
    amount_min: o.amountMin ?? null,
    amount_max: o.amountMax ?? null,
    amount_total: o.amountTotal ?? null,
    award_count: o.awardCount ?? null,
    currency: o.currency ?? "USD",
    eligibility: cleanArray(o.eligibility),
    eligibility_text: o.eligibilityText ? trimSummary(o.eligibilityText, 800) : null,
    naics: cleanArray(o.naics),
    psc: o.psc ?? null,
    set_aside: o.setAside ?? null,
    set_aside_code: o.setAsideCode ?? null,
    assistance_listings: cleanArray(o.assistanceListings),
    research_areas: cleanArray(o.researchAreas),
    causes: cleanArray(o.causes),
    categories: cleanArray(o.categories),
    place_state: o.place?.state ?? null,
    place_city: o.place?.city ?? null,
    place_country: o.place ? (o.place.country === undefined ? "US" : o.place.country) : "US",
    place_zip: o.place?.zip ?? null,
    place_text: o.place?.text?.slice(0, 300) ?? null,
    attachments: sql.json((o.attachments ?? []).slice(0, 40) as unknown as postgres.JSONValue),
    amendments: sql.json((o.amendments ?? []).slice(0, 40) as unknown as postgres.JSONValue),
    contact: o.contact ? sql.json(o.contact as unknown as postgres.JSONValue) : null,
    extra: sql.json((o.extra ?? {}) as postgres.JSONValue),
    license: o.license ?? license,
    content_hash: contentHash(normalized),
    last_checked: new Date(),
  };
}

export async function upsertOpportunities(sql: Sql, source: string, license: string, rows: OpportunityInput[], index: FunderIndex): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  const unique = [...new Map(rows.filter((r) => r.title?.trim() && r.sourceUrl).map((r) => [r.sourceId, r])).values()];
  const ids = await index.resolve(unique.map((r) => r.funderKey ?? "").filter(Boolean));
  for (const part of chunks(unique)) {
    const values = part.map((o) => toRow(sql, source, license, o, o.funderKey ? (ids.get(o.funderKey) ?? null) : null));
    const out = await sql<{ inserted: boolean }[]>`
      insert into catalog_opportunities ${sql(values)}
      on conflict (source, source_id) do update set
        source_url = excluded.source_url, opportunity_number = excluded.opportunity_number, canonical_key = excluded.canonical_key,
        type = excluded.type, notice_type = excluded.notice_type, title = excluded.title, summary = excluded.summary,
        funder_id = coalesce(excluded.funder_id, catalog_opportunities.funder_id), funder_name = excluded.funder_name, agency_code = excluded.agency_code,
        status = excluded.status, posted_at = excluded.posted_at, open_at = excluded.open_at, close_at = excluded.close_at, close_text = excluded.close_text,
        archive_at = excluded.archive_at, rolling = excluded.rolling, key_dates = excluded.key_dates,
        amount_min = excluded.amount_min, amount_max = excluded.amount_max, amount_total = excluded.amount_total, award_count = excluded.award_count, currency = excluded.currency,
        eligibility = excluded.eligibility, eligibility_text = excluded.eligibility_text, naics = excluded.naics, psc = excluded.psc,
        set_aside = excluded.set_aside, set_aside_code = excluded.set_aside_code, assistance_listings = excluded.assistance_listings,
        research_areas = excluded.research_areas, causes = excluded.causes, categories = excluded.categories,
        place_state = excluded.place_state, place_city = excluded.place_city, place_country = excluded.place_country, place_zip = excluded.place_zip, place_text = excluded.place_text,
        attachments = excluded.attachments, amendments = excluded.amendments, contact = excluded.contact, extra = excluded.extra, license = excluded.license,
        content_hash = excluded.content_hash, last_checked = excluded.last_checked,
        embedding = case when catalog_opportunities.title = excluded.title and catalog_opportunities.summary is not distinct from excluded.summary then catalog_opportunities.embedding else null end
      where catalog_opportunities.content_hash is distinct from excluded.content_hash
         or catalog_opportunities.status is distinct from excluded.status
      returning (xmax = 0) as inserted`;
    for (const r of out) (r.inserted ? added++ : updated++);
    // Unchanged rows were still seen today.
    await sql`update catalog_opportunities set last_checked = now() where source = ${source} and source_id = any(${part.map((p) => p.sourceId.slice(0, 300))})`;
  }
  return { added, updated };
}

export async function upsertAwards(sql: Sql, source: string, rows: AwardStatInput[]): Promise<number> {
  let n = 0;
  const keyOf = (a: AwardStatInput) => [a.awardType, a.agency, a.subAgency, a.naics, a.psc, a.assistanceListing, a.activityCode, a.program, a.placeState, a.setAside, a.fiscalYear].join("|");
  const unique = [...new Map(rows.map((r) => [keyOf(r), r])).values()];
  for (const part of chunks(unique)) {
    const values = part.map((a) => ({
      source,
      award_type: a.awardType,
      agency: a.agency,
      sub_agency: a.subAgency ?? null,
      naics: a.naics ?? null,
      psc: a.psc ?? null,
      assistance_listing: a.assistanceListing ?? null,
      activity_code: a.activityCode ?? null,
      program: a.program ?? null,
      place_state: a.placeState ?? null,
      set_aside: a.setAside ?? null,
      fiscal_year: a.fiscalYear,
      award_count: a.awardCount,
      total_amount: a.totalAmount,
      median_amount: a.medianAmount ?? null,
      p25_amount: a.p25Amount ?? null,
      p75_amount: a.p75Amount ?? null,
      min_amount: a.minAmount ?? null,
      max_amount: a.maxAmount ?? null,
      source_url: a.sourceUrl ?? null,
      last_checked: new Date(),
    }));
    const out = await sql`
      insert into catalog_award_stats ${sql(values)}
      on conflict (source, award_type, agency, sub_agency, naics, psc, assistance_listing, activity_code, program, place_state, set_aside, fiscal_year)
      do update set award_count = excluded.award_count, total_amount = excluded.total_amount, median_amount = excluded.median_amount,
        p25_amount = excluded.p25_amount, p75_amount = excluded.p75_amount, min_amount = excluded.min_amount, max_amount = excluded.max_amount,
        source_url = excluded.source_url, last_checked = excluded.last_checked
      returning id`;
    n += out.length;
  }
  return n;
}

export async function startRun(sql: Sql, source: string, mode: string, trigger: string): Promise<number> {
  const [r] = await sql<{ id: number }[]>`insert into catalog_ingest_runs (source, mode, trigger, host) values (${source}, ${mode}, ${trigger}, ${process.env.GITHUB_ACTIONS ? "github-actions" : "local"}) returning id`;
  return r.id;
}

export async function finishRun(
  sql: Sql,
  id: number,
  r: { status: string; seen: number; added: number; updated: number; closed: number; funders: number; awards: number; errors: { message: string; detail?: string }[]; notes?: string; startedAt: number },
) {
  await sql`update catalog_ingest_runs set status = ${r.status}, finished_at = now(), duration_ms = ${Date.now() - r.startedAt},
    rows_seen = ${r.seen}, rows_added = ${r.added}, rows_updated = ${r.updated}, rows_closed = ${r.closed},
    funders_upserted = ${r.funders}, awards_upserted = ${r.awards}, error_count = ${r.errors.length},
    errors = ${sql.json(r.errors.slice(0, 25) as unknown as postgres.JSONValue)}, notes = ${r.notes ?? null}
    where id = ${id}`;
}

export async function lastSuccess(sql: Sql, source: string): Promise<Date | null> {
  const [r] = await sql<{ started_at: Date }[]>`select started_at from catalog_ingest_runs where source = ${source} and status in ('succeeded', 'partial') order by started_at desc limit 1`;
  return r?.started_at ?? null;
}

/** After a full snapshot: open rows this run did not see have left the source. */
export async function closeUnseen(sql: Sql, source: string, since: Date): Promise<number> {
  const out = await sql`update catalog_opportunities set status = 'closed'
    where source = ${source} and status in ('open', 'forecasted') and last_checked < ${since} returning id`;
  return out.length;
}

/** Expire and dedupe, one run at a time across every job (an advisory lock), so concurrent sources never deadlock. */
export async function expireAndDedupe(sql: Sql): Promise<{ expired: number; deduped: number }> {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7203481)`;
    const [e] = await tx<{ n: number }[]>`select catalog_expire() as n`;
    const [d] = await tx<{ n: number }[]>`select catalog_dedupe() as n`;
    return { expired: e.n, deduped: d.n };
  }) as Promise<{ expired: number; deduped: number }>;
}

/** Old change history is pruned: two years is enough for trends. */
export async function prune(sql: Sql) {
  await sql`delete from catalog_opportunity_changes where changed_at < now() - interval '2 years'`;
  await sql`delete from catalog_ingest_runs where started_at < now() - interval '180 days'`;
}
