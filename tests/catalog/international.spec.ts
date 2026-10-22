import { expect, test } from "@playwright/test";
import {
  euFundingTenders,
  readFacets,
  toOpportunity as euToOpportunity,
  topicBudget,
  topicDeadlines,
  wallClock,
  euDay,
  type SediaPage,
  type SediaResult,
} from "@/lib/catalog/connectors/_intl-eu";
import {
  releaseEffect,
  toOpportunity as ukToOpportunity,
  ukContractsFinder,
  ukDeadline,
  ukFindAGrant,
  ukFindATender,
  type OcdsPackage,
} from "@/lib/catalog/connectors/_intl-uk";
import { toOpportunity as wbToOpportunity, wbDeadline, worldBankProcurement, type WbPage } from "@/lib/catalog/connectors/_intl-worldbank";
import { countryCode, zonedIso } from "@/lib/catalog/connectors/_intl-shared";
import { connectors } from "@/lib/catalog/connectors/international";
import type { PoliteFetch } from "@/lib/catalog/types";
import { fixture, fixtureFetch, runOffline } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00Z");

const RealDate = Date;
test.beforeAll(() => {
  // Status rules compare with the clock; the recorded responses are from 22 October 2026.
  const fixed = NOW.getTime();
  // Only `new Date()` with no arguments and Date.now() are pinned.
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string]));
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
});
test.afterAll(() => {
  globalThis.Date = RealDate;
});

// ---------- shared helpers ----------

test.describe("international helpers", () => {
  test("local times carry the zone's offset for that day", () => {
    expect(zonedIso("2027-12-01", "17:00", "Europe/Brussels")).toBe("2027-12-01T17:00:00+01:00");
    expect(zonedIso("2027-06-01", "17:00", "Europe/Brussels")).toBe("2027-06-01T17:00:00+02:00");
    expect(zonedIso("2026-11-20", "23:59", "Europe/London")).toBe("2026-11-20T23:59:00+00:00");
    expect(zonedIso("not a day", "17:00", "Europe/Brussels")).toBeNull();
  });

  test("country names in World Bank and EU style map to ISO codes; regions do not", () => {
    expect(countryCode("Congo, Democratic Republic of")).toBe("CD");
    expect(countryCode("Lao People's Democratic Republic")).toBe("LA");
    expect(countryCode("St. Kitts and Nevis")).toBe("KN");
    expect(countryCode("Somalia, Federal Republic of")).toBe("SO");
    expect(countryCode("Ukraine")).toBe("UA");
    expect(countryCode("Western and Central Africa")).toBeNull();
    expect(countryCode(null)).toBeNull();
  });

  test("the module registers every international source, Find a grant off", () => {
    expect(connectors.map((c) => c.source.id).sort()).toEqual(["eu_funding_tenders", "uk_contracts_finder", "uk_find_a_grant", "uk_find_a_tender", "world_bank_procurement"]);
    expect(connectors.find((c) => c.source.id === "uk_find_a_grant")!.source.enabled).toBe(false);
    for (const c of connectors) {
      expect(c.source.region).toBe("international");
      expect(`${c.source.name} ${c.source.covers} ${c.source.notes ?? ""}`).not.toMatch(/[–—]/);
    }
  });
});

// ---------- EU Funding & Tenders Portal ----------

const EU = "eu_funding_tenders";
const facets = readFacets(JSON.parse(fixture(EU, "facets.json")));
const page = (file: string) => JSON.parse(fixture(EU, file)) as SediaPage;
const topics = page("search-topics.json").results;
const byId = (rs: SediaResult[], id: string) => rs.filter((r) => r.metadata.identifier?.[0] === id);
const topic = (id: string) => byId(topics, id)[0];

