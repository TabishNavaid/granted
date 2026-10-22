import { expect, test } from "@playwright/test";
import {
  federalRegister,
  findAmounts,
  findAssistanceListings,
  findDeadline,
  findEligibility,
  findGrantsGovIds,
  findOpportunityNumbers,
  fundersFor,
  isFundingNotice,
  noticeText,
  searchUrl,
  section,
  toOpportunities,
  windows,
  type FrDoc,
} from "@/lib/catalog/connectors/federal-register";
import { canonicalKey } from "@/lib/catalog/normalize";
import { fixture, fixtureFetch, runOffline } from "./helpers";

const SRC = "federal_register";
const NOW = new Date("2026-10-22T12:00:00Z");

const json = <T>(file: string) => JSON.parse(fixture(SRC, file)) as T;
const searchDocs = (file: string) => json<{ results: FrDoc[] }>(file).results;
const doc = (n: string) => json<FrDoc>(`doc-${n}.json`);
const text = (n: string) => noticeText(fixture(SRC, `text-${n}.html`));
const byNumber = (n: string) => [...searchDocs("search-funding-opportunity.json"), ...searchDocs("search-notice-announcing.json")].find((d) => d.document_number === n)!;

/** Recorded Grants.gov lookups, answered by the opportunity id in the request body. */
function grantsGovAnswer(_url: string, init?: RequestInit): Response {
  const id = JSON.parse(String(init?.body ?? "{}")).opportunityId as string;
  try {
    return new Response(fixture(SRC, `grantsgov-${id}.json`), { status: 200, headers: { "content-type": "application/json" } });
  } catch {
    return new Response("{}", { status: 404 });
  }
}

function routes(): Parameters<typeof fixtureFetch>[1] {
  return [
    ["api.grants.gov", grantsGovAnswer],
    [/conditions%5Bterm%5D=%22funding\+opportunity%22/, "search-funding-opportunity.json"],
    [/conditions%5Bterm%5D=%22notice\+announcing%22/, "search-notice-announcing.json"],
    ["documents.json", "search-empty.json"],
    [
      /full_text\/text\/.*\/(\d{4}-\d{5})\.txt/,
      (url) => {
        const n = url.match(/(\d{4}-\d{5})\.txt/)![1];
        try {
          return new Response(fixture(SRC, `text-${n}.html`), { status: 200, headers: { "content-type": "text/html" } });
        } catch {
          return new Response("not found", { status: 404 });
        }
      },
    ],
  ];
}

test.describe("Federal Register classifier", () => {
  test("keeps funding notices and drops paperwork, amendments, and supplements", () => {
    const kept = searchDocs("search-funding-opportunity.json").filter(isFundingNotice).map((d) => d.document_number);
    expect(kept.sort()).toEqual(["2026-12270", "2026-12425", "2026-12687", "2026-13172", "2026-13199", "2026-13200"]);
    const ann = searchDocs("search-notice-announcing.json").filter(isFundingNotice).map((d) => d.document_number);
    expect(ann).toEqual(["2026-21427"]);
  });

  test("rejects other document types and notices of intent to award", () => {
    expect(isFundingNotice({ title: "Notice of Funding Opportunity for X", type: "Rule", action: "Final rule.", abstract: "" })).toBe(false);
    expect(isFundingNotice({ title: "Fiscal Year (FY) 2026 Notice of Supplemental Funding Opportunity", type: "Notice", action: "Notice of intent to award supplemental funding.", abstract: "" })).toBe(false);
    expect(isFundingNotice({ title: "Community Development Revolving Loan Fund", type: "Notice", action: "Notice of funding opportunity.", abstract: "" })).toBe(true);
  });
});

