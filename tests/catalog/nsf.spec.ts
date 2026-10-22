import { expect, test } from "@playwright/test";
import {
  addNsfAward,
  awardsUrl,
  dclInvitesProposals,
  fiscalYearMonths,
  grantsGovNumber,
  inheritUmbrellaDates,
  isOpportunityPage,
  nsfAwards,
  nsfFunding,
  parseNsfPage,
  parseSitemap,
  toNsfOpportunity,
  type NsfAward,
} from "@/lib/catalog/connectors/nsf";
import { AwardAggregator } from "@/lib/catalog/connectors/_research-stats";
import { canonicalKey } from "@/lib/catalog/normalize";
import { fixture, fixtureFetch, runOffline } from "./helpers";

const NOW = new Date("2026-10-22T12:00:00Z");
const OPP = "https://www.nsf.gov/funding/opportunities/";
const page = (slug: string) => parseNsfPage(fixture("nsf_funding", `${slug}.html`), `${OPP}${slug}`);

test.describe("NSF funding opportunities", () => {
  test("sitemap entries and opportunity page URLs", () => {
    const idx = parseSitemap(fixture("nsf_funding", "sitemap-index.xml"));
    expect(idx.map((e) => e.url)).toEqual(["https://www.nsf.gov/sitemap.xml?page=1", "https://www.nsf.gov/sitemap.xml?page=2"]);
    const urls = parseSitemap(fixture("nsf_funding", "sitemap-page1.xml")).map((e) => e.url);
    expect(urls.filter(isOpportunityPage).length).toBe(urls.length - 1);
    expect(isOpportunityPage(`${OPP}grfp-nsf-graduate-research-fellowship-program/nsf26-526`)).toBe(false);
  });

  test("numbers take the Grants.gov form", () => {
    expect(grantsGovNumber("NSF 26-526")).toBe("26-526");
    expect(grantsGovNumber("PD 24-110Z")).toBe("PD-24-110Z");
    expect(grantsGovNumber("PD 98-1331")).toBe("PD-98-1331");
    expect(grantsGovNumber("something else")).toBeNull();
  });

  test("a fellowship with two deadlines: next deadline, organizations, award count, and the solicitation link", () => {
    const p = page("grfp-nsf-graduate-research-fellowship-program");
    expect(p.kind).toBe("program");
    expect(p.number).toBe("NSF 26-526");
    expect(p.dueDates.map((d) => d.date)).toEqual(["2026-10-22", "2026-10-23"]);
    expect(p.organizations).toContain("Directorate for STEM Education (EDU)");
    const o = toNsfOpportunity(p, { now: NOW })!;
    expect(o.type).toBe("scholarship");
    expect(o.eligibility).toEqual(["individual"]);
    expect(o.status).toBe("open");
    expect(o.closeAt).toBe("2026-10-22T23:59:00-05:00");
    expect(o.awardCount).toBe(1500);
    expect(o.opportunityNumber).toBe("26-526");
    expect(o.canonicalKey).toBe("num:NSF26-526");
    expect(o.attachments?.[0].url).toBe(`${OPP}grfp-nsf-graduate-research-fellowship-program/nsf26-526/solicitation`);
    expect(o.postedAt).toBe("2026-08-25");
  });

  test("recurring deadlines, target dates, and accepted-anytime programs", () => {
    const gcr = toNsfOpportunity(page("gcr-growing-convergence-research"), { now: NOW })!;
    expect(gcr.closeAt).toBe("2027-02-08T23:59:00-05:00");
    expect(gcr.keyDates?.[0].label).toMatch(/Second Monday in February/);
    expect(gcr.amountTotal).toBe(16_000_000);
    const ocean = toNsfOpportunity(page("oceanographic-facilities-equipment-support"), { now: NOW })!;
    expect(ocean.closeText).toBe("Target date");
    const pfe = toNsfOpportunity(page("pfe-professional-formation-engineers"), { now: NOW })!;
    expect(pfe.rolling).toBe(true);
    expect(pfe.closeAt).toBeNull();
    expect(pfe.closeText).toBe("Full proposal accepted anytime");
    expect(pfe.opportunityNumber).toBe("PD-26-1341");
    // Program descriptions meet Grants.gov through the default number key.
    expect(canonicalKey(pfe)).toBe("num:PD-26-1341");
  });

  test("a program waiting for a new solicitation is forecasted; a past deadline closes it", () => {
    const amtry = toNsfOpportunity(page("amtry-archaeometry"), { now: NOW })!;
    expect(amtry.status).toBe("forecasted");
    expect(amtry.closeText).toBe("Waiting for a new solicitation");
    const later = toNsfOpportunity(page("grfp-nsf-graduate-research-fellowship-program"), { now: new Date("2026-11-01T00:00:00Z") })!;
    expect(later.status).toBe("closed");
    expect(later.closeAt).toBe("2026-10-23T23:59:00-05:00");
  });

  test("programs under an umbrella solicitation take its dates and keep their own keys", () => {
    const pages = inheritUmbrellaDates([page("geometric-analysis"), page("foundations"), page("mps-mathsci-mps-mathematical-sciences-research-programs")]);
    const geo = pages[0];
    expect(geo.anytime.length).toBe(1);
    expect(geo.datesFrom).toBe("mps-mathsci-mps-mathematical-sciences-research-programs");
    const o = toNsfOpportunity(geo, { sharedNumber: true, now: NOW })!;
    expect(o.rolling).toBe(true);
    expect(o.canonicalKey).toBe("nsf:geometric-analysis");
    expect(o.researchAreas).toContain("physical_sciences");
    expect(toNsfOpportunity(pages[2], { now: NOW })!.canonicalKey).toBe("num:NSF26-520");
  });

  test("Dear Colleague Letters are kept only when they ask for proposals", () => {
    const invite = page("dcl-ecosystem-leading-innovation-plasma-science-engineering");
    expect(invite.kind).toBe("dcl");
    expect(dclInvitesProposals(invite)).toBe(true);
    const o = toNsfOpportunity(invite, { now: NOW })!;
    expect(o.noticeType).toBe("dear_colleague_letter");
    expect(o.postedAt).toBe("2024-09-16");
    expect(o.canonicalKey).toBe("nsf:dcl-ecosystem-leading-innovation-plasma-science-engineering");
    expect(o.summary).toMatch(/PFAS/);
    const policy = page("dcl-special-guidelines-submitting-collaborative-proposals-under-1");
    expect(toNsfOpportunity(policy, { now: NOW })).toBeNull();
  });

  test("a page that is not an opportunity yields nothing", () => {
    expect(toNsfOpportunity(parseNsfPage("<html><body><p>Not found</p></body></html>", `${OPP}gone`), { now: NOW })).toBeNull();
  });

  test("the connector reads the sitemap, then each page, and emits the funder first", async () => {
    const f = fixtureFetch("nsf_funding", [
      [/sitemap\.xml\?page=1$/, "sitemap-page1.xml"],
      [/sitemap\.xml\?page=2$/, "sitemap-page2.xml"],
      [/sitemap\.xml$/, "sitemap-index.xml"],
      [/\/funding\/opportunities\/([a-z0-9-]+)$/, (url) => fixture("nsf_funding", `${url.split("/").pop()}.html`)],
    ]);
    const { sink, result } = await runOffline(nsfFunding, f);
    expect(result.status).toBe("succeeded");
    expect(sink.funderRows[0].key).toBe("agency:NSF");
    expect(sink.opportunityRows).toHaveLength(10);
    const keys = sink.opportunityRows.map((o) => o.canonicalKey);
    expect(keys).toContain("num:NSF26-520");
    expect(keys).toContain("nsf:foundations");
    expect(f.calls.filter((u) => u.includes("/funding/opportunities/"))).toHaveLength(11);
    expect(nsfFunding.fullSnapshot).toBe(true);
  });
});