test.describe("EU Funding & Tenders Portal", () => {
  test("a forthcoming Horizon Europe topic is research funding with its budget and a 17:00 Brussels deadline", () => {
    const o = euToOpportunity(topic("HORIZON-CL5-2027-07-D3-32"), facets, NOW)!.opportunity;
    expect(o.type).toBe("research");
    expect(o.status).toBe("forecasted");
    expect(o.opportunityNumber).toBe("HORIZON-CL5-2027-07-D3-32");
    expect(o.sourceUrl).toBe("https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CL5-2027-07-D3-32");
    expect(o.closeAt).toBe("2027-12-01T17:00:00+01:00");
    expect(o.closeText).toBe("17:00 Brussels time");
    expect(o.openAt).toBe("2027-08-04");
    expect(o).toMatchObject({ amountMin: 10_000_000, amountMax: 10_000_000, amountTotal: 30_000_000, awardCount: 3, currency: "EUR" });
    expect(o.funderKey).toBe("intl:eu:HORIZON");
    expect(o.agencyCode).toBe("HORIZON");
    expect(o.place).toEqual({ country: null, text: "European Union" });
    expect(o.summary).not.toMatch(/<[a-z]/i);
  });

  test("a two-stage topic closes for new applicants at the first stage", () => {
    const o = euToOpportunity(topic("HORIZON-CL4-2027-02-DIGITAL-EMERGING-52-two-stage"), facets, NOW)!.opportunity;
    expect(o.status).toBe("open");
    expect(o.closeAt).toBe("2027-02-02T17:00:00+01:00");
    expect(o.keyDates?.map((k) => k.kind)).toEqual(expect.arrayContaining(["stage_1_deadline", "stage_2_deadline"]));
    expect(o.keyDates?.find((k) => k.kind === "stage_2_deadline")?.date).toBe("2027-09-02");
  });

  test("programmes outside Horizon Europe are grants; stale topics the index still calls open are dropped", () => {
    const crea = euToOpportunity(topic("CREA-MEDIA-2027-FILMSALES"), facets, NOW)!;
    expect(crea.opportunity.type).toBe("grant");
    expect(crea.opportunity.funderName).toMatch(/Creative Europe/);
    expect(crea.funders[0].parentKey).toBe("intl:eu");
    expect(euToOpportunity(topic("JTM-2022-2025-PSLF-LOAN-SCHEMES"), facets, NOW)).toBeNull();
    expect(euToOpportunity(topic("HORIZON-EIC-2026-STEP"), facets, NOW)).toBeNull();
  });

  test("multiple cut-off topics close at the next cut-off still ahead", () => {
    const records = byId(topics, "ERASMUS-EDU-2022-ECHE-CERT-FP");
    expect(records).toHaveLength(2);
    // The older record lists a 2027 cut-off; the current one ends in March 2026.
    const old = records.find((r) => (r.metadata.deadlineDate ?? []).some((d) => d.startsWith("2027")))!;
    const d = topicDeadlines(old.metadata, NOW);
    expect(d.closeAt).toBe("2027-01-26T17:00:00+01:00");
    expect(d.keyDates.filter((k) => k.kind === "cutoff").length).toBeGreaterThan(3);
  });

  test("budget lines are matched to the topic, not the whole call", () => {
    const m = topic("HORIZON-CL5-2027-07-D3-32").metadata;
    expect(topicBudget(m, "HORIZON-CL5-2027-07-D3-32").awardCount).toBe(3);
    expect(topicBudget(m, "HORIZON-NOT-IN-THIS-CALL")).toEqual({ amountMin: null, amountMax: null, amountTotal: null, awardCount: null });
  });

  test("external action calls link to the portal page and read the deadline in Brussels time", () => {
    const rs = page("search-prospect.json").results;
    const o = euToOpportunity(rs[0], facets, NOW)!.opportunity;
    expect(o.type).toBe("grant");
    expect(o.opportunityNumber).toBe("EuropeAid/187764/DD/ACT/UA");
    expect(o.sourceUrl).toBe("https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/prospect-details/187764PROSPECTSEN");
    expect(o.closeAt).toBe("2026-11-19T16:00:00+01:00");
    expect(o.amountTotal).toBe(1_500_000);
    expect(o.place).toEqual({ country: "UA", text: "Ukraine" });
    expect(o.attachments!.length).toBeGreaterThan(0);
    for (const a of o.attachments!) expect(a.url).toMatch(/^https:\/\//);
  });

  test("cascade calls use their own call id and never the parent topic number", () => {
    const rs = page("search-cascade.json").results;
    const open = rs.map((r) => euToOpportunity(r, facets, NOW)).filter(Boolean);
    expect(open).toHaveLength(1);
    const o = open[0]!.opportunity;
    expect(o.sourceId).toBe("cascade-12447");
    expect(o.sourceUrl).toBe("https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/competitive-calls-cs/12447");
    expect(o.opportunityNumber).toBeNull();
    expect(o.title).toMatch(/GreenChips/);
    expect(o.closeAt).toBe("2027-02-14T23:59:00+01:00");
    expect(o.closeText).toBe("23:59 Brussels time");
    expect(o.amountTotal).toBe(40_000);
  });

  test("tenders: local deadlines, currency, vendor lists, prior information notices, and stale records", () => {
    const rs = page("search-tenders.json").results;
    const get = (id: string) => euToOpportunity(rs.find((r) => r.metadata.identifier?.[0] === id)!, facets, NOW);
    const ep = get("b8b428bf-8eb2-4eb0-99ad-f76d84fe28d6-CN")!.opportunity;
    expect(ep.type).toBe("contract");
    expect(ep.status).toBe("open");
    expect(ep.opportunityNumber).toBe("EP-INLO/SXB/2026/OP/0032");
    expect(ep.closeAt).toBe("2026-12-21T15:00:00+01:00");
    expect(ep.closeText).toBe("15:00 Europe/Paris time");
    expect(ep.amountMax).toBe(6_000_000);
    expect(ep.currency).toBe("EUR");
    expect(ep.funderName).toMatch(/European Parliament/);
    const tz = get("e4fa8154-99fc-4828-acac-2f3658156ab8-CN")!.opportunity;
    expect(tz.currency).toBe("TZS");
    const vendor = get("e34cbaf3-7232-47fb-9906-1da9a876e790-CN")!.opportunity;
    expect(vendor.rolling).toBe(true);
    expect(vendor.closeAt).toBeNull();
    expect(get("9080d2c9-683d-4230-80e3-474e5af2f128-EXA")).toBeNull();
    expect(get("06f28169-0cce-40db-818b-78a106c04fd9-PIN")!.opportunity.status).toBe("forecasted");
    expect(get("0059eca6-14aa-4b60-8e10-179169bdec56-PIN")).toBeNull();
    const old = get("92f60a5f-9ed8-4e11-8582-82c4aab3a4d9")!.opportunity;
    expect(old.postedAt).toBe("2023-05-19");
  });

  test("index dates and stamps: day-first dates and wall-clock times", () => {
    expect(euDay("25/01/2021")).toBe("2021-01-25");
    expect(euDay("2024-09-06+02:00 Europe/Brussels")).toBe("2024-09-06");
    expect(euDay("")).toBeNull();
    expect(wallClock("2026-06-28T22:59:00.000+0000", "Europe/Brussels")).toBe("2026-06-28T22:59:00+02:00");
  });

  test("malformed records are skipped without throwing", () => {
    const base = topic("HORIZON-CL5-2027-07-D3-32");
    const broken: SediaResult = { ...base, metadata: { ...base.metadata, title: [], identifier: [] } };
    expect(euToOpportunity(broken, facets, NOW)).toBeNull();
    const badJson: SediaResult = { ...base, metadata: { ...base.metadata, actions: ["{not json"], budgetOverview: ["[oops"] } };
    const o = euToOpportunity(badJson, facets, NOW)!.opportunity;
    expect(o.closeAt).toBe("2027-12-01T17:00:00+01:00");
    expect(o.amountTotal).toBeNull();
    expect(euToOpportunity({ reference: "x", url: "", metadata: { type: ["9"] } }, facets, NOW)).toBeNull();
  });

  test("the connector reads every record type in date windows, emits funders first, and dedupes repeats", async () => {
    const { fetch, queries } = euFetch();
    const { sink, result } = await runOffline(euFundingTenders, fetch);
    expect(result.status).toBe("succeeded");
    const ids = sink.opportunityRows.map((o) => o.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["HORIZON-CL5-2027-07-D3-32", "EuropeAid/187764/DD/ACT/UA", "cascade-12447", "b8b428bf-8eb2-4eb0-99ad-f76d84fe28d6-CN"]));
    expect(ids).not.toContain("ERASMUS-EDU-2022-ECHE-CERT-FP");
    const keys = new Set(sink.funderRows.map((f) => f.key));
    expect(keys.has("intl:eu")).toBe(true);
    for (const o of sink.opportunityRows) expect(keys.has(o.funderKey!)).toBe(true);
    expect(queries.every((q) => q.includes("esDA_IngestDate"))).toBe(true);
    expect(sink.opportunityRows.every((o) => o.sourceUrl.startsWith("https://"))).toBe(true);
  });

  test("an incremental run asks only for records indexed since the last run, less a day", async () => {
    const { fetch, queries } = euFetch();
    await runOffline(euFundingTenders, fetch, { mode: "incremental", since: new Date("2026-10-20T06:00:00Z") });
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) expect(q).toContain('"gte":"2026-10-19T06:00:00.000+0000"');
  });

  test("the limit stops the run early", async () => {
    const { fetch } = euFetch();
    const { sink } = await runOffline(euFundingTenders, fetch, { limit: 2 });
    expect(sink.opportunityRows).toHaveLength(2);
  });
});

