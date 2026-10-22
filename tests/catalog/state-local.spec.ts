import { expect, test } from "@playwright/test";
import {
  aecCategories,
  aecFromUnspsc,
  cleanText,
  endOfDay,
  noticeTypeFrom,
  placeholderDate,
  setAsideFrom,
  setAsideSentences,
  zonedTimestamp,
} from "@/lib/catalog/connectors/_bids";
import { feedConnector, parseCsvFeed, parseXmlFeed, type FeedItem } from "@/lib/catalog/connectors/_feeds";
import { pageUrl, socrataConnector, whereFor, type SodaRow } from "@/lib/catalog/connectors/_socrata";
import {
  cdbCity,
  connectors,
  delawareBids,
  ilCdbFuture,
  laRamp,
  montgomeryBids,
  nycCityRecord,
  sfCityPartner,
  txdotLettings,
} from "@/lib/catalog/connectors/state-local";
import type { OpportunityInput } from "@/lib/catalog/types";
import { fixture, fixtureFetch, runOffline } from "./helpers";

/** The day the fixtures were recorded. Statuses are judged against it. */
const NOW = "2026-10-22T12:00:00Z";
const env = { CATALOG_NOW: NOW };

/** Answer the first page from recorded rows and every later page with an empty list. */
function pages(source: string, files: string[], pageSize = 1000) {
  const rows = files.flatMap((f) => JSON.parse(fixture(source, f)) as SodaRow[]);
  return fixtureFetch(source, [
    [
      "/resource/",
      (url) => {
        const u = new URL(url);
        const offset = Number(u.searchParams.get("$offset") ?? 0);
        const limit = Number(u.searchParams.get("$limit") ?? pageSize);
        return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { headers: { "content-type": "application/json" } });
      },
    ],
  ]);
}

const by = (rows: OpportunityInput[], id: string) => rows.find((o) => o.sourceId === id)!;

