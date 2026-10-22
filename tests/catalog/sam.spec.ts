import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { MemorySink, runConnector } from "@/lib/catalog/ingest/runner";
import type { IngestContext, OpportunityInput } from "@/lib/catalog/types";
import { samAssistance, samOpportunities, searchWindow } from "@/lib/catalog/connectors/sam";
import { attachmentsOf, cleanLink, fromApi, fromCsv, groupKey, responseDeadline, setAsideOf, toOpportunity, type SamNotice } from "@/lib/catalog/connectors/_sam-notices";
import { awardRange, currentObligations, eligibilityFromText, splitAgency, toProgram } from "@/lib/catalog/connectors/_sam-assistance";
import { agencyKeys, agencyName, csvRows, decodeField } from "@/lib/catalog/connectors/_sam-shared";
import { fixture, fixtureFetch, fixturePath, runOffline } from "./helpers";

/**
 * SAM.gov connectors, offline. Fixtures are real: rows cut from the public extracts downloaded 2026-10-22
 * (long text fields trimmed), and API v2 records from the app's recorded SAM.gov capture (src/lib/replay).
 */

const NOW = "2026-10-22T12:00:00Z";
const CSV = fixturePath("sam_opportunities", "ContractOpportunitiesFullCSV-sample.csv");
const AL_CSV = fixturePath("sam_assistance", "AssistanceListings-sample.csv");
const noNetwork = (async (url: string) => {
  throw new Error(`unexpected request to ${url}`);
}) as never;

async function csvNotices(): Promise<SamNotice[]> {
  const out: SamNotice[] = [];
  for await (const r of csvRows(CSV)) {
    const n = fromCsv(r);
    if (n) out.push(n);
  }
  return out;
}

function byNotice(rows: OpportunityInput[], noticeId: string) {
  return rows.find((o) => (o.extra as { noticeId?: string }).noticeId === noticeId);
}

type ApiPage = { totalRecords: number; opportunitiesData: Record<string, unknown>[] };
const apiRecords = (): Record<string, unknown>[] => [
  ...(JSON.parse(fixture("sam_opportunities", "api-search-page1.json")) as ApiPage).opportunitiesData,
  ...(JSON.parse(fixture("sam_opportunities", "api-search-page2.json")) as ApiPage).opportunitiesData,
];