/** Answers the EU Search and Facet APIs from the recorded pages, routing on the record type in the posted query. */
function euFetch() {
  const files: Record<string, string> = { "1": "search-topics.json", "2": "search-prospect.json", "8": "search-cascade.json", "0": "search-tenders.json" };
  const queries: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    if (url.includes("/rest/facet")) return new Response(fixture(EU, "facets.json"), { status: 200 });
    const body = init?.body as FormData;
    const q = await (body.get("query") as Blob).text();
    queries.push(q);
    const type = (JSON.parse(q) as { bool: { must: { terms?: { type?: string[] } }[] } }).bool.must.find((m) => m.terms?.type)!.terms!.type![0];
    const data = page(files[type]);
    if (/pageSize=1&/.test(url)) return new Response(JSON.stringify({ ...data, results: data.results.slice(0, 1), pageSize: 1 }), { status: 200 });
    return new Response(JSON.stringify(data), { status: 200 });
  }) as PoliteFetch;
  return { fetch: f, queries };
}

// ---------- UK ----------

const CF = "uk_contracts_finder";
const FTS = "uk_find_a_tender";
const cfPages = [1, 2, 3].map((i) => JSON.parse(fixture(CF, `page${i}.json`)) as OcdsPackage);
const ftsPages = [1, 2].map((i) => JSON.parse(fixture(FTS, `page${i}.json`)) as OcdsPackage);

