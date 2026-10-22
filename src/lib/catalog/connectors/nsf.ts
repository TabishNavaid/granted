import * as cheerio from "cheerio";
import { deadline, int, isoDate, money, plainText } from "../normalize";
import type { Connector, FunderInput, IngestContext, KeyDate, OpportunityInput, ResearchAreaCode, SourceDefinition } from "../types";
import { stateCode, uniq } from "../vocab";
import { getJson, getText } from "../ingest/http";
import { AwardAggregator, MIN_STATE_GROUP, completedFiscalYears, fiscalYearOf } from "./_research-stats";

/**
 * U.S. National Science Foundation.
 *
 * nsf_funding: every funding opportunity page on nsf.gov (programs with their solicitations or program descriptions,
 * and Dear Colleague Letters that invite proposals). nsf.gov has no feed of all opportunities: its CSV export and the
 * filtered search are disallowed in robots.txt, and the two RSS feeds cover only new items and the next 30 days. The
 * site's sitemap lists every opportunity page, and those pages are allowed, so we read the sitemap and each page
 * (about 420, one request a second). Due dates roll forward on the page without the page changing, so incremental runs
 * read every page too.
 *
 * nsf_awards: past awards from the NSF Award Search API (api.nsf.gov), aggregated by directorate, program, state, and
 * fiscal year. Award rows are never stored.
 */

const NSF_FUNDER: FunderInput = {
  key: "agency:NSF",
  name: "U.S. National Science Foundation",
  kind: "federal_agency",
  website: "https://www.nsf.gov",
  country: "US",
  sourceUrl: "https://www.nsf.gov/funding/opportunities",
};

const NSF_ORIGIN = "https://www.nsf.gov";

// ---------------------------------------------------------------- funding opportunities

export const fundingSource: SourceDefinition = {
  id: "nsf_funding",
  name: "NSF funding opportunities",
  covers: "Every NSF program, solicitation, program description, and Dear Colleague Letter inviting proposals, with due dates, target dates, and accepted-anytime programs.",
  homepage: "https://www.nsf.gov/funding/opportunities",
  docsUrl: "https://www.nsf.gov/sitemap.xml",
  termsUrl: "https://www.nsf.gov/policies/reuse.jsp",
  license: "Public domain (U.S. government work)",
  attribution: "Courtesy: U.S. National Science Foundation",
  kinds: ["research", "scholarship"],
  region: "us",
  cadence: "Daily",
  schedule: "10 11 * * *",
  enabled: true,
  priority: 20,
};

export interface SitemapEntry {
  url: string;
  lastmod: string | null;
}

/** <loc> and <lastmod> pairs from a sitemap or sitemap index. */
export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/g)) {
    const loc = m[1].match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1] ?? null;
    out.push({ url: loc.replace(/&amp;/g, "&"), lastmod });
  }
  return out;
}

/** Opportunity pages are /funding/opportunities/<slug>; deeper paths are solicitation versions and announcements. */
export function isOpportunityPage(url: string): boolean {
  return /^https:\/\/www\.nsf\.gov\/funding\/opportunities\/[a-z0-9-]+$/i.test(url);
}

/**
 * NSF numbers to the form Grants.gov uses: "NSF 26-526" to "26-526", "PD 23-1242" to "PD-23-1242".
 * Grants.gov lists NSF solicitations by the bare number and program descriptions with a PD- prefix.
 */
export function grantsGovNumber(n: string | null | undefined): string | null {
  if (!n) return null;
  const m = n.trim().toUpperCase().match(/^(NSF|PD)\s*-?\s*(\d{2}-\d{3,4}[A-Z]?)$/);
  if (!m) return null;
  return m[1] === "PD" ? `PD-${m[2]}` : m[2];
}

const NUMBER_RE = /\b(NSF|PD)\s?(\d{2}-\d{3,4}[A-Z]?)\b/;

/** Directorates and divisions (by the abbreviation NSF prints in parentheses) to our research areas. */
const AREA_BY_ORG: Record<string, ResearchAreaCode[]> = {
  BIO: ["life_sciences"],
  CISE: ["computing"],
  ENG: ["engineering"],
  GEO: ["geosciences"],
  OPP: ["geosciences"],
  MPS: ["physical_sciences"],
  DMS: ["math"],
  AST: ["space"],
  SBE: ["social_sciences"],
  EDU: ["education_research"],
  TIP: ["engineering"],
  DEB: ["environment", "life_sciences"],
  CHE: ["physical_sciences"],
  DMR: ["physical_sciences"],
  PHY: ["physical_sciences"],
};