test.describe("SAM.gov extract reading", () => {
  test("reads every row with its header, mixed Windows-1252 and UTF-8 text decoded", async () => {
    const ns = await csvNotices();
    expect(ns).toHaveLength(22);
    const quoted = ns.find((n) => n.noticeId === "5b14397ddab741b8a5934cfb016cfceb")!;
    expect(`${quoted.title} ${quoted.description}`).not.toMatch(/[\u0080-\u009f]/);
    // Bytes as they appear in the extract: a UTF-8 non-breaking space beside a Windows-1252 apostrophe.
    expect(decodeField(Buffer.from([0x74, 0x6f, 0xc2, 0xa0, 0x50, 0x92, 0x73]))).toBe("to P's");
    expect(decodeField(Buffer.from("Code § 1101", "utf8"))).toBe("Code § 1101");
  });

  test("deadlines keep their published offset; no offset means Eastern; a bare date is the end of that day", () => {
    expect(responseDeadline("2026-11-17T15:00:00-07:00")).toEqual({ closeAt: "2026-11-17T22:00:00.000Z", local: "2026-11-17T15:00:00-07:00", tz: "-07:00" });
    expect(responseDeadline("2026-11-21T05:00:00").closeAt).toBe("2026-11-21T10:00:00.000Z");
    expect(responseDeadline("2026-10-29T04:30:00").tz).toBe("-04:00");
    expect(responseDeadline("2026-11-23").closeAt).toBe("2026-11-23T23:59:00-05:00");
    expect(responseDeadline("")).toEqual({ closeAt: null, local: null, tz: null });
    expect(responseDeadline("TBD").closeAt).toBeNull();
  });

  test("set-asides: known codes get our label, unknown codes keep the source label, JSON-ish codes are read", () => {
    expect(setAsideOf("SDVOSBC", "Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)")).toEqual({ code: "SDVOSBC", label: "Service-disabled veteran-owned small business", smallBusiness: true });
    expect(setAsideOf('["SBA"]', "")).toEqual({ code: "SBA", label: "Total small business", smallBusiness: true });
    expect(setAsideOf("ESB", "Emerging Small Business Set Aside")).toEqual({ code: "ESB", label: "Emerging small business", smallBusiness: true });
    expect(setAsideOf("XYZ", "Some New Program Set Aside").label).toBe("Some New Program Set Aside");
    expect(setAsideOf("LAS", "Local Area Set-Aside (FAR 26.2)").smallBusiness).toBe(false);
    expect(setAsideOf("NONE", "No Set aside used")).toEqual({ code: null, label: null, smallBusiness: false });
    expect(setAsideOf('[""]', "")).toEqual({ code: null, label: null, smallBusiness: false });
  });

  test("notices sharing a solicitation number group under one key; generic numbers do not", async () => {
    const ns = await csvNotices();
    const chain = ns.filter((n) => groupKey(n) === "sol:1240LT26Q0109");
    expect(chain).toHaveLength(5);
    expect(groupKey({ solicitationNumber: "12-13-2019", noticeId: "abc" })).toBe("abc");
    expect(groupKey({ solicitationNumber: null, noticeId: "abc" })).toBe("abc");
  });

  test("maps a construction solicitation: funder, NAICS, PSC, set-aside, eligibility, place, contact, link", async () => {
    const n = (await csvNotices()).find((x) => x.noticeId === "50f1a520491f43cdb23504d918e641ac")!;
    const o = toOpportunity(n, { now: new Date(NOW), liveOnly: true }) as OpportunityInput;
    expect(o.type).toBe("contract");
    expect(o.noticeType).toBe("combined_synopsis_solicitation");
    expect(o.status).toBe("open");
    expect(o.sourceId).toBe("sol:36C24427B0003");
    expect(o.opportunityNumber).toBe("36C24427B0003");
    expect(o.sourceUrl).toBe("https://sam.gov/opp/50f1a520491f43cdb23504d918e641ac/view");
    expect(o.naics).toEqual(["236220"]);
    expect(o.psc).toBeTruthy();
    expect(o.setAsideCode).toBe("SDVOSBC");
    expect(o.eligibility).toEqual(["small_business"]);
    expect(o.funderKey).toBe("agency:sam:veterans-affairs-department-of");
    expect(o.funderName).toBe("Department of Veterans Affairs");
    expect(o.closeAt).toBe("2026-11-20T15:00:00.000Z");
    expect(o.postedAt).toBe("2026-10-21");
    expect(o.archiveAt).toBe("2027-01-19");
    expect(o.contact?.email).toMatch(/@va\.gov$/i);
    expect(o.summary).toBeTruthy();
  });

  test("status rules: past deadline closed, presolicitation forecasted, old notices stale, other types skipped", async () => {
    const ns = await csvNotices();
    const at = (id: string, liveOnly = true) => toOpportunity(ns.find((n) => n.noticeId.startsWith(id))!, { now: new Date(NOW), liveOnly });
    expect(at("3aa264f9")).toBe("past_deadline");
    expect((at("3aa264f9", false) as OpportunityInput).status).toBe("closed");
    expect((at("cde657d7") as OpportunityInput).status).toBe("forecasted");
    expect(at("e224c5e1")).toBe("stale");
    expect(at("92902371")).toBe("type");
    expect(at("3b3938d3")).toBe("type");
    // The legacy amendment type takes its base type; this one is long archived.
    expect((at("8f797c24", false) as OpportunityInput).noticeType).toBe("presolicitation");
    expect((at("8f797c24", false) as OpportunityInput).status).toBe("archived");
    const special = at("23fde1da") as OpportunityInput;
    expect(special.status).toBe("open");
    expect(special.closeAt).toBeNull();
    const foreign = at("b50a2fa1") as OpportunityInput;
    expect(foreign.place).toMatchObject({ country: "HND", state: null });
    const legacy = at("f641fdf9", false) as OpportunityInput;
    expect(legacy.funderKey).toBeNull();
  });

  test("a backfill lists one row per live solicitation, the latest notice with earlier ones as amendments", async () => {
    const { sink, result } = await runOffline(samOpportunities, noNetwork, { env: { SAM_OPPORTUNITIES_CSV_FILE: CSV, SAM_NOW: NOW } });
    expect(result.status).toBe("succeeded");
    const rows = sink.opportunityRows;
    expect(rows.map((o) => (o.extra as { noticeId: string }).noticeId.slice(0, 8)).sort()).toEqual(
      ["cde657d7", "5b14397d", "c10e3f85", "4d0d75c8", "23fde1da", "b50a2fa1", "50f1a520", "93dd4c66", "7b8608b0", "3cd8e369"].sort(),
    );
    const chain = rows.find((o) => o.sourceId === "sol:1240LT26Q0109")!;
    expect((chain.extra as { noticeId: string }).noticeId).toBe("c10e3f85ab83436ebc656c3048780c7f");
    expect(chain.amendments).toHaveLength(4);
    expect(chain.amendments![0]).toMatchObject({ date: "2026-10-21", url: "https://sam.gov/opp/cbe71bb9577648beb6b5961f0588c070/view" });
    expect(chain.amendments!.at(-1)!.date).toBe("2026-09-04");
    expect(chain.closeAt).toBe("2026-11-17T22:00:00.000Z");
    expect(chain.extra).toMatchObject({ responseTimeZone: "-07:00", responseDeadlineLocal: "2026-11-17T15:00:00-07:00" });
    expect(chain.place).toMatchObject({ city: "Mc Kinnon", state: "WY", zip: "82935", country: "US" });
    const sb = byNotice(rows, "3cd8e369482740e9a3792f4f6d3ba455")!;
    expect(sb).toMatchObject({ setAsideCode: "SBA", setAside: "Total small business", eligibility: ["small_business"], closeAt: "2026-10-29T08:30:00.000Z" });
    const open = byNotice(rows, "4d0d75c8e5a44e54ad59972a249ec55e")!;
    expect(open.eligibility).toEqual(["for_profit", "small_business"]);
    for (const o of rows) {
      expect(o.sourceUrl).toMatch(/^https:\/\/sam\.gov\/opp\/[0-9a-f]{32}\/view$/);
      expect(o.title).not.toMatch(/[—]/);
    }
  });

  test("funders come before the rows that point at them, departments before sub-tiers", async () => {
    const { sink } = await runOffline(samOpportunities, noNetwork, { env: { SAM_OPPORTUNITIES_CSV_FILE: CSV, SAM_NOW: NOW } });
    const keys = sink.funderRows.map((f) => f.key);
    for (const o of sink.opportunityRows) if (o.funderKey) expect(keys).toContain(o.funderKey);
    for (const f of sink.funderRows) if (f.parentKey) expect(keys.indexOf(f.parentKey)).toBeLessThan(keys.indexOf(f.key));
    expect(new Set(keys).size).toBe(keys.length);
    const navy = sink.funderRows.find((f) => f.key === "agency:sam:dept-of-defense/dept-of-the-navy")!;
    expect(navy).toMatchObject({ name: "Department of the Navy", kind: "federal_agency", parentKey: "agency:sam:dept-of-defense" });
    expect(sink.funderRows.find((f) => f.key === "agency:sam:dept-of-defense")!.name).toBe("Department of Defense");
  });

  test("limit stops the run early", async () => {
    const { sink, result } = await runOffline(samOpportunities, noNetwork, { env: { SAM_OPPORTUNITIES_CSV_FILE: CSV, SAM_NOW: NOW }, limit: 3 });
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(3);
  });

  test("a malformed row is counted as a warning and the rest still load", async () => {
    const dir = path.join(__dirname, "..", "..", "test-results", "catalog-cache", "sam-malformed");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "broken.csv");
    writeFileSync(file, readFileSync(CSV, "latin1").replace("cde657d7c2ac41bb9cee7c75814a786a", ""), "latin1");
    const { sink, result } = await runOffline(samOpportunities, noNetwork, { env: { SAM_OPPORTUNITIES_CSV_FILE: file, SAM_NOW: NOW } });
    expect(result.status).toBe("partial");
    expect(result.errors[0].message).toMatch(/1 extract rows had no notice id/);
    expect(sink.opportunityRows).toHaveLength(9);
  });

  test("incremental without a key reads the extract for notices posted since the last run, closed ones included", async () => {
    const logs: string[] = [];
    const sink = new MemorySink();
    const result = await runConnector(samOpportunities, sink, {
      mode: "incremental",
      since: new Date("2026-10-21T00:00:00Z"),
      env: { SAM_OPPORTUNITIES_CSV_FILE: CSV, SAM_NOW: NOW },
      fetch: noNetwork,
      log: (m) => logs.push(m),
    });
    expect(result.status).toBe("succeeded");
    expect(logs.some((l) => /SAM_GOV_API_KEY is not set; reading the public daily extract/.test(l))).toBe(true);
    const ids = sink.opportunityRows.map((o) => (o.extra as { noticeId: string }).noticeId.slice(0, 8));
    expect(ids).toContain("3aa264f9");
    expect(ids).not.toContain("3cd8e369"); // posted in September
    expect(sink.opportunityRows.find((o) => o.sourceId === "sol:HTC71126RE121")!.status).toBe("closed");
  });

  test("incremental without a key skips the download when the extract has not changed", async () => {
    const logs: string[] = [];
    const f = fixtureFetch("sam_opportunities", [[/s3\.amazonaws\.com/, () => new Response(null, { status: 200, headers: { "last-modified": "Wed, 21 Oct 2026 03:30:44 GMT" } })]]);
    const result = await runConnector(samOpportunities, new MemorySink(), { mode: "incremental", since: new Date("2026-10-21T12:00:00Z"), env: {}, fetch: f, log: (m) => logs.push(m) });
    expect(result.status).toBe("succeeded");
    expect(f.calls).toHaveLength(1);
    expect(logs.some((l) => /has not changed/.test(l))).toBe(true);
  });
});