test.describe("bid helpers", () => {
  test("wall-clock times get the offset of their zone and day", () => {
    expect(zonedTimestamp("2026-11-03T13:00:00.000", "America/Chicago")).toBe("2026-11-03T13:00:00-06:00");
    expect(zonedTimestamp("2026-10-22T10:00:00.000", "America/New_York")).toBe("2026-10-22T10:00:00-04:00");
    expect(zonedTimestamp("2026-11-20T14:00:00.000", "America/New_York")).toBe("2026-11-20T14:00:00-05:00");
    expect(zonedTimestamp("2026-10-27T21:00:00.000", "UTC")).toBe("2026-10-27T21:00:00Z");
    expect(zonedTimestamp("2026-10-27T21:00:00Z", "America/Chicago")).toBe("2026-10-27T21:00:00.000Z");
    expect(zonedTimestamp("not a date", "UTC")).toBeNull();
    expect(endOfDay("2026-11-05T00:00:00.000", "America/New_York")).toBe("2026-11-05T23:59:00-05:00");
    expect(endOfDay("10/21/2026", "America/New_York")).toBe("2026-10-21T23:59:00-04:00");
    expect(placeholderDate("2099-12-31T00:00:00.000")).toBe(true);
    expect(placeholderDate("9999-09-09T11:00:00.000")).toBe(true);
    expect(placeholderDate("2040-12-31T17:00:00.000")).toBe(false);
  });

  test("notice types, construction, and set-asides", () => {
    expect(noticeTypeFrom("Competitive Sealed Bids")).toBe("invitation_for_bids");
    expect(noticeTypeFrom("Competitive Sealed Proposals/Pre-Qualified List")).toBe("request_for_qualifications");
    expect(noticeTypeFrom("Request for Proposals", "Bid Extension: Payroll")).toBe("request_for_proposals");
    expect(noticeTypeFrom("RFQ - Request for Quote")).toBe("request_for_quotes");
    expect(noticeTypeFrom("RFQ - Request For Qualification")).toBe("request_for_qualifications");
    expect(noticeTypeFrom("RFI - Request for Information")).toBe("request_for_information");
    expect(noticeTypeFrom("")).toBe("solicitation");
    expect(aecCategories({ text: "Design Services Task Order Contract for Green Infrastructure" })).toEqual(["architecture and engineering"]);
    expect(aecCategories({ text: "Base Repair, Mill and Overlay" })).toEqual(["construction"]);
    expect(aecCategories({ text: "Homebound Supportive Instruction Services" })).toEqual([]);
    expect(aecFromUnspsc(["7212"])).toEqual(["construction"]);
    expect(aecFromUnspsc(["8614"])).toEqual([]);
    expect(setAsideFrom("0% M/WBE Subcontracting goals")).toBeNull();
    expect(setAsideFrom("NYC Parks M/WBE-Only Site Work Construction PQL")).toBe("M/WBE");
    expect(setAsideFrom("Precita Park - MLBE")).toBe("LBE");
    expect(setAsideFrom("", ["Local Small Business Reserve Program"])).toBe("Local Small Business Reserve Program");
    const boilerplate = "The Department strives to give all businesses, including M/WBEs, an equal opportunity. This procurement is subject to participation goals for MBEs and/or WBEs.";
    expect(setAsideSentences(boilerplate)).not.toMatch(/strives/);
    expect(setAsideFrom(setAsideSentences(boilerplate))).toBe("M/WBE");
    expect(cleanText("NYCHA\u001as Purchase Order")).toBe("NYCHA's Purchase Order");
    expect(cleanText("OPEN-ENDED \u001a JUSTICE")).toBe("OPEN-ENDED JUSTICE");
  });

  test("incremental pulls narrow the filter to recent changes", () => {
    const now = new Date(NOW);
    expect(whereFor(delawareBids, { mode: "backfill", since: null }, now)).not.toMatch(/:updated_at/);
    const inc = whereFor(delawareBids, { mode: "incremental", since: new Date("2026-10-21T09:00:00Z") }, now);
    expect(inc).toMatch(/\) AND :updated_at > '2026-10-19T09:00:00'$/);
    expect(whereFor(delawareBids, { mode: "incremental", since: null }, now)).toMatch(/:updated_at > '2026-10-15T12:00:00'/);
    const url = new URL(pageUrl(delawareBids, "1=1", 2000));
    expect(url.pathname).toBe("/resource/2hnj-zwix.json");
    expect(url.searchParams.get("$offset")).toBe("2000");
    expect(url.searchParams.get("$order")).toBe("contractnumber ASC");
  });

  test("every portal has a source id, region, terms, schedule, and a contract type", () => {
    const ids = connectors.map((c) => c.source.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of connectors) {
      expect(c.source.id).toMatch(/^state_[a-z]{2}_[a-z0-9_]+$/);
      expect(["state", "local"]).toContain(c.source.region);
      expect(c.source.kinds).toEqual(["contract"]);
      expect(c.source.termsUrl).toMatch(/^https?:\/\//);
      expect(c.source.schedule).toMatch(/^\d+ \d+ /);
      expect(JSON.stringify(c.source)).not.toMatch(/[–—]/);
    }
  });
});