export interface NsfDueDate {
  proposalType: string;
  date: string;
  dateType: string | null;
  note: string | null;
}

export interface NsfPage {
  url: string;
  slug: string;
  kind: "program" | "dcl" | "other";
  title: string;
  shortDescription: string | null;
  synopsis: string | null;
  number: string | null;
  statusText: string | null;
  waiting: boolean;
  anytime: string[];
  dueDates: NsfDueDate[];
  dueTimeText: string | null;
  organizations: string[];
  audiences: string | null;
  awardInfo: string | null;
  estimatedAwards: string | null;
  eligibilityInfo: string | null;
  published: string | null;
  updated: string | null;
  /** Slug of the page whose due dates this page shares (programs under one umbrella solicitation). */
  datesFrom?: string;
}

function txt($el: cheerio.Cheerio<never> | cheerio.Cheerio<import("domhandler").AnyNode>): string {
  return plainText($el.html() ?? "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

/** One nsf.gov opportunity page to its parts. */
export function parseNsfPage(html: string, url: string): NsfPage {
  const $ = cheerio.load(html);
  const slug = url.replace(/\/+$/, "").split("/").pop() ?? url;
  const kind: NsfPage["kind"] = $(".node--type-dear-colleague-letter").length ? "dcl" : $(".node--type-program").length ? "program" : "other";
  const title = txt($("h1 .field--name-title").first()) || txt($("h1").first());
  const shortDescription = txt($(".field-funding-short-description").first()) || null;
  const synopsis = txt($(".field-funding-synopsis").first()).replace(/^Synopsis\s*/, "") || txt($(".field-dcl-main-text").first()) || null;

  const due = $(".block-program-due-dates-block").first();
  const hero = $(".hero__program-application-details").first();
  const heroText = txt(hero);
  const statusText = heroText.match(/Status:\s*([^|]+?)(?:\s{2,}|$)/)?.[1]?.trim() ?? null;
  const dueText = txt(due);
  const waiting = /waiting for (a )?new publication/i.test(dueText) || /waiting for (a )?new publication/i.test(statusText ?? "");
  const numberSource = [txt(hero.find("a").first()), heroText, dueText, txt($(".program-guidelines__solicitation-link").first()), txt($(".program-guidelines").first())].find((s) => NUMBER_RE.test(s)) ?? "";
  const nm = numberSource.match(NUMBER_RE);
  const number = nm ? `${nm[1]} ${nm[2]}` : null;

  const anytime: string[] = [];
  const dueDates: NsfDueDate[] = [];
  due.find(".program-due-dates__item").each((_, el) => {
    const item = $(el);
    const proposalType = txt(item.find(".program-due-dates__sub-type").first());
    if (item.hasClass("program-due-dates__item--aa") || /anytime/i.test(proposalType)) {
      anytime.push(proposalType || "Proposals accepted anytime");
      return;
    }
    item.find(".program-due-dates__due-date-item").each((__, d) => {
      const di = $(d);
      const dateRaw = txt(di.find(".program-due-dates__date-type-date").first());
      const date = isoDate(dateRaw);
      if (!date) return;
      const typeText = txt(di.find(".program-due-dates__date-type").first()).replace(dateRaw, "").replace(/^[\s-]+/, "").trim();
      const note = [txt(di.find(".program-due-dates__recur-text").first()), txt(di.find(".program-due-dates__desc").first())].filter(Boolean).join(". ") || null;
      dueDates.push({ proposalType: proposalType || "Full proposal", date, dateType: typeText || null, note });
    });
  });
  const dueTimeText = txt(due.find(".program-due-dates__due-by-time-text").first()) || null;

  const organizations: string[] = [];
  $("h2")
    .filter((_, h) => /Organization\(s\)/i.test($(h).text()))
    .first()
    .parent()
    .find("li")
    .each((_, li) => {
      const t = txt($(li));
      if (t) organizations.push(t);
    });

  const field = (name: string) => {
    const f = $(`.field--name-field-${name}`).first();
    return f.length ? txt(f.find(".field__item").first()) || txt(f) : null;
  };
  const published = $(".field-dcl-publication-date time").first().attr("datetime") ?? $(".usa-footer__meta time").first().attr("datetime") ?? null;
  const updated = $(".usa-footer__meta time").eq(1).attr("datetime") ?? null;
  return {
    url,
    slug,
    kind,
    title,
    shortDescription,
    synopsis,
    number,
    statusText,
    waiting,
    anytime,
    dueDates,
    dueTimeText,
    organizations: uniq(organizations),
    audiences: txt($(".field-funding-edu-audiences").first()) || null,
    awardInfo: field("funding-anti-funding-desc"),
    estimatedAwards: field("funding-est-number-awards"),
    eligibilityInfo: field("funding-addtnl-elig-info"),
    published: isoDate(published),
    updated: isoDate(updated),
  };
}

/**
 * Programs under an umbrella solicitation (a division's core programs) often show no dates of their own; the page that
 * carries the solicitation's dates does. Pages with the same number and no dates take those dates.
 */
export function inheritUmbrellaDates(pages: NsfPage[]): NsfPage[] {
  const source = new Map<string, NsfPage>();
  for (const p of pages) {
    if (!p.number || p.waiting || (!p.dueDates.length && !p.anytime.length)) continue;
    const cur = source.get(p.number);
    if (!cur || p.dueDates.length + p.anytime.length > cur.dueDates.length + cur.anytime.length) source.set(p.number, p);
  }
  return pages.map((p) => {
    const src = p.number ? source.get(p.number) : undefined;
    if (!src || src === p || p.waiting || p.dueDates.length || p.anytime.length) return p;
    return { ...p, dueDates: src.dueDates, anytime: src.anytime, dueTimeText: p.dueTimeText ?? src.dueTimeText, datesFrom: src.slug };
  });
}

/** A Dear Colleague Letter that asks for proposals, as opposed to one that announces a policy or an event. */
export function dclInvitesProposals(p: Pick<NsfPage, "shortDescription" | "title" | "dueDates" | "anytime">): boolean {
  if (p.dueDates.length || p.anytime.length) return true;
  const s = `${p.title}. ${p.shortDescription ?? ""}`;
  return /\b(invit|encourag|solicit|welcom|seek|accept)\w*\b[^.]{0,200}\b(proposals?|submissions?|applications?|supplement requests?)\b/i.test(s);
}

function orgAbbrevs(orgs: string[]): string[] {
  return uniq(orgs.flatMap((o) => [...o.matchAll(/\(([A-Z/]{2,12})\)/g)].map((m) => m[1].split("/").pop()!)));
}

function firstMoney(text: string | null): number | null {
  if (!text || !/^\s*(Up to\s+|Approximately\s+)?\$/i.test(text)) return null;
  const m = text.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion)?/i);
  if (!m) return null;
  const base = money(m[1]);
  if (!base) return null;
  return m[2] ? base * (m[2].toLowerCase() === "million" ? 1e6 : 1e9) : base;
}