test.describe("NSF awards", () => {
  const awards = (): NsfAward[] => JSON.parse(fixture("nsf_awards", "jan-2026-offset0.json")).response.award;

  test("fiscal year windows run October through September", () => {
    const m = fiscalYearMonths(2026);
    expect(m[0]).toEqual(["2025-10-01", "2025-10-31"]);
    expect(m[4]).toEqual(["2026-02-01", "2026-02-28"]);
    expect(m[11]).toEqual(["2026-09-01", "2026-09-30"]);
    expect(awardsUrl("2026-01-01", "2026-01-31", 25)).toContain("dateStart=01%2F01%2F2026");
  });

  test("awards roll up by directorate, program, and state into fiscal years", () => {
    const agg = new AwardAggregator();
    for (const a of awards()) expect(addNsfAward(agg, a)).toBe(true);
    const rows = agg.rows();
    const all = rows.find((r) => !r.subAgency && !r.program && !r.placeState)!;
    expect(all.fiscalYear).toBe(2026);
    expect(all.awardCount).toBe(25);
    expect(rows.some((r) => r.subAgency && r.program && !r.placeState)).toBe(true);
    expect(addNsfAward(agg, { ...awards()[0], estimatedTotalAmt: "0", fundsObligatedAmt: "" })).toBe(false);
    expect(addNsfAward(agg, { ...awards()[0], date: "not a date" })).toBe(false);
  });

  test("the connector pages each month, skips repeats, and splits windows over the API's 3,000 cap", async () => {
    const empty = fixture("nsf_awards", "empty-2025-10.json");
    const f = fixtureFetch("nsf_awards", [
      [/dateStart=01%2F01%2F2026&dateEnd=01%2F31%2F2026.*offset=0&/, "jan-2026-offset0.json"],
      [/dateStart=01%2F01%2F2026&dateEnd=01%2F31%2F2026.*offset=25&/, "jan-2026-offset25.json"],
      [
        /dateStart=08%2F01%2F2026&dateEnd=08%2F31%2F2026/,
        () => {
          const j = JSON.parse(empty);
          j.response.metadata.totalCount = 3500;
          return JSON.stringify(j);
        },
      ],
      [/api\.nsf\.gov/, () => empty],
    ]);
    const { sink, result } = await runOffline(nsfAwards, f, { env: { NSF_AWARD_YEARS: "2026" }, limit: 50 });
    expect(result.status).toBe("succeeded");
    const all = sink.awardRows.find((r) => !r.subAgency && !r.program && !r.placeState)!;
    expect(all.awardCount).toBe(50);
    expect(f.calls.some((u) => u.includes("dateStart=08%2F01%2F2026&dateEnd=08%2F16%2F2026"))).toBe(true);
    expect(JSON.stringify(sink.awardRows)).not.toMatch(/awardee|piEmail/);
  });
});