test.describe("Federal Register notice parsing", () => {
  test("reads the DATES deadline with its Eastern time, and turns other dates into key dates", () => {
    const d = findDeadline(section(text("2026-21427"), "DATES"), text("2026-21427"), "2026-10-20");
    expect(d.closeAt).toBe("2026-12-12T04:59:00.000Z");
    expect(d.rolling).toBe(false);

    const ed = findDeadline(section(text("2025-19843"), "DATES"), text("2025-19843"), "2025-11-12");
    expect(ed.closeAt).toBe("2025-12-03T23:59:00-05:00");
    expect(ed.keyDates.map((k) => k.kind)).toContain("intergovernmental_review");
    expect(ed.keyDates.find((k) => k.kind === "intergovernmental_review")?.date).toBe("2025-12-12");
  });

  test("takes the earliest of several application deadlines (EASIE Part I)", () => {
    const t = text("2026-02178");
    const d = findDeadline(section(t, "DATES"), t, "2026-02-03");
    expect(d.closeAt).toBe("2026-03-07T04:59:00.000Z");
    expect(d.keyDates.some((k) => k.date === "2026-05-11")).toBe(true);
  });

  test("rolling notices stay open without a date", () => {
    const n = "2026-13835";
    const [o] = toOpportunities(doc(n), text(n), [], NOW);
    expect(o.rolling).toBe(true);
    expect(o.status).toBe("open");
    expect(o.closeAt).toBeNull();
    expect(o.closeText).toMatch(/rolling/i);
    expect(o.opportunityNumber).toBe("NCUA-CDRLF-2026L");
    expect(o.assistanceListings).toEqual(["44.002"]);
    expect(o.categories).toContain("Loans, guarantees, and credit");
  });

  test("past deadlines are closed", () => {
    const n = "2025-19843";
    const [o] = toOpportunities(doc(n), text(n), [], NOW);
    expect(o.status).toBe("closed");
    expect(o.closeAt).toBe("2025-12-03T23:59:00-05:00");
  });

  test("award sizes, counts, and totals from the labeled lines", () => {
    const a = findAmounts(text("2026-02178"));
    expect(a).toMatchObject({ amountMin: 4_000, amountMax: 2_400_000, awardCount: 1_250, averageAward: 85_000 });
    expect(findAmounts(text("2026-21427")).amountMax).toBe(500_000);
    expect(findAmounts("", "The FTA announces the opportunity to apply for approximately $657 million in competitive grants.").amountTotal).toBe(657_000_000);
  });

  test("eligibility codes and text", () => {
    const e = findEligibility(text("2026-02178"));
    expect(e.codes).toEqual(expect.arrayContaining(["state_government", "school_district", "tribal"]));
    expect(e.text).toBeTruthy();
    expect(findEligibility(text("2026-21427")).codes).toEqual(expect.arrayContaining(["university", "nonprofit", "for_profit"]));
    expect(findEligibility("no section here").codes).toEqual([]);
  });

  test("assistance listings, opportunity numbers, and Grants.gov links", () => {
    const t = text("2026-21427");
    expect(findAssistanceListings(t)).toEqual({ listings: ["84.305", "84.324"], lettered: ["84.305J", "84.324T"] });
    expect(findGrantsGovIds(t)).toEqual(["364086", "364087"]);
    expect(findOpportunityNumbers(text("2026-13835"))).toEqual(["NCUA-CDRLF-2026L"]);
  });

  test("a notice listing two Grants.gov competitions becomes two rows that dedupe with Grants.gov", () => {
    const n = "2026-21427";
    const gg = [
      { id: "364086", number: "ED-GRANTS-101526-001", title: "Institute of Education Sciences (IES): National Center on Education Research (NCER): From Seedlings to Scale" },
      { id: "364087", number: "ED-GRANTS-101526-002", title: "Institute of Education Sciences (IES): National Center for Special Education Research (NCSER): Transformative Research" },
    ];
    const rows = toOpportunities(byNumber(n), text(n), gg, NOW);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.sourceId)).toEqual([`${n}:364086`, `${n}:364087`]);
    expect(canonicalKey(rows[0])).toBe("num:ED-GRANTS-101526-001");
    for (const r of rows) {
      expect(r.sourceUrl).toBe("https://www.federalregister.gov/documents/2026/10/20/2026-21427/notice-announcing-from-seedlings-to-scale-and-transformative-research-in-special-education-grants");
      expect(r.status).toBe("open");
      expect(r.type).toBe("research");
      expect(r.noticeType).toBe("fr_notice");
      expect(r.funderKey).toBe("agency:ED");
      expect(r.attachments?.some((a) => a.url.startsWith("https://www.grants.gov/search-results-detail/"))).toBe(true);
    }
  });

  test("funders: the specific agency, under its parent, with Grants.gov style keys", () => {
    const f = fundersFor(byNumber("2026-12270"));
    expect(f.key).toBe("agency:USDA-RBCS");
    expect(f.funders.map((x) => x.key)).toEqual(["agency:USDA", "agency:USDA-RBCS"]);
    expect(f.funders[1].parentKey).toBe("agency:USDA");
    const unknown = fundersFor({ ...byNumber("2026-13172") });
    expect(unknown.key).toMatch(/^agency:/);
  });

  test("malformed records give no rows instead of throwing", () => {
    expect(toOpportunities({ document_number: "", title: "", html_url: "", publication_date: "2026-01-01" }, "", [], NOW)).toEqual([]);
    expect(toOpportunities({ ...byNumber("2026-12270"), html_url: "" }, "garbage", [], NOW)).toEqual([]);
    expect(noticeText("<pre>[[Page 12]]\nDATES: none</pre>")).toBe("DATES: none");
  });
});