/**
 * One page to our model. `sharedNumber` says another program page names the same solicitation (umbrella solicitations
 * such as a division's core programs); those rows keep their own dedupe key so each program stays findable.
 */
export function toNsfOpportunity(p: NsfPage, opts: { sharedNumber?: boolean; now?: Date } = {}): OpportunityInput | null {
  const now = opts.now ?? new Date();
  if (!p.title) return null;
  if (p.kind === "other") return null;
  if (p.kind === "dcl" && !dclInvitesProposals(p)) return null;
  const nowMs = now.getTime();
  const number = grantsGovNumber(p.number);
  const isFull = (d: NsfDueDate) => /full|application/i.test(d.proposalType) || !/letter of intent|preliminary|pre-?proposal/i.test(d.proposalType);
  const sorted = [...p.dueDates].sort((a, b) => a.date.localeCompare(b.date));
  const future = sorted.filter((d) => new Date(deadline(d.date)!).getTime() >= nowMs);
  const nextFull = future.find(isFull) ?? null;
  const next = nextFull ?? future[0] ?? null;
  const rolling = p.anytime.length > 0;
  let status: OpportunityInput["status"];
  let closeAt: string | null = next ? deadline(next.date) : null;
  let closeText: string | null = null;
  if (p.waiting) {
    status = "forecasted";
    closeAt = null;
    closeText = "Waiting for a new solicitation";
  } else if (next) {
    status = "open";
    if (next.dateType && /target/i.test(next.dateType)) closeText = `Target date${nextFull ? "" : ` (${next.proposalType.toLowerCase()})`}`;
    else if (!nextFull) closeText = `${next.proposalType} due`;
  } else if (rolling) {
    status = "open";
    closeText = p.anytime.join("; ");
  } else if (sorted.length) {
    status = "closed";
    closeAt = deadline(sorted[sorted.length - 1].date);
  } else {
    status = "open";
    closeText = p.kind === "dcl" ? "See the letter for how and when to submit" : number ? "See the solicitation for due dates" : "See the program page for how to apply";
  }
  if (rolling && status === "open" && next) closeText = [closeText, p.anytime.join("; ")].filter(Boolean).join("; ");

  const keyDates: KeyDate[] = sorted.map((d) => ({
    kind: /letter of intent/i.test(d.proposalType) ? "loi" : /preliminary|pre-?proposal/i.test(d.proposalType) ? "preliminary" : "due",
    date: d.date,
    label: `${d.proposalType}${d.dateType ? `, ${d.dateType.toLowerCase()}` : ""}${d.note ? ` (${d.note.slice(0, 120)})` : ""}`,
  }));
  const abbrevs = orgAbbrevs(p.organizations);
  const researchAreas = uniq(abbrevs.flatMap((a) => AREA_BY_ORG[a] ?? []));
  const sbir = /\b(SBIR|STTR|Small Business Innovation Research|Small Business Technology Transfer)\b/i.test(p.title);
  const fellowship = /\bfellowships?\b/i.test(p.title);
  const estimated = p.estimatedAwards?.replace(/\s+/g, " ").trim() || null;
  return {
    sourceId: p.slug,
    sourceUrl: p.url,
    opportunityNumber: number,
    canonicalKey: opts.sharedNumber || !number ? `nsf:${p.slug}` : /^\d/.test(number) ? `num:NSF${number}` : null,
    type: fellowship && !sbir ? "scholarship" : "research",
    noticeType: p.kind === "dcl" ? "dear_colleague_letter" : number?.startsWith("PD-") ? "program_description" : number ? "solicitation" : "program",
    title: p.title,
    summary: [p.shortDescription, p.synopsis].filter(Boolean).join(" ") || null,
    funderKey: NSF_FUNDER.key,
    funderName: NSF_FUNDER.name,
    agencyCode: "NSF",
    status,
    postedAt: p.published,
    openAt: null,
    closeAt,
    closeText: closeText?.slice(0, 300) ?? null,
    rolling: rolling && !next,
    keyDates,
    amountTotal: firstMoney(p.awardInfo),
    awardCount: estimated && /^\d[\d,]*$/.test(estimated) ? int(estimated) : null,
    eligibility: sbir ? ["small_business"] : fellowship ? ["individual"] : [],
    eligibilityText: p.eligibilityInfo,
    researchAreas,
    categories: p.organizations.slice(0, 12),
    place: { country: "US" },
    attachments: number && p.number ? [{ name: `Program guidelines (${p.number})`, url: `${p.url}/${p.number.toLowerCase().replace(/\s+/g, "")}/solicitation` }] : [],
    extra: {
      nsfNumber: p.number ?? undefined,
      directorates: abbrevs,
      statusText: p.statusText ?? undefined,
      anytime: p.anytime.length ? p.anytime : undefined,
      dueTime: p.dueTimeText ?? undefined,
      audiences: p.audiences ?? undefined,
      estimatedAwards: estimated ?? undefined,
      awardInformation: p.awardInfo?.slice(0, 400) ?? undefined,
      lastUpdated: p.updated ?? undefined,
      datesFrom: p.datesFrom ? `${NSF_ORIGIN}/funding/opportunities/${p.datesFrom}` : undefined,
    },
  };
}

