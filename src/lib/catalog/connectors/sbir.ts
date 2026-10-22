import { createReadStream } from "node:fs";
import * as cheerio from "cheerio";
import { parse } from "csv-parse";
import { deadline, isoDate, money, plainText, statusFromDates } from "../normalize";
import type { Connector, FunderInput, IngestContext, KeyDate, OpportunityInput, ResearchAreaCode, SourceDefinition } from "../types";
import { stateCode, uniq } from "../vocab";
import { getText } from "../ingest/http";
import { AwardAggregator, MIN_STATE_GROUP, completedFiscalYears } from "./_research-stats";

/**
 * SBIR and STTR (America's Seed Fund), from SBIR.gov.
 *
 * The SBIR.gov APIs (api.www.sbir.gov/public/api/solicitations and /awards) answer 403 and the API page says they are
 * "undergoing maintenance", so:
 *
 * sbir_topics: open solicitations from the public topic search pages (www.sbir.gov/topics?status=Open, ten topics a page)
 * and each topic page, grouped into one row per agency solicitation with its topic count. About 300 open topics, so a
 * run is about 330 requests at one a second. The topic search's CSV download is a form post, so we read pages instead.
 *
 * sbir_awards: the complete award file SBIR.gov publishes for download (award_data_no_abstract.csv, about 90 MB, rebuilt
 * daily), aggregated by agency, branch, phase, program, state, and fiscal year. Company names and contacts are never kept.
 */

const SBIR_ORIGIN = "https://www.sbir.gov";

/** SBIR.gov agency abbreviations (as its API page lists them) to the Grants.gov agency code we key federal funders by. */
export const SBIR_AGENCIES: Record<string, { code: string; name: string; areas: ResearchAreaCode[] }> = {
  DOW: { code: "DOD", name: "Department of War", areas: ["defense"] },
  DOD: { code: "DOD", name: "Department of War", areas: ["defense"] },
  HHS: { code: "HHS", name: "Department of Health and Human Services", areas: ["biomedical"] },
  NASA: { code: "NASA", name: "National Aeronautics and Space Administration", areas: ["space"] },
  NSF: { code: "NSF", name: "U.S. National Science Foundation", areas: [] },
  DOE: { code: "DOE", name: "Department of Energy", areas: ["energy"] },
  USDA: { code: "USDA", name: "Department of Agriculture", areas: ["agriculture"] },
  EPA: { code: "EPA", name: "Environmental Protection Agency", areas: ["environment"] },
  DOC: { code: "DOC", name: "Department of Commerce", areas: [] },
  ED: { code: "ED", name: "Department of Education", areas: ["education_research"] },
  DOT: { code: "DOT", name: "Department of Transportation", areas: ["engineering"] },
  DHS: { code: "DHS", name: "Department of Homeland Security", areas: ["defense"] },
};

function agencyFunder(abbr: string): FunderInput | null {
  const a = SBIR_AGENCIES[abbr.toUpperCase()];
  if (!a) return null;
  // Funder records are shared with Grants.gov, which names the department by its statutory name.
  return { key: `agency:${a.code}`, name: a.code === "DOD" ? "Department of Defense" : a.name, kind: "federal_agency", country: "US", sourceUrl: `${SBIR_ORIGIN}/topics` };
}

// ---------------------------------------------------------------- topics and solicitations

export const topicsSource: SourceDefinition = {
  id: "sbir_topics",
  name: "SBIR.gov solicitations",
  covers: "Open SBIR and STTR solicitations from all eleven participating agencies, with topic counts and open and close dates, for U.S. small businesses.",
  homepage: "https://www.sbir.gov/topics",
  docsUrl: "https://www.sbir.gov/data-resources",
  termsUrl: "https://www.sba.gov/about-sba/open-government/about-sbagov-website/policies-notices",
  license: "Public domain (U.S. government work)",
  attribution: "Source: SBIR.gov, U.S. Small Business Administration",
  kinds: ["research"],
  region: "us",
  cadence: "Daily",
  schedule: "25 11 * * *",
  enabled: true,
  priority: 30,
};

export function topicsListUrl(page: number): string {
  return `${SBIR_ORIGIN}/topics?keywords=&status=Open&page=${page}`;
}

/** Topic ids on one search results page, and the total the page reports. */
export function parseTopicList(html: string): { ids: string[]; total: number | null } {
  const $ = cheerio.load(html);
  const ids: string[] = [];
  $("#search-results-hits h3 a[href^='/topics/']").each((_, a) => {
    const m = ($(a).attr("href") ?? "").match(/^\/topics\/(\d+)$/);
    if (m) ids.push(m[1]);
  });
  const total = $("#edit-count").text().match(/of\s+([\d,]+)\s+results/i)?.[1];
  return { ids: uniq(ids), total: total ? Number(total.replace(/,/g, "")) : null };
}