test.describe("UK Contracts Finder and Find a Tender", () => {
  test("open tenders map with GBP, the notice link, a UK-scoped dedupe key, and SME and VCSE eligibility", () => {
    const releases = cfPages.flatMap((p) => p.releases ?? []);
    const rows = releases.map((r) => ukToOpportunity("cf", r, NOW)).filter(Boolean);
    // One of the nine closed on 20 October.
    expect(rows).toHaveLength(8);
    const brave = rows.find((x) => x!.opportunity.opportunityNumber === "BRAVE-IS-002")!.opportunity;
    expect(brave.eligibility).toEqual(["small_business", "nonprofit"]);
    expect(brave.sourceUrl).toMatch(/^https:\/\/www\.contractsfinder\.service\.gov\.uk\/Notice\/[0-9a-f-]{36}$/);
    expect(brave.place?.country).toBe("GB");
    expect(brave.canonicalKey).toMatch(/^gb:[a-z0-9-]+:BRAVE-IS-002$/);
    const valued = rows.find((x) => x!.opportunity.amountMax === 668_100)!.opportunity;
    expect(valued.currency).toBe("GBP");
    expect(valued.closeAt).toBe("2026-11-25T10:00:00.000Z");
    expect(rows.every((x) => x!.funder?.key.startsWith("intl:gb:"))).toBe(true);
  });

  test("bare closing dates mean the end of that day in London", () => {
    expect(ukDeadline("2026-11-20")).toBe("2026-11-20T23:59:00+00:00");
    expect(ukDeadline("2026-07-01")).toBe("2026-07-01T23:59:00+01:00");
    expect(ukDeadline("2026-11-27T12:00:00Z")).toBe("2026-11-27T12:00:00.000Z");
    expect(ukDeadline(undefined)).toBeNull();
  });

  test("Find a Tender releases: awards close a process, partial updates and planning are ignored", () => {
    const releases = ftsPages.flatMap((p) => p.releases ?? []);
    const effects = releases.map((r) => [r.ocid, releaseEffect("fts", r, NOW).kind] as const);
    const kinds = Object.fromEntries(effects);
    expect(kinds["ocds-h6vhtk-078b83"]).toBe("open");
    expect(kinds["ocds-h6vhtk-078b85"]).toBe("closed");
    expect(kinds["ocds-h6vhtk-078b86"]).toBe("ignore");
    expect(kinds["ocds-h6vhtk-06f4b4"]).toBe("ignore");
    const o = ukToOpportunity("fts", releases.find((r) => r.ocid === "ocds-h6vhtk-078b83")!, NOW)!.opportunity;
    expect(o.sourceUrl).toMatch(/^https:\/\/www\.find-tender\.service\.gov\.uk\/Notice\/\d{6}-\d{4}$/);
    expect(o.type).toBe("contract");
  });

  test("Contracts Finder paging follows links.next and asks for the tender stage over a year", async () => {
    const f = fixtureFetch(CF, [
      [/cursor=.*Nzg3MTg5/, "page2.json"],
      [/cursor=.*Nzg3MTQ3/, "page3.json"],
      [/Published\/Notices\/OCDS\/Search\?stages=tender/, "page1.json"],
    ]);
    const { sink, result } = await runOffline(ukContractsFinder, f);
    expect(result.status).toBe("succeeded");
    expect(f.calls).toHaveLength(3);
    expect(f.calls[0]).toMatch(/publishedFrom=2025-10-22T12:00:00&publishedTo=2026-10-22T12:00:00/);
    expect(sink.opportunityRows).toHaveLength(8);
    const keys = new Set(sink.funderRows.map((x) => x.key));
    for (const o of sink.opportunityRows) expect(keys.has(o.funderKey!)).toBe(true);
  });

  test("an incremental Contracts Finder run starts a day before the last run", async () => {
    const f = fixtureFetch(CF, [[/./, "page3.json"]]);
    await runOffline(ukContractsFinder, f, { mode: "incremental", since: new Date("2026-10-21T06:00:00Z") });
    expect(f.calls[0]).toContain("publishedFrom=2026-10-20T06:00:00");
  });

  test("Contracts Finder's 403 slow-down answer pauses and retries", async () => {
    let n = 0;
    const f = (async () => (n++ === 0 ? new Response("Too many requests", { status: 403 }) : new Response(fixture(CF, "page3.json"), { status: 200 }))) as PoliteFetch;
    const { result } = await runOffline(ukContractsFinder, f, { env: { UK_CF_PAUSE_MS: "1" } });
    expect(result.status).toBe("succeeded");
    expect(n).toBe(2);
  });

  test("Find a Tender reads every release type, keeps open tenders, and stops at the limit", async () => {
    const f = fixtureFetch(FTS, [
      [/cursor=.*PTc1MTI0Ng/, "page2.json"],
      [/cursor=/, () => JSON.stringify({ releases: [], links: {} })],
      [/ocdsReleasePackages\?limit=100&updatedFrom=/, "page1.json"],
    ]);
    const { sink } = await runOffline(ukFindATender, f);
    expect(f.calls[0]).not.toContain("stages=");
    expect(sink.opportunityRows.map((o) => o.sourceId).sort()).toEqual(["ocds-h6vhtk-078b7c", "ocds-h6vhtk-078b80", "ocds-h6vhtk-078b83"]);
    const limited = await runOffline(ukFindATender, fixtureFetch(FTS, [[/cursor=.*PTc1MTI0Ng/, "page2.json"], [/./, "page1.json"]]), { limit: 1 });
    expect(limited.sink.opportunityRows).toHaveLength(1);
  });

  test("a malformed release is skipped", () => {
    expect(ukToOpportunity("cf", { ocid: "", id: "x" }, NOW)).toBeNull();
    expect(ukToOpportunity("cf", { ocid: "ocds-x", id: "x", tender: { status: "active", tenderPeriod: { endDate: "soon" }, title: "A" } }, NOW)).toBeNull();
  });

  test("Find a grant is off and fetches nothing", async () => {
    expect(ukFindAGrant.source.enabled).toBe(false);
    const f = fixtureFetch("uk_find_a_grant", []);
    const { sink, result } = await runOffline(ukFindAGrant, f);
    expect(result.status).toBe("succeeded");
    expect(f.calls).toHaveLength(0);
    expect(sink.opportunityRows).toHaveLength(0);
  });
});