/** Every opportunity page listed in the nsf.gov sitemap. */
export async function nsfOpportunityPages(ctx: Pick<IngestContext, "fetch">): Promise<SitemapEntry[]> {
  const index = parseSitemap(await getText(ctx.fetch, `${NSF_ORIGIN}/sitemap.xml`));
  const pages = index.some((e) => /sitemap\.xml\?page=/.test(e.url)) ? index.filter((e) => /sitemap/.test(e.url)) : [];
  const entries: SitemapEntry[] = pages.length ? [] : index;
  for (const p of pages) entries.push(...parseSitemap(await getText(ctx.fetch, p.url)));
  const seen = new Set<string>();
  return entries.filter((e) => isOpportunityPage(e.url) && !seen.has(e.url) && seen.add(e.url));
}

export const nsfFunding: Connector = {
  source: fundingSource,
  fullSnapshot: true,
  async run(ctx) {
    await ctx.funders([NSF_FUNDER]);
    const entries = await nsfOpportunityPages(ctx);
    ctx.log(`${entries.length} opportunity pages in the sitemap`);
    const pages: NsfPage[] = [];
    for (const e of entries) {
      if (ctx.limit !== null && pages.length >= ctx.limit * 2) break;
      try {
        const html = await getText(ctx.fetch, e.url);
        pages.push(parseNsfPage(html, e.url));
      } catch (err) {
        ctx.warn(`Could not read ${e.url}`, err);
      }
    }
    const byNumber = new Map<string, number>();
    const all = inheritUmbrellaDates(pages);
    const umbrella = new Map<string, string>();
    for (const p of all) if (p.number && p.datesFrom) umbrella.set(p.number, p.datesFrom);
    for (const p of all) if (p.kind === "program" && p.number) byNumber.set(p.number, (byNumber.get(p.number) ?? 0) + 1);
    let skipped = 0;
    const batch: OpportunityInput[] = [];
    for (const p of all) {
      try {
        // The umbrella's own page (the one the others took dates from) keeps the solicitation's key, so it meets the
        // Grants.gov listing; the programs under it keep their own keys.
        const shared = !!p.number && (byNumber.get(p.number) ?? 0) > 1 && umbrella.get(p.number) !== p.slug;
        const o = toNsfOpportunity(p, { sharedNumber: shared });
        if (o) batch.push(o);
        else skipped++;
      } catch (err) {
        ctx.warn(`Could not read NSF opportunity ${p.slug}`, err);
      }
    }
    await ctx.opportunities(batch);
    ctx.log(`${pages.length} pages read, ${batch.length} opportunities, ${skipped} skipped (letters without a call for proposals)`);
  },
};