test.describe("Federal Register connector", () => {
  test("search URLs ask for notices only, with paging and fields", () => {
    const u = new URL(searchUrl('"new awards"', "2026-01-01", "2026-03-31", 2));
    expect(u.searchParams.get("conditions[type][]")).toBe("NOTICE");
    expect(u.searchParams.get("per_page")).toBe("1000");
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.getAll("fields[]")).toContain("raw_text_url");
  });

  test("backfill covers twelve months in windows; incremental starts a little before the last run", () => {
    const back = windows({ mode: "backfill", since: null }, NOW);
    expect(back[0][0]).toBe("2025-10-22");
    expect(back[back.length - 1][1]).toBe("2026-10-22");
    expect(back.length).toBe(4);
    const inc = windows({ mode: "incremental", since: new Date("2026-10-20T09:00:00Z") }, NOW);
    expect(inc).toEqual([["2026-10-17", "2026-10-22"]]);
    const first = windows({ mode: "incremental", since: null }, NOW);
    expect(first[0][0]).toBe("2026-10-08");
  });

  test("runs offline: funders first, Grants.gov numbers resolved, failed texts recorded as warnings", async () => {
    const f = fixtureFetch(SRC, routes());
    const { sink, result } = await runOffline(federalRegister, f, { mode: "incremental", since: new Date(Date.now() - 2 * 86_400_000) });
    // 2026-13199 and 2026-13200 have no recorded text: those two are warnings, the rest are rows.
    expect(result.status).toBe("partial");
    expect(result.errors).toHaveLength(2);
    const ids = sink.opportunityRows.map((o) => o.sourceId).sort();
    expect(ids).toEqual(["2026-12270", "2026-12425", "2026-12687", "2026-13172", "2026-21427:364086", "2026-21427:364087"]);
    const keys = new Set(sink.funderRows.map((x) => x.key));
    for (const o of sink.opportunityRows) expect(keys.has(o.funderKey!)).toBe(true);
    const mece = sink.opportunityRows.find((o) => o.sourceId === "2026-12425")!;
    expect(mece.opportunityNumber).toBe("ED-GRANTS-061526-001");
    expect(mece.sourceUrl).toMatch(/^https:\/\/www\.federalregister\.gov\/documents\//);
    for (const o of sink.opportunityRows) {
      expect(o.title).not.toMatch(/[–—]/);
      expect(["open", "closed"]).toContain(o.status);
    }
    // Every request went through the recorded fetch, one search per term.
    expect(f.calls.filter((u) => u.includes("documents.json")).length).toBeGreaterThanOrEqual(15);
  });

  test("stops at the limit", async () => {
    const f = fixtureFetch(SRC, routes());
    const { sink } = await runOffline(federalRegister, f, { mode: "incremental", since: new Date(Date.now() - 2 * 86_400_000), limit: 1 });
    expect(sink.opportunityRows).toHaveLength(1);
    expect(f.calls.filter((u) => u.includes("full_text")).length).toBeLessThanOrEqual(2);
  });

  test("splits a window that has more results than the API can page through", async () => {
    const empty = fixture(SRC, "search-empty.json");
    const f = fixtureFetch(SRC, [
      [
        "documents.json",
        (url) => {
          const u = new URL(url);
          const from = Date.parse(u.searchParams.get("conditions[publication_date][gte]")!);
          const to = Date.parse(u.searchParams.get("conditions[publication_date][lte]")!);
          return (to - from) / 86_400_000 > 20 ? JSON.stringify({ count: 2_500, total_pages: 3, results: [] }) : empty;
        },
      ],
    ]);
    const { result } = await runOffline(federalRegister, f, { mode: "incremental", since: new Date(Date.now() - 60 * 86_400_000) });
    expect(result.status).toBe("succeeded");
    const spans = f.calls.map((url) => {
      const u = new URL(url);
      return (Date.parse(u.searchParams.get("conditions[publication_date][lte]")!) - Date.parse(u.searchParams.get("conditions[publication_date][gte]")!)) / 86_400_000;
    });
    expect(Math.min(...spans)).toBeLessThanOrEqual(20);
    // Never pages past the reachable results.
    expect(f.calls.some((u) => new URL(u).searchParams.get("page") === "3")).toBe(false);
  });
});

test.describe("Federal Register dedupe keys", () => {
  test("rows without an opportunity number keep a key of their own; numbered rows use the shared number key", () => {
    const n = "2026-12270";
    const [plain] = toOpportunities(byNumber(n), text(n), [], NOW);
    expect(plain.opportunityNumber).toBeNull();
    expect(canonicalKey(plain)).toBe(`fr:${n}`);
    const [numbered] = toOpportunities(doc("2026-13835"), text("2026-13835"), [], NOW);
    expect(canonicalKey(numbered)).toBe("num:NCUA-CDRLF-2026L");
  });
});

test.describe("Federal Register agency names", () => {
  test("are written the usual way so a shared funder keeps one name", async () => {
    const { agencyName } = await import("@/lib/catalog/connectors/federal-register");
    expect(agencyName("Education Department")).toBe("Department of Education");
    expect(agencyName("Interior Department")).toBe("Department of the Interior");
    expect(agencyName("Indian Affairs Bureau")).toBe("Bureau of Indian Affairs");
    expect(agencyName("Rural Utilities Service")).toBe("Rural Utilities Service");
    expect(fundersFor(byNumber("2026-12270")).funders[0].name).toBe("Department of Agriculture");
  });
});