test.describe("NYC City Record Online", () => {
  test("reads solicitations, groups re-advertisements, and judges status", async () => {
    const fetch = pages("state_ny_nyc_cityrecord", ["solicitations.json", "closed.json"]);
    const { sink, result } = await runOffline(socrataConnector(nycCityRecord), fetch, { env });
    expect(result.status).toBe("succeeded");
    const rows = sink.opportunityRows;
    // Two notices with PIN PQL000102 become one opportunity.
    expect(rows.filter((o) => o.opportunityNumber === "PQL000102")).toHaveLength(1);
    expect(rows).toHaveLength(10);

    const cm = by(rows, "design-and-construction:85027I0001");
    expect(cm.status).toBe("open");
    expect(cm.type).toBe("contract");
    expect(cm.closeAt).toBe("2026-11-20T14:00:00-05:00");
    expect(cm.noticeType).toBe("request_for_proposals");
    expect(cm.sourceUrl).toBe("https://a856-cityrecord.nyc.gov/RequestDetail/20261014021");
    expect(cm.categories).toContain("construction");
    expect(cm.funderKey).toBe("local:NY:new-york-city:design-and-construction");
    expect(cm.place).toMatchObject({ state: "NY", city: "New York" });
    expect(cm.contact).toBeNull();
    expect(by(rows, "20261008021").contact?.email).toMatch(/@nycha\.nyc\.gov$/);
    expect(cm.summary).not.toMatch(/<[a-z]/i);

    const design = by(rows, "environmental-protection:82627P0002");
    expect(design.categories).toContain("architecture and engineering");

    const ext = by(rows, "citywide-administrative-services:85626B0010");
    expect(ext.title).toBe("CSB 161 ST Elevator Modernization Rebid");
    expect(ext.amendments?.[0]?.summary).toBe("Bid extension");

    expect(by(rows, "citywide-administrative-services:85620B0005").status).toBe("cancelled");
    // Placeholder due dates: open-ended when posted recently, closed when the notice is years old.
    const pql = by(rows, "design-and-construction:PQL000102");
    expect(pql.closeAt).toBe("2040-12-31T17:00:00-05:00");
    expect(pql.setAside).toBe("M/WBE");
    expect(pql.amendments?.map((a) => a.number)).toContain("20250417032");
    const old = by(rows, "design-and-construction:8502019WM0004C");
    expect(old.closeAt).toBeNull();
    expect(old.status).toBe("closed");
    expect(old.attachments?.[0]?.url).toMatch(/^https:\/\/a856-cityrecord\.nyc\.gov\/Search\/GetFile\?SectionID=\d+&RequestStatus=/);
    expect(by(rows, "education:R1188040").status).toBe("closed");
    // A notice without a usable PIN keeps its request id.
    expect(by(rows, "20261008021").opportunityNumber).toBeNull();
  });

  test("funders, the city first, come before the opportunities that point at them", async () => {
    const { sink } = await runOffline(socrataConnector(nycCityRecord), pages("state_ny_nyc_cityrecord", ["solicitations.json"]), { env });
    const keys = sink.funderRows.map((f) => f.key);
    expect(keys[0]).toBe("local:NY:new-york-city");
    expect(sink.funderRows.every((f) => f.kind === "local_government")).toBe(true);
    for (const o of sink.opportunityRows) expect(keys).toContain(o.funderKey);
    expect(sink.funderRows.find((f) => f.key !== keys[0])?.parentKey).toBe("local:NY:new-york-city");
  });

  test("pages until a short page, and stops at the limit", async () => {
    const fetch = pages("state_ny_nyc_cityrecord", ["solicitations.json", "closed.json"]);
    const small = socrataConnector({ ...laRamp, pageSize: 3 });
    const la = pages("state_ca_la_ramp", ["bids.json", "bids-more.json"]);
    const { sink } = await runOffline(small, la, { env });
    expect(sink.opportunityRows).toHaveLength(8);
    expect(la.calls.map((u) => new URL(u).searchParams.get("$offset"))).toEqual(["0", "3", "6"]);
    const limited = await runOffline(socrataConnector(nycCityRecord), fetch, { env, limit: 3 });
    expect(limited.sink.opportunityRows).toHaveLength(3);
  });

  test("a malformed record is skipped and a bad response fails the run", async () => {
    const rows = JSON.parse(fixture("state_ny_nyc_cityrecord", "solicitations.json")) as SodaRow[];
    expect(nycCityRecord.map({ ...rows[0], short_title: undefined } as SodaRow, new Date(NOW))).toBeNull();
    const broken = { ...laRamp, map: (r: SodaRow, now: Date) => (r.rampid === "224546" ? (() => { throw new Error("bad row"); })() : laRamp.map(r, now)) };
    const { sink, result } = await runOffline(socrataConnector(broken), pages("state_ca_la_ramp", ["bids.json"]), { env });
    expect(result.status).toBe("partial");
    expect(result.errors[0].message).toMatch(/could not read a record/);
    expect(sink.opportunityRows).toHaveLength(5);
    const bad = fixtureFetch("state_ca_la_ramp", [["/resource/", () => new Response(JSON.stringify({ error: true }), { status: 200 })]]);
    expect((await runOffline(socrataConnector(laRamp), bad, { env })).result.status).toBe("failed");
  });
});

test.describe("Los Angeles RAMP", () => {
  test("UTC close times, cancellations, and regional buyers", async () => {
    const { sink } = await runOffline(socrataConnector(laRamp), pages("state_ca_la_ramp", ["bids.json", "bids-more.json"]), { env });
    const rows = sink.opportunityRows;
    const geo = by(rows, "224546");
    expect(geo.closeAt).toBe("2026-10-27T21:00:00Z");
    expect(geo.status).toBe("open");
    expect(geo.postedAt).toBe("2026-09-04");
    expect(geo.noticeType).toBe("request_for_qualifications");
    expect(geo.categories).toContain("architecture and engineering");
    expect(geo.funderKey).toBe("local:CA:los-angeles:engineering-bureau-public-works");
    expect(geo.sourceUrl).toMatch(/^https:\/\/www\.rampla\.org\/s\/opportunity-details\?id=/);
    const lausd = by(rows, "229205");
    expect(lausd.status).toBe("cancelled");
    expect(lausd.title).not.toMatch(/cancel/i);
    expect(lausd.funderKey).toBe("local:CA:lausd");
    expect(lausd.categories).toContain("construction");
    expect(by(rows, "228113").categories).toContain("construction");
  });
});