// ---------------------------------------------------------------- awards

export const awardsSource: SourceDefinition = {
  id: "nsf_awards",
  name: "NSF Award Search",
  covers: "Past NSF awards, summarized by directorate, program, state, and fiscal year (counts, totals, and typical award sizes).",
  homepage: "https://www.nsf.gov/awardsearch/",
  docsUrl: "https://resources.research.gov/common/webapi/awardapisearch-v1.htm",
  termsUrl: "https://www.nsf.gov/policies/reuse.jsp",
  license: "Public domain (U.S. government work)",
  attribution: "Courtesy: U.S. National Science Foundation",
  kinds: ["research"],
  region: "us",
  cadence: "Weekly",
  // Tuesday 07:00 UTC: the API is often down for maintenance from Friday night to Sunday noon Eastern.
  schedule: "0 7 * * 2",
  enabled: true,
  priority: 20,
};

const AWARDS_API = "https://api.nsf.gov/services/v1/awards.json";
const AWARDS_RPP = 25;
const AWARDS_CAP = 3_000;

export interface NsfAward {
  id?: string;
  date?: string;
  estimatedTotalAmt?: string;
  fundsObligatedAmt?: string;
  dirAbbr?: string;
  fundProgramName?: string;
  awardeeStateCode?: string;
  awardeeCountryCode?: string;
  transType?: string;
}

interface AwardsResponse {
  response?: { metadata?: { totalCount?: number }; award?: NsfAward[]; serviceNotification?: unknown };
}

function usDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export function awardsUrl(fromIso: string, toIso: string, offset: number): string {
  const q = new URLSearchParams({ dateStart: usDate(fromIso), dateEnd: usDate(toIso), rpp: String(AWARDS_RPP), offset: String(offset), sortKey: "awardNumber" });
  return `${AWARDS_API}?${q.toString()}`;
}