// ---------- World Bank ----------

const WB = "world_bank_procurement";
const wbPages = [1, 2, 3].map((i) => JSON.parse(fixture(WB, `page${i}.json`)) as WbPage);

test.describe("World Bank procurement notices", () => {
  test("open invitations map with the deadline, country, project, and link", () => {
    const n = wbPages[0].procnotices!.find((x) => x.id === "OP00437669")!;
    const o = wbToOpportunity(n, NOW)!;
    expect(o.type).toBe("contract");
    expect(o.status).toBe("open");
    expect(o.sourceUrl).toBe("https://projects.worldbank.org/en/projects-operations/procurement-detail/OP00437669");
    expect(o.closeAt).toBe("2027-11-13T12:00:00Z");
    expect(o.closeText).toBe("12:00 local time in Nigeria");
    expect(o.place).toEqual({ country: "NG", text: "Nigeria" });
    expect(o.funderKey).toBe("intl:worldbank");
    expect(o.extra?.project).toMatch(/^P\d+$/);
    expect(o.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("notices due today keep only those whose hour is still ahead; regions stay as text", () => {
    const rows = wbPages[1].procnotices!.map((n) => wbToOpportunity(n, NOW)).filter(Boolean);
    expect(rows).toHaveLength(6);
    const region = wbToOpportunity(wbPages[1].procnotices!.find((x) => x.id === "OP00474174")!, NOW)!;
    expect(region.place).toEqual({ country: null, text: "Western and Central Africa" });
    expect(wbPages[2].procnotices!.map((n) => wbToOpportunity(n, NOW)).filter(Boolean)).toHaveLength(0);
  });

  test("awards and malformed notices are never kept", () => {
    expect(wbToOpportunity({ id: "OP1", notice_type: "Contract Award", submission_deadline_date: "2027-01-01T00:00:00Z" }, NOW)).toBeNull();
    expect(wbToOpportunity({ id: "OP2", notice_type: "Invitation for Bids" }, NOW)).toBeNull();
    expect(wbToOpportunity({ id: "OP3", notice_type: "Invitation for Bids", submission_deadline_date: "2027-01-01T00:00:00Z", notice_status: "Cancelled", bid_description: "x" }, NOW)).toBeNull();
    expect(wbDeadline({ id: "OP4", submission_deadline_date: "2027-01-01T00:00:00Z", submission_deadline_time: "25:99" }).closeAt).toBe("2027-01-01T23:59:00Z");
  });

  test("the connector pages by deadline and stops once a page is all past", async () => {
    const f = fixtureFetch(WB, [
      [/os=0&/, "page1.json"],
      [/os=10&/, "page2.json"],
      [/os=20&/, "page3.json"],
    ]);
    const { sink, result } = await runOffline(worldBankProcurement, f);
    expect(result.status).toBe("succeeded");
    expect(f.calls).toHaveLength(3);
    expect(f.calls[0]).toContain("srt=submission_deadline_date&order=desc");
    expect(sink.opportunityRows).toHaveLength(16);
    expect(sink.funderRows.map((x) => x.key)).toEqual(["intl:worldbank"]);
  });
});