test.describe("SAM.gov Opportunities API v2", () => {
  const KEY = "test-key-not-real";

  function apiRoute(records: Record<string, unknown>[], mode: "page" | "record" = "page") {
    return (url: string) => {
      const u = new URL(url);
      const limit = Number(u.searchParams.get("limit"));
      const offset = Number(u.searchParams.get("offset"));
      const start = mode === "page" ? offset * limit : offset;
      return new Response(JSON.stringify({ totalRecords: records.length, limit, offset, opportunitiesData: records.slice(start, start + limit) }), { headers: { "content-type": "application/json" } });
    };
  }

  test("maps a recorded v2 record the same way as an extract row", () => {
    const rec = apiRecords()[0];
    const n = fromApi(rec)!;
    expect(n).toMatchObject({ noticeId: "253aac88c88d49fd8a36bcf9abff4b0b", department: "JUSTICE, DEPARTMENT OF", subTier: "FEDERAL PRISON SYSTEM / BUREAU OF PRISONS", office: "NATIONAL ACQUISITIONS - CO" });
    const o = toOpportunity(n, { now: new Date(NOW) }) as OpportunityInput;
    expect(o).toMatchObject({
      sourceId: "sol:15BNAS27Q00000002",
      sourceUrl: "https://sam.gov/opp/253aac88c88d49fd8a36bcf9abff4b0b/view",
      noticeType: "combined_synopsis_solicitation",
      status: "open",
      setAsideCode: "8A",
      setAside: "8(a)",
      eligibility: ["small_business"],
      naics: ["236220"],
      psc: "Z2NZ",
      closeAt: "2026-11-30T16:00:00.000Z",
      funderKey: "agency:sam:justice-department-of/federal-prison-system-bureau-of-prisons",
      place: { city: "Three Rivers", state: "TX", zip: "78071", country: "US" },
      contact: { name: "Heather Buck", email: "hbuck@bop.gov" },
    });
    expect(o.summary).toMatch(/combined synopsis\/solicitation/i);
    // Same department as the extract's spelling, so both paths share one funder.
    expect(agencyKeys({ department: "JUSTICE, DEPARTMENT OF", subTier: "FEDERAL PRISON SYSTEM / BUREAU OF PRISONS" }).funderKey).toBe(o.funderKey);
  });

  test("attachments and links never keep a key or token", () => {
    // Shape from the API docs (resourceLinks are download URLs); the values here are constructed for the test.
    const n = { ...fromApi(apiRecords()[0])!, resourceLinks: ["https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123/download?api_key=SECRET&token="], additionalInfoLink: "https://example.gov/info?key=SECRET&page=2" };
    const a = attachmentsOf(n);
    expect(a).toEqual([
      { name: "Attachment 1", url: "https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123/download" },
      { name: "Additional information", url: "https://example.gov/info?page=2" },
    ]);
    expect(cleanLink("javascript:alert(1)")).toBeNull();
  });

  test("incremental with a key pages through the window and keeps the key out of every row", async () => {
    const records = apiRecords();
    const f = fixtureFetch("sam_opportunities", [[/api\.sam\.gov\/opportunities\/v2\/search/, apiRoute(records)]]);
    const { sink, result } = await runOffline(samOpportunities, f, { mode: "incremental", since: new Date("2026-10-15T00:00:00Z"), env: { SAM_GOV_API_KEY: KEY, SAM_NOW: NOW } });
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(13);
    expect(sink.opportunityRows.filter((o) => o.status === "forecasted")).toHaveLength(4);
    expect(f.calls[0]).toContain("postedFrom=10%2F14%2F2026");
    expect(f.calls[0]).toContain("limit=1000");
    expect(f.calls.every((u) => u.includes(`api_key=${KEY}`))).toBe(true);
    expect(JSON.stringify(sink.opportunityRows)).not.toContain(KEY);
    expect(JSON.stringify(sink.funderRows)).not.toContain(KEY);
    const keys = new Set(sink.funderRows.map((x) => x.key));
    for (const o of sink.opportunityRows) if (o.funderKey) expect(keys.has(o.funderKey)).toBe(true);
    // Two recorded notices carry no agency path; they keep a null funder rather than a guessed one.
    expect(sink.opportunityRows.filter((o) => !o.funderKey)).toHaveLength(2);
  });

  test("paging works whether offset is a page index or a record offset", async () => {
    const records = apiRecords();
    for (const mode of ["page", "record"] as const) {
      const f = fixtureFetch("sam_opportunities", [[/api\.sam\.gov/, apiRoute(records, mode)]]);
      const warnings: string[] = [];
      const ctx = { fetch: f, env: {}, warn: (m: string) => warnings.push(m) } as unknown as IngestContext;
      const out = await searchWindow(ctx, KEY, new Date("2026-10-01"), new Date(NOW), { limit: 5 });
      expect(new Set(out.map((r) => r.noticeId)).size).toBe(13);
      expect(out).toHaveLength(13);
      expect(warnings).toEqual([]);
    }
  });

  test("fetches a description behind the API link when the record has none, within the budget", async () => {
    const records = apiRecords().map((r) => ({ ...r }));
    const text = records[1].descriptionText as string;
    delete records[1].descriptionText;
    const f = fixtureFetch("sam_opportunities", [
      [/noticedesc/, () => new Response(JSON.stringify({ description: `<p>${text}</p>` }), { headers: { "content-type": "application/json" } })],
      [/opportunities\/v2\/search/, apiRoute(records)],
    ]);
    const { sink } = await runOffline(samOpportunities, f, { mode: "incremental", since: new Date("2026-10-15T00:00:00Z"), env: { SAM_GOV_API_KEY: KEY, SAM_NOW: NOW } });
    const o = byNotice(sink.opportunityRows, records[1].noticeId as string)!;
    expect(o.summary!.slice(0, 40)).toBe(text.replace(/\s+/g, " ").trim().slice(0, 40));
    expect(f.calls.filter((u) => u.includes("noticedesc"))).toHaveLength(1);
  });

  test("a used-up daily limit falls back to the public extract and says so", async () => {
    const logs: string[] = [];
    const f = fixtureFetch("sam_opportunities", [[/api\.sam\.gov/, () => new Response("rate limited", { status: 429 })]]);
    const sink = new MemorySink();
    const result = await runConnector(samOpportunities, sink, {
      mode: "incremental",
      since: new Date("2026-10-21T00:00:00Z"),
      env: { SAM_GOV_API_KEY: KEY, SAM_OPPORTUNITIES_CSV_FILE: CSV, SAM_NOW: NOW },
      fetch: f,
      log: (m) => logs.push(m),
    });
    expect(result.status).toBe("succeeded");
    expect(logs.some((l) => /answered 429; reading the public daily extract/.test(l))).toBe(true);
    expect(sink.opportunityRows.length).toBeGreaterThan(5);
  });
});