/**
 * Adds one award (new awards by their award date). Levels: directorate x program; directorate x state; directorate;
 * all of NSF by state; all of NSF. A null field in a row means "all".
 */
export function addNsfAward(agg: AwardAggregator, a: NsfAward): boolean {
  const day = isoDate(a.date);
  const fy = day ? fiscalYearOf(day) : null;
  const amount = money(a.estimatedTotalAmt) ?? money(a.fundsObligatedAmt);
  const dir = a.dirAbbr?.trim() || null;
  if (!fy || !amount) return false;
  // fundProgramName is the funding program element; awards funded by several list them comma-joined, and those are
  // left out of the program level (the "program" field holds reference codes, not the program).
  const fund = a.fundProgramName?.trim() ?? "";
  const program = fund && !fund.includes(", ") ? fund : null;
  const state = (a.awardeeCountryCode ?? "US") === "US" ? stateCode(a.awardeeStateCode ?? null) : null;
  const base = { awardType: "research" as const, agency: "NSF", fiscalYear: fy, sourceUrl: "https://www.nsf.gov/awardsearch/" };
  if (dir && program) agg.add({ ...base, subAgency: dir, program }, amount);
  if (dir && state) agg.add({ ...base, subAgency: dir, placeState: state }, amount);
  if (dir) agg.add({ ...base, subAgency: dir }, amount);
  if (state) agg.add({ ...base, placeState: state }, amount);
  agg.add(base, amount);
  return true;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Month windows covering a fiscal year (October through September). */
export function fiscalYearMonths(fy: number): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 3 ? fy - 1 : fy;
    const m = ((9 + i) % 12) + 1;
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    out.push([start, addDays(next, -1)]);
  }
  return out;
}

export function nsfAwardYears(ctx: Pick<IngestContext, "mode" | "env">, now = new Date()): number[] {
  const forced = ctx.env.NSF_AWARD_YEARS?.split(",").map((x) => Number(x.trim())).filter((x) => x > 1990);
  if (forced?.length) return forced;
  return completedFiscalYears(ctx.mode === "backfill" ? 3 : 1, now);
}

export const nsfAwards: Connector = {
  source: awardsSource,
  async run(ctx) {
    await ctx.funders([NSF_FUNDER]);
    const agg = new AwardAggregator();
    const seen = new Set<string>();
    // --limit samples: read at most this many awards per month window.
    const perWindow = ctx.limit ?? Infinity;
    const readWindow = async (from: string, to: string): Promise<number> => {
      const first = await getJson<AwardsResponse>(ctx.fetch, awardsUrl(from, to, 0));
      const total = first.response?.metadata?.totalCount ?? 0;
      if (total > AWARDS_CAP && from < to) {
        // The API shows at most 3,000 results per query: split the window.
        const span = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
        const mid = addDays(from, Math.floor(span / 2));
        return (await readWindow(from, mid)) + (await readWindow(addDays(mid, 1), to));
      }
      if (total > AWARDS_CAP) ctx.warn(`${total} awards on ${from}; only the first ${AWARDS_CAP} can be read`);
      let read = 0;
      let page = first.response?.award ?? [];
      let offset = 0;
      for (;;) {
        for (const a of page) {
          if (!a.id || seen.has(a.id)) continue;
          seen.add(a.id);
          if (addNsfAward(agg, a)) read++;
        }
        offset += AWARDS_RPP;
        if (!page.length || offset >= Math.min(total, AWARDS_CAP) || offset >= perWindow) break;
        try {
          page = (await getJson<AwardsResponse>(ctx.fetch, awardsUrl(from, to, offset))).response?.award ?? [];
        } catch (err) {
          ctx.warn(`NSF awards page failed for ${from} to ${to} at ${offset}`, err);
          break;
        }
      }
      return read;
    };
    for (const fy of nsfAwardYears(ctx)) {
      let n = 0;
      for (const [from, to] of fiscalYearMonths(fy)) {
        try {
          n += await readWindow(from, to);
        } catch (err) {
          ctx.warn(`NSF awards failed for ${from} to ${to}`, err);
        }
      }
      ctx.log(`FY${fy}: ${n} awards aggregated`);
    }
    await ctx.awards(agg.rows(1, MIN_STATE_GROUP));
  },
};

export const connectors: Connector[] = [nsfFunding, nsfAwards];