test.describe("San Francisco open bids", () => {
  test("department codes come off titles; open-ended events stay open", async () => {
    const { sink } = await runOffline(socrataConnector(sfCityPartner), pages("state_ca_sf_citypartner", ["bids.json"]), { env });
    const rows = sink.opportunityRows;
    const pave = by(rows, "SFGOV~0000009170");
    expect(pave.title).toBe("PW SAN BRUNO AVE PAVE RENOV");
    expect(pave.closeAt).toBe("2026-10-28T14:30:00-07:00");
    expect(pave.categories).toContain("construction");
    const park = by(rows, "SFGOV~0000010933");
    expect(park.opportunityNumber).toBe("CON26-0006");
    expect(park.setAside).toBe("LBE");
    expect(park.categories).toContain("construction");
    const standing = by(rows, "SFGOV~0000002191");
    expect(standing.closeAt).toBeNull();
    expect(standing.rolling).toBe(true);
    expect(standing.status).toBe("open");
    expect(sink.funderRows[0].key).toBe("local:CA:san-francisco");
  });
});

test.describe("TxDOT lettings", () => {
  test("one opportunity per controlling project; advertised, scheduled, and past lettings", async () => {
    const { sink } = await runOffline(socrataConnector(txdotLettings), pages("state_tx_txdot_lettings", ["projects.json"]), { env });
    const rows = sink.opportunityRows;
    // Seven recorded rows: one three-project contract, three single contracts, and one value-only row that is not let.
    expect(rows).toHaveLength(4);
    const houston = by(rows, "0271-06-141");
    expect(houston.status).toBe("open");
    expect(houston.noticeType).toBe("letting");
    expect(houston.closeAt).toBe("2026-11-03T13:00:00-06:00");
    expect(houston.amountTotal).toBeCloseTo(867233.1 + 746401.09 + 79090.26, 2);
    expect(houston.extra?.csjs).toEqual(["0271-06-141", "0271-07-359", "1685-05-144"]);
    expect(houston.categories?.[0]).toBe("construction");
    expect(houston.naics ?? []).toEqual([]);
    expect(houston.place).toMatchObject({ state: "TX", city: "Houston" });
    expect(houston.sourceUrl).toBe("https://data.texas.gov/resource/drau-zphx.json?controlling_project_id_ccsj=0271-06-141");
    const scheduled = by(rows, "0001-04-109");
    expect(scheduled.status).toBe("forecasted");
    expect(scheduled.closeAt).toBe("2027-01-06T13:00:00-06:00");
    const planning = by(rows, "0002-04-039");
    expect(planning.status).toBe("forecasted");
    expect(planning.title).toMatch(/ in Hudspeth County$/);
    expect(planning.title).not.toMatch(/_/);
    expect(planning.openAt).toBe("2027-05-05");
    const past = by(rows, "6484-49-001");
    expect(past.status).toBe("closed");
    expect(past.amountTotal).toBeNull();
    expect(sink.funderRows.map((f) => f.key)).toEqual(["state:TX:txdot"]);
    expect(sink.funderRows[0].kind).toBe("state_agency");
  });
});