export interface SbirTopic {
  id: string;
  url: string;
  title: string;
  agency: string | null;
  branch: string | null;
  year: number | null;
  topicNumber: string | null;
  solicitationNumber: string | null;
  tags: string[];
  status: string | null;
  officialUrl: string | null;
  releaseDate: string | null;
  openDate: string | null;
  dueDates: string[];
  closeDate: string | null;
  description: string | null;
}

/** One topic page. */
export function parseTopicPage(html: string, id: string): SbirTopic {
  const $ = cheerio.load(html);
  const label = (name: string) => {
    let out: string | null = null;
    $("p strong").each((_, s) => {
      if (out === null && $(s).text().replace(/:\s*$/, "").trim().toLowerCase() === name.toLowerCase()) out = plainText($(s).parent().text().replace($(s).text(), "")).trim() || null;
    });
    return out as string | null;
  };
  const agencyBox = $("h3")
    .filter((_, h) => $(h).text().trim() === "Funding Agency")
    .first()
    .parent();
  const agencyLines = agencyBox
    .find("p")
    .map((_, p) => $(p).text().trim())
    .get()
    .filter(Boolean);
  const schedule: Record<string, string> = {};
  $(".usa-step-indicator__segment-label").each((_, p) => {
    const k = $(p).find("strong").text().trim();
    const v = plainText(($(p).html() ?? "").replace(/<strong[\s\S]*?<\/strong>/, ""));
    if (k) schedule[k.toLowerCase()] = v;
  });
  const dueDates = uniq(
    (schedule["due date(s)"] ?? "")
      .split(/\n|;|,(?=\s*[A-Z][a-z]+ \d)/)
      .map((x) => isoDate(x.trim()))
      .filter((x): x is string => !!x),
  ).sort();
  const official = $("a")
    .filter((_, a) => /View Official Solicitation/i.test($(a).text()))
    .first()
    .attr("href");
  const statusText = $("p")
    .filter((_, p) => /Solicitation Status:/i.test($(p).text()))
    .first()
    .find("span")
    .text()
    .trim();
  const year = Number(label("Year"));
  return {
    id,
    url: `${SBIR_ORIGIN}/topics/${id}`,
    title: plainText($("section.grid-container h2").first().text()) || plainText($("h2").first().text()),
    agency: agencyLines[0]?.toUpperCase() ?? null,
    branch: agencyLines[1] ?? null,
    year: Number.isFinite(year) && year > 1980 ? year : null,
    topicNumber: label("Topic Number"),
    solicitationNumber: label("Solicitation Number"),
    tags: uniq(
      $("p.usa-sr-only")
        .filter((_, p) => /Tagged as/i.test($(p).text()))
        .first()
        .parent()
        .find("p:not(.usa-sr-only)")
        .map((_, p) => $(p).text().trim())
        .get()
        .filter(Boolean),
    ),
    status: statusText || null,
    officialUrl: official && /^https?:\/\//.test(official) ? official : null,
    releaseDate: isoDate(schedule["release date"]),
    openDate: isoDate(schedule["open date"]),
    dueDates,
    closeDate: isoDate(schedule["close date"]),
    description: plainText($(".pre-form-wrapped").first().html() ?? "") || null,
  };
}