test.describe("SAM.gov Assistance Listings", () => {
  async function rows(): Promise<Record<string, string>[]> {
    const out: Record<string, string>[] = [];
    for await (const r of csvRows(AL_CSV)) out.push(r);
    return out;
  }
  const program = async (aln: string, liveOnly = true) => toProgram((await rows()).find((r) => r["Program Number"] === aln)!, { liveOnly });

  test("parses the agency path, award ranges, and obligations", () => {
    expect(splitAgency("NATIONAL PARK SERVICE, INTERIOR, DEPARTMENT OF THE")).toEqual({ department: "INTERIOR, DEPARTMENT OF THE", subTier: "NATIONAL PARK SERVICE" });
    expect(splitAgency("ENVIRONMENTAL PROTECTION AGENCY, ENVIRONMENTAL PROTECTION AGENCY")).toEqual({ department: "ENVIRONMENTAL PROTECTION AGENCY", subTier: "ENVIRONMENTAL PROTECTION AGENCY" });
    expect(agencyName("INTERIOR, DEPARTMENT OF THE")).toBe("Department of the Interior");
    expect(awardRange("$15,000 to $1.5M.  Average $200,000")).toEqual({ min: 15000, max: 1_500_000, average: 200000 });
    expect(awardRange("Range Low $4,125\nRange High $26,000,000\nAverage $184,060")).toEqual({ min: 4125, max: 26_000_000, average: 184060 });
    expect(awardRange("Not applicable.")).toEqual({ min: null, max: null, average: null });
    expect(currentObligations("(Cooperative Agreement) FY 24$1,650,260.00; FY 25$700,000.00; FY 26 est $0.00; - (Grant) FY 26 est $5.00; - ")).toEqual({ fiscalYear: 2026, amount: 5 });
    expect(eligibilityFromText("Not Applicable")).toEqual([]);
    expect(eligibilityFromText("Municipal, Intermunicipal, State, Federally Recognized Indian Tribe")).toEqual(expect.arrayContaining(["local_government", "state_government", "tribal"]));
    expect(eligibilityFromText("Nonprofits in the United States and its territories")).toEqual(["nonprofit"]);
  });

  test("a program becomes one rolling row keyed by its listing number", async () => {
    const o = (await program("10.047")) as OpportunityInput;
    expect(o).toMatchObject({
      sourceId: "10.047",
      sourceUrl: "https://sam.gov/fal/4c86549efed54e6799caa918d9987404/view",
      opportunityNumber: "ALN 10.047",
      canonicalKey: "aln:10.047",
      type: "grant",
      noticeType: "program",
      status: "open",
      rolling: true,
      closeAt: null,
      amountMin: 50000,
      amountMax: 300000,
      assistanceListings: ["10.047"],
      eligibility: ["tribal"],
      postedAt: "2024-04-24",
      funderKey: "agency:sam:agriculture-department-of/immediate-office-of-the-secretary-of-agriculture",
      contact: { email: "Tribal.Relations@usda.gov", phone: "(202) 205-2249" },
    });
    expect(o.summary).toMatch(/Indigenous Food Sovereignty/);
    expect(o.extra).toMatchObject({ averageAward: 250000 });
  });

  test("research programs, agencies with no sub-tier, and loan programs", async () => {
    expect(((await program("47.041")) as OpportunityInput).type).toBe("research");
    expect(((await program("47.041")) as OpportunityInput).funderKey).toBe("agency:sam:national-science-foundation");
    expect(((await program("93.00Q")) as OpportunityInput).type).toBe("research");
    expect(((await program("10.001")) as OpportunityInput)).toMatchObject({ type: "research", amountMin: 15000, amountMax: 1_500_000 });
    const epa = (await program("66.001")) as OpportunityInput;
    expect(epa.funderKey).toBe("agency:sam:environmental-protection-agency");
    expect(epa.eligibility).toEqual(expect.arrayContaining(["state_government", "local_government", "tribal"]));
    expect(await program("10.051")).toBe("not_funding");
    expect(await program("10.186")).toBe("closed");
    expect(((await program("10.186", false)) as OpportunityInput).status).toBe("closed");
    const cp = (await program("10.031")) as OpportunityInput;
    expect(`${cp.title} ${cp.summary}`).not.toMatch(/[\u0080-\u009f]/);
  });

  test("the connector reads the extract, emits funders first, and never collides with notices", async () => {
    const { sink, result } = await runOffline(samAssistance, noNetwork, { env: { SAM_ASSISTANCE_CSV_FILE: AL_CSV } });
    expect(result.status).toBe("succeeded");
    expect(sink.opportunityRows).toHaveLength(8);
    const keys = sink.funderRows.map((f) => f.key);
    for (const o of sink.opportunityRows) {
      expect(keys).toContain(o.funderKey);
      expect(o.canonicalKey).toMatch(/^aln:\d{2}\.[0-9A-Z]{3}$/);
    }
    const interior = sink.funderRows.find((f) => f.key === "agency:sam:interior-department-of-the")!;
    expect(interior.name).toBe("Department of the Interior");
  });

  test("incremental emits closed programs too, so a listing that stopped taking applications closes", async () => {
    const { sink } = await runOffline(samAssistance, noNetwork, { mode: "incremental", env: { SAM_ASSISTANCE_CSV_FILE: AL_CSV } });
    expect(sink.opportunityRows.find((o) => o.sourceId === "10.186")?.status).toBe("closed");
  });
});