test.describe("Delaware open bids", () => {
  test("UNSPSC codes, day-only deadlines, and buyer codes", async () => {
    const { sink } = await runOffline(socrataConnector(delawareBids), pages("state_de_mmp_bids", ["open-bids.json"]), { env });
    const rows = sink.opportunityRows;
    expect(rows).toHaveLength(6);
    const cm = by(rows, "BSD270002-CMSERVICES");
    expect(cm.categories).toEqual(expect.arrayContaining(["UNSPSC 7212", "construction"]));
    expect(cm.closeAt).toBe("2026-11-04T23:59:00-05:00");
    expect(cm.status).toBe("open");
    expect(cm.funderKey).toBe("state:DE:bsd");
    expect(cm.canonicalKey).toBeUndefined();
    expect(by(rows, "AGR-FS202702R").status).toBe("closed");
    expect(by(rows, "CHR26008A-HOMEBOUND").categories).toEqual(["UNSPSC 8614"]);
  });

  test("the same portal read from the official CSV export through the feed reader", async () => {
    const csv = fixture("state_de_mmp_bids", "open-bids.csv");
    const items = parseCsvFeed(csv);
    expect(items).toHaveLength(6);
    expect(items[0]["Contract Number"]).toBe("AGR-FS202702R");
    const toSoda = (r: FeedItem): SodaRow => ({
      contractnumber: r["Contract Number"],
      contracttitle: r["Contract Title"],
      opendate: r["Open Date"],
      deadlinedate: r["Deadline Date"],
      agencycode: r["Agency Code"],
      unspsc: r["UNSPSC"],
      bidurl: r["Bid URL"],
    });
    const feed = feedConnector<FeedItem>({
      kind: "feed",
      format: "csv",
      url: "https://data.delaware.gov/api/views/2hnj-zwix/rows.csv?accessType=DOWNLOAD",
      source: delawareBids.source,
      map: (r, now) => delawareBids.map(toSoda(r), now),
    });
    const { sink } = await runOffline(feed, fixtureFetch("state_de_mmp_bids", [["rows.csv", "open-bids.csv"]]), { env });
    const viaSocrata = await runOffline(socrataConnector(delawareBids), pages("state_de_mmp_bids", ["open-bids.json"]), { env });
    const pick = (o: OpportunityInput) => [o.sourceId, o.status, o.closeAt, o.postedAt, o.categories?.join("|")];
    expect(sink.opportunityRows.map(pick)).toEqual(viaSocrata.sink.opportunityRows.map(pick));
  });

  test("RSS and Atom items flatten to records", () => {
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>Bid A &amp; B</title><link>https://example.gov/bids/1</link><category>Construction</category><category>Roads</category><pubDate>Thu, 22 Oct 2026 04:21 -0500</pubDate></item></channel></rss>`;
    expect(parseXmlFeed(rss)).toEqual([{ title: "Bid A & B", link: "https://example.gov/bids/1", category: "Construction; Roads", pubdate: "Thu, 22 Oct 2026 04:21 -0500" }]);
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>t</title><entry><title>RFP 7</title><link rel="alternate" href="https://example.gov/rfp/7"/><category term="Design"/><updated>2026-10-22T10:00:00Z</updated></entry></feed>`;
    expect(parseXmlFeed(atom)).toEqual([{ title: "RFP 7", link: "https://example.gov/rfp/7", category: "Design", updated: "2026-10-22T10:00:00Z" }]);
  });
});

test.describe("Montgomery County, MD", () => {
  test("active, cancelled, and closed solicitations with LSBRP flags", async () => {
    const { sink } = await runOffline(socrataConnector(montgomeryBids), pages("state_md_montgomery_bids", ["solicitations.json"]), { env });
    const rows = sink.opportunityRows;
    const arts = by(rows, "1186599");
    expect(arts.status).toBe("open");
    expect(arts.setAside).toBe("Local Small Business Reserve Program");
    expect(arts.closeAt).toBe("2026-11-05T23:59:00-05:00");
    expect(arts.sourceUrl).toBe("https://apps.montgomerycountymd.gov/prosolicitation/BidTabDetail.aspx?type=bidtab&solnumber=1186599");
    expect(by(rows, "1191538").status).toBe("cancelled");
    expect(by(rows, "1105428").status).toBe("closed");
    expect(by(rows, "1105428").contact?.name).toBe("Vasileva, Renata");
    expect(arts.funderKey).toBe("local:MD:montgomery-county:community-engagement-cluster");
  });
});

test.describe("Illinois CDB upcoming bids", () => {
  test("a forecast list with cost ceilings, and no firm of record stored", async () => {
    const { sink } = await runOffline(socrataConnector(ilCdbFuture), pages("state_il_cdb_future", ["future.json"]), { env });
    const rows = sink.opportunityRows;
    expect(rows).toHaveLength(5);
    expect(rows.every((o) => o.status === "forecasted" && o.categories?.includes("construction"))).toBe(true);
    const camp = by(rows, "102-737-012");
    expect(camp.amountMax).toBe(3_500_000);
    expect(camp.openAt).toBe("2027-01-19");
    expect(camp.place?.city).toBe("Murphysboro");
    expect(JSON.stringify(rows)).not.toMatch(/Klingner|Globetrotters|Introba/);
    expect(cdbCity("Statewide Program - Statewide")).toBeNull();
    // Generic titles do not merge different projects.
    expect(new Set(rows.map((o) => o.canonicalKey)).size).toBe(rows.length);
    expect(camp.canonicalKey).toBe("state_il_cdb_future:102-737-012");
  });
});