/** Topics grouped by agency and solicitation number into one opportunity each. */
export function toSolicitations(topics: SbirTopic[], now = new Date()): { funders: FunderInput[]; rows: OpportunityInput[] } {
  const groups = new Map<string, SbirTopic[]>();
  for (const t of topics) {
    if (!t.agency || !t.title) continue;
    const key = `${t.agency}|${t.solicitationNumber ?? `${t.branch ?? ""}|${t.closeDate ?? ""}`}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const funders = new Map<string, FunderInput>();
  const rows: OpportunityInput[] = [];
  const nowMs = now.getTime();
  for (const [key, ts] of groups) {
    const t0 = ts[0];
    const agency = SBIR_AGENCIES[t0.agency!];
    const funder = agencyFunder(t0.agency!);
    if (funder) funders.set(funder.key, funder);
    const branches = uniq(ts.map((t) => t.branch).filter((b): b is string => !!b));
    const programs = uniq(ts.flatMap((t) => t.tags.filter((x) => /^(SBIR|STTR)$/i.test(x)).map((x) => x.toUpperCase())));
    const opens = ts.map((t) => t.openDate).filter((x): x is string => !!x).sort();
    const releases = ts.map((t) => t.releaseDate).filter((x): x is string => !!x).sort();
    const closes = ts.map((t) => t.closeDate).filter((x): x is string => !!x).sort();
    const dues = uniq(ts.flatMap((t) => (t.dueDates.length ? t.dueDates : t.closeDate ? [t.closeDate] : []))).sort();
    const nextDue = dues.find((d) => new Date(deadline(d)!).getTime() >= nowMs) ?? null;
    const lastClose = closes[closes.length - 1] ?? dues[dues.length - 1] ?? null;
    const closeAt = deadline(nextDue ?? lastClose);
    const openAt = opens[0] ?? null;
    const status = statusFromDates(openAt, closeAt, now);
    const keyDates: KeyDate[] = [];
    if (releases[0]) keyDates.push({ kind: "release", date: releases[0], label: "Pre-release" });
    if (openAt) keyDates.push({ kind: "open", date: openAt, label: "Opens for proposals" });
    for (const d of dues) keyDates.push({ kind: "due", date: d, label: "Proposals due" });
    if (lastClose && !dues.includes(lastClose)) keyDates.push({ kind: "close", date: lastClose, label: "Closes" });
    const agencyName = agency?.name ?? t0.agency!;
    const branchLabel = branches.length === 1 && branches[0].toUpperCase() !== t0.agency ? ` (${branches[0]})` : "";
    const programLabel = programs.length ? programs.join("/") : "SBIR/STTR";
    const num = t0.solicitationNumber;
    const title = `${agencyName}${branchLabel} ${programLabel} solicitation${num ? ` ${num}` : ""}`;
    const topicTitles = ts.map((t) => t.title);
    const official = ts.map((t) => t.officialUrl).find(Boolean) ?? null;
    rows.push({
      sourceId: key.slice(0, 300),
      sourceUrl: official ?? t0.url,
      opportunityNumber: num,
      type: "research",
      noticeType: "solicitation",
      title,
      summary: `${ts.length} open topic${ts.length === 1 ? "" : "s"}: ${topicTitles.slice(0, 25).join("; ")}${ts.length > 25 ? "; and more" : ""}.`,
      funderKey: funder?.key ?? null,
      funderName: agencyName,
      agencyCode: agency?.code ?? t0.agency,
      status,
      postedAt: releases[0] ?? openAt,
      openAt,
      closeAt,
      closeText: dues.length > 1 ? "Several due dates; see the topics" : null,
      rolling: false,
      keyDates,
      eligibility: ["small_business"],
      eligibilityText: programs.includes("STTR") ? "U.S. small businesses; STTR proposals need a partner research institution." : "U.S. small businesses.",
      researchAreas: agency?.areas ?? [],
      categories: uniq([t0.agency!, ...branches, ...programs]),
      place: { country: "US" },
      attachments: ts.slice(0, 40).map((t) => ({ name: `${t.topicNumber ? `${t.topicNumber}: ` : ""}${t.title}`.slice(0, 300), url: t.url })),
      extra: {
        topicCount: ts.length,
        topicNumbers: ts.map((t) => t.topicNumber).filter(Boolean).slice(0, 200),
        branches,
        programs,
        tags: uniq(ts.flatMap((t) => t.tags)),
        year: t0.year ?? undefined,
        sbirGovTopics: `${SBIR_ORIGIN}/topics?keywords=${encodeURIComponent(num ?? "")}&status=Open`,
      },
    });
  }
  return { funders: [...funders.values()], rows };
}

export const sbirTopics: Connector = {
  source: topicsSource,
  fullSnapshot: true,
  async run(ctx: IngestContext) {
    // Every open topic is read on each run: about 300, and closing dates move. The search has no sort, and its order
    // shifts between requests, so pages are read in passes until a full pass finds nothing new (at most four).
    const ids: string[] = [];
    const seen = new Set<string>();
    let total: number | null = null;
    const cap = ctx.limit !== null ? ctx.limit * 3 : Infinity;
    for (let pass = 0; pass < 4 && ids.length < cap; pass++) {
      let fresh = 0;
      const pages = total !== null ? Math.ceil(total / 10) : 200;
      for (let page = 0; page < pages && ids.length < cap; page++) {
        const res = parseTopicList(await getText(ctx.fetch, topicsListUrl(page)));
        total ??= res.total;
        if (!res.ids.length) break;
        for (const id of res.ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          ids.push(id);
          fresh++;
        }
        if (total !== null && ids.length >= total) break;
      }
      if (!fresh || (total !== null && ids.length >= total)) break;
    }
    ctx.log(`${ids.length} open topics listed (site says ${total ?? "?"})`);
    // A short list would close solicitations we missed; a warning makes the run partial, which skips that step.
    if (total !== null && ids.length < total && ctx.limit === null) ctx.warn(`Listed ${ids.length} of ${total} open topics; the search order shifted between pages`);
    const topics: SbirTopic[] = [];
    for (const id of ids) {
      try {
        topics.push(parseTopicPage(await getText(ctx.fetch, `${SBIR_ORIGIN}/topics/${id}`), id));
      } catch (err) {
        ctx.warn(`Could not read SBIR topic ${id}`, err);
      }
    }
    const { funders, rows } = toSolicitations(topics);
    await ctx.funders(funders);
    await ctx.opportunities(rows);
    ctx.log(`${topics.length} topics in ${rows.length} solicitations`);
  },
};

// ---------------------------------------------------------------- awards

export const awardsSource: SourceDefinition = {
  id: "sbir_awards",
  name: "SBIR.gov awards",
  covers: "Past SBIR and STTR awards, summarized by agency, branch, phase, program, state, and fiscal year (counts, totals, and typical award sizes).",
  homepage: "https://www.sbir.gov/awards",
  docsUrl: "https://www.sbir.gov/data-resources",
  termsUrl: "https://www.sba.gov/about-sba/open-government/about-sbagov-website/policies-notices",
  license: "Public domain (U.S. government work)",
  attribution: "Source: SBIR.gov, U.S. Small Business Administration",
  kinds: ["research"],
  region: "us",
  cadence: "Weekly",
  schedule: "30 8 * * 3",
  enabled: true,
  priority: 30,
};

export const AWARDS_CSV = "https://data.www.sbir.gov/mod_awarddatapublic_no_abstract/award_data_no_abstract.csv";

/** Award file agency names to the agency codes we use elsewhere (Grants.gov codes). */
export function agencyCodeFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (/defense|department of war/.test(n)) return "DOD";
  if (/health and human services/.test(n)) return "HHS";
  if (/aeronautics and space/.test(n)) return "NASA";
  if (/science foundation/.test(n)) return "NSF";
  if (/department of energy/.test(n)) return "DOE";
  if (/agriculture/.test(n)) return "USDA";
  if (/environmental protection/.test(n)) return "EPA";
  if (/commerce/.test(n)) return "DOC";
  if (/department of education/.test(n)) return "ED";
  if (/transportation/.test(n)) return "DOT";
  if (/homeland security/.test(n)) return "DHS";
  return null;
}

export type AwardCsvRow = Record<string, string>;

/**
 * Adds one award row. Only the agency, branch, phase, program, state, year, and amount are read; the company and its
 * people are not. Levels: agency x branch x phase x program x state, and the same for all states (state null).
 */
export function addSbirAward(agg: AwardAggregator, r: AwardCsvRow, years: Set<number>): boolean {
  const fy = Number(r["Award Year"]);
  if (!years.has(fy)) return false;
  const amount = money(r["Award Amount"]);
  const agency = agencyCodeFromName(r["Agency"] ?? "");
  if (!amount || !agency) return false;
  const phase = plainText(r["Phase"] ?? "").replace(/^Phase\s+/i, "Phase ") || null;
  const program = (r["Program"] ?? "").trim().toUpperCase() || null;
  const branch = (r["Branch"] ?? "").trim() || null;
  const state = stateCode(r["State"] ?? null);
  const base = { awardType: "research" as const, agency, subAgency: branch, activityCode: phase, program, fiscalYear: fy, sourceUrl: "https://www.sbir.gov/awards" };
  if (state) agg.add({ ...base, placeState: state }, amount);
  agg.add(base, amount);
  return true;
}

export function sbirAwardYears(env: Record<string, string | undefined>, now = new Date()): number[] {
  const forced = env.SBIR_AWARD_YEARS?.split(",").map((x) => Number(x.trim())).filter((x) => x > 1980);
  return forced?.length ? forced : completedFiscalYears(5, now);
}

/** Streams the award file into the aggregator. Returns rows read and rows counted. */
export async function aggregateAwardFile(file: string, agg: AwardAggregator, years: Set<number>, maxRows = Infinity): Promise<{ read: number; counted: number }> {
  let read = 0;
  let counted = 0;
  const parser = createReadStream(file).pipe(parse({ columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }));
  for await (const r of parser as AsyncIterable<AwardCsvRow>) {
    read++;
    if (addSbirAward(agg, r, years)) counted++;
    if (read >= maxRows) {
      parser.destroy();
      break;
    }
  }
  return { read, counted };
}

export const sbirAwards: Connector = {
  source: awardsSource,
  async run(ctx) {
    const file = ctx.env.SBIR_AWARDS_FILE || (await ctx.download(AWARDS_CSV, "award_data_no_abstract.csv", { maxAgeHours: 20 }));
    const years = new Set(sbirAwardYears(ctx.env));
    const agg = new AwardAggregator();
    // --limit samples: read only the first N x 100 rows of the file.
    const { read, counted } = await aggregateAwardFile(file, agg, years, ctx.limit ? ctx.limit * 100 : Infinity);
    await ctx.awards(agg.rows(1, MIN_STATE_GROUP));
    ctx.log(`${read} award rows read, ${counted} in fiscal years ${[...years].sort().join(", ")}, ${agg.size} groups`);
  },
};

export const connectors: Connector[] = [sbirTopics, sbirAwards];
