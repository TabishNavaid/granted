import { readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  candidateRows, causesFromFocus, deadlineFromText, filingPdfUrl, foundationName, givingState, irs990pf, opportunitiesFor, readBmfFoundations, readEfileIndex,
  readSoiExtract, tier1Funder, tier2FromXml, type BmfFoundation, type FoundationDetail, type IndexEntry,
} from "@/lib/catalog/connectors/irs-990pf";
import { grantStats, parse990PF, parseXml } from "@/lib/catalog/connectors/_irs-990pf-parse";
import { inflateMember, remoteDirectory, remoteMember, type ZipEntry } from "@/lib/catalog/connectors/_irs-zip";
import type { PoliteFetch } from "@/lib/catalog/types";
import { fixturePath, runOffline } from "./helpers";

const SRC = "irs_990pf";
const fx = (f: string) => fixturePath(SRC, f);
const MUSHROOM_XML = readFileSync(fx("990pf-202620169349100102.xml"));
const ZIP = readFileSync(fx("efile-batch-sample.zip"));
const TODAY = new Date("2026-10-22T12:00:00Z");

/** Answers HTTP Range requests from a local file, as apps.irs.gov does for the batch zips. */
function rangeResponse(buf: Buffer, init?: RequestInit): Response {
  const h = (init?.headers ?? {}) as Record<string, string>;
  const spec = (h.range ?? h.Range ?? "").replace(/^bytes=/, "");
  let start: number;
  let end: number;
  if (spec.startsWith("-")) {
    start = Math.max(0, buf.length - Number(spec.slice(1)));
    end = buf.length - 1;
  } else {
    const [a, b] = spec.split("-");
    start = Number(a);
    end = Math.min(buf.length - 1, b ? Number(b) : buf.length - 1);
  }
  return new Response(new Uint8Array(buf.subarray(start, end + 1)), { status: 206, headers: { "content-range": `bytes ${start}-${end}/${buf.length}` } });
}

function irsFetch(calls: string[] = []): PoliteFetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (/apps\.irs\.gov\/pub\/epostcard\/990\/xml\/\d{4}\/\w+\.zip$/.test(url)) {
      // Only the parts the index names exist; later lettered parts are missing, as on the real site.
      if (/_11C\.zip$|_01B\.zip$|_03B\.zip$/.test(url)) return new Response("", { status: 404 });
      return rangeResponse(ZIP, init);
    }
    if (url.includes("/teos/details/returnsSearch/562156876")) return new Response(readFileSync(fx("teos-returns-562156876.json")), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/teos/details/returnsSearch/")) return new Response(JSON.stringify({ items: [] }), { status: 200 });
    throw new Error(`No recorded response for ${url}`);
  }) as PoliteFetch;
}

const ENV = {
  IRS_BMF_DIR: fx("bmf"),
  IRS_SOI_PF_FILES: `${fx("soi-24eoextract990pf.csv")},${fx("soi-23eoextract990pf.csv")}`,
  IRS_EFILE_INDEX_FILES: `2025=${fx("index_2025-slice.csv")},2026=${fx("index_2026-slice.csv")}`,
};

function cleanCache() {
  rmSync(path.join(__dirname, "..", "..", "test-results", "catalog-cache", SRC), { recursive: true, force: true });
}

/** Names of people who received grants, read straight from the XML, to prove none reach the output. */
function personNames(xml: Buffer): string[] {
  const out: string[] = [];
  for (const m of xml.toString("utf8").matchAll(/<GrantOrContributionPdDurYrGrp>([\s\S]*?)<\/GrantOrContributionPdDurYrGrp>/g)) {
    const p = m[1].match(/<RecipientPersonNm>([^<]+)</);
    if (p) out.push(p[1].trim());
  }
  return out;
}

test.describe("IRS 990-PF: parsing a filing", () => {
  test("reads application info, grants to individuals as counts only, and the accepts flag", () => {
    const p = parse990PF(MUSHROOM_XML)!;
    expect(p).not.toBeNull();
    expect(p.ein).toBe("232846736");
    expect(p.onlyPreselected).toBe(false);
    expect(p.accepts).toBe(true);
    expect(p.application?.howTo).toBeTruthy();
    expect(p.grants).toHaveLength(0);
    expect(p.indiv.length).toBeGreaterThanOrEqual(2);
    for (const g of p.indiv) expect(Object.keys(g).sort()).toEqual(["amount", "purpose"]);
    const names = personNames(MUSHROOM_XML);
    expect(names.length).toBeGreaterThan(0);
    const s = JSON.stringify({ p, stats: grantStats(p) });
    for (const n of names) expect(s).not.toContain(n);
  });

  test("refuses DTDs and entity declarations", () => {
    expect(() => parseXml('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><x>&a;</x>')).toThrow();
  });

  test("a return that is not a 990-PF gives null; broken XML throws", () => {
    expect(parse990PF("<Return><ReturnHeader/><ReturnData><IRS990/></ReturnData></Return>")).toBeNull();
    expect(() => parse990PF("<Return><ReturnData><IRS990PF>")).toThrow();
  });
});

test.describe("IRS 990-PF: reading batch zips by range", () => {
  test("lists the central directory and reads one member identical to the filed XML", async () => {
    const calls: string[] = [];
    const f = irsFetch(calls);
    const url = "https://apps.irs.gov/pub/epostcard/990/xml/2026/2026_TEOS_XML_01A.zip";
    const dir = await remoteDirectory(f, url);
    expect([...dir.keys()].sort()).toEqual(["202543219349103619_public.xml", "202543219349103979_public.xml", "202620169349100102_public.xml"]);
    const xml = await remoteMember(f, url, dir.get("202620169349100102_public.xml")!);
    expect(xml.equals(MUSHROOM_XML)).toBe(true);
    expect(calls.length).toBe(2);
  });

  test("decodes a Deflate64 member recorded from an IRS batch and checks its CRC", () => {
    const meta = JSON.parse(readFileSync(fx("deflate64-member.json"), "utf8")) as ZipEntry;
    expect(meta.method).toBe(9);
    const out = inflateMember(readFileSync(fx("deflate64-member.bin")), meta);
    expect(out.length).toBe(meta.size);
    expect(out.toString("utf8").replace(/^﻿/, "")).toMatch(/^<\?xml/);
    const bad = Buffer.from(readFileSync(fx("deflate64-member.bin")));
    bad[bad.length >> 1] ^= 0xff;
    expect(() => inflateMember(bad, meta)).toThrow();
  });
});

test.describe("IRS 990-PF: Tier 1 from the BMF and the SOI extract", () => {
  test("keeps private non-operating foundations only, and only those that paid grants", async () => {
    const bmf = new Map<string, BmfFoundation>();
    for (const r of ["eo1", "eo2", "eo3", "eo4"]) await readBmfFoundations(fx(`bmf/${r}.csv`), bmf);
    expect([...bmf.keys()].sort()).toEqual(["010414466", "232846736", "352607595", "562156876"]);
    const soi = new Map();
    await readSoiExtract(fx("soi-24eoextract990pf.csv"), "https://example.test/24", (e) => bmf.has(e), soi);
    await readSoiExtract(fx("soi-23eoextract990pf.csv"), "https://example.test/23", (e) => bmf.has(e), soi);
    expect(tier1Funder(bmf.get("010414466")!, soi.get("010414466") ?? [])).toBeNull();
    const a = tier1Funder(bmf.get("562156876")!, soi.get("562156876"))!;
    expect(a.funder).toMatchObject({ key: "ein:562156876", ein: "562156876", kind: "private_foundation", name: "Edward M Armfield Sr Foundation Inc.", city: "Greensboro", state: "NC", totalGiving: 823452, taxYear: 2023 });
    expect(a.funder.sourceUrl).toMatch(/^https:\/\/apps\.irs\.gov\/app\/eos\/details\/\?ein=562156876&/);
    expect(a.funder.giving ?? []).toHaveLength(0);
  });

  test("skips malformed rows", async () => {
    const dir = path.join(__dirname, "..", "..", "test-results", "irs-malformed");
    mkdirSync(dir, { recursive: true });
    const header = readFileSync(fx("bmf/eo1.csv"), "latin1").split("\n")[0];
    writeFileSync(path.join(dir, "eo.csv"), `${header}\nNOT-AN-EIN,BAD ROW,,,,OH,,,03,,,,,04\n,,,,\n`, "latin1");
    expect((await readBmfFoundations(path.join(dir, "eo.csv"))).size).toBe(0);
    const soiHeader = readFileSync(fx("soi-24eoextract990pf.csv"), "latin1").split("\n")[0];
    writeFileSync(path.join(dir, "soi.csv"), `${soiHeader}\nE,562156876,2024,1,2023\n`, "latin1");
    expect((await readSoiExtract(path.join(dir, "soi.csv"), "x", () => true)).size).toBe(0);
  });

  test("names lose masked account numbers and trust codes", () => {
    expect(foundationName("CLAUDE & DELA CHILCUTT TRUST XXXXX9001")).toBe("Claude & Dela Chilcutt Trust");
    expect(foundationName("ARLAN SCHONBERG ESTATE BES11R106011")).toBe("Arlan Schonberg Estate");
    expect(foundationName("DUANE & KATHLEEN FOULKES FOUNDATIONINC")).toBe("Duane & Kathleen Foulkes Foundation Inc.");
    expect(foundationName("SIMEON J FORTIN TR UW")).toBe("Simeon J Fortin Trust");
  });
});

test.describe("IRS 990-PF: Tier 2 detail and opportunities", () => {
  test("the e-file index gives the newest 990-PF per EIN, batch ids upper case", async () => {
    const idx = new Map<string, IndexEntry>();
    await readEfileIndex(fx("index_2025-slice.csv"), "2025", () => true, idx);
    await readEfileIndex(fx("index_2026-slice.csv"), "2026", () => true, idx);
    expect(idx.size).toBe(3);
    expect(idx.get("232846736")).toMatchObject({ objectId: "202620169349100102", year: "2026", batch: "2026_TEOS_XML_01A", taxPeriod: "202505" });
  });

  test("filed deadlines become the next date, rolling, or text only", () => {
    expect(deadlineFromText("JUNE 15TH AND OCTOBER 31ST", TODAY)).toMatchObject({ rolling: false, closeAt: "2026-10-31T23:59:00-05:00" });
    expect(deadlineFromText("June 1st annually", TODAY).closeAt).toBe("2027-06-01T23:59:00-05:00");
    expect(deadlineFromText("15th of March", TODAY).closeAt).toBe("2027-03-15T23:59:00-05:00");
    expect(deadlineFromText("Two yearly application periods: June 1-15 & dec. 1-15.", TODAY).closeAt).toBe("2026-12-15T23:59:00-05:00");
    expect(deadlineFromText("None", TODAY)).toEqual({ rolling: true, closeAt: null, closeText: "None" });
    expect(deadlineFromText(null, TODAY)).toEqual({ rolling: true, closeAt: null, closeText: null });
    expect(deadlineFromText("Quarterly board meetings", TODAY)).toEqual({ rolling: false, closeAt: null, closeText: "Quarterly board meetings" });
  });

  test("a filing with grants to individuals and application info becomes a scholarship row, without names", () => {
    const e: IndexEntry = { ein: "232846736", taxPeriod: "202505", objectId: "202620169349100102", batch: "2026_TEOS_XML_01A", year: "2026" };
    const out = tier2FromXml(MUSHROOM_XML, e, { filedName: "AMERICAN MUSHROOM INSTITUTE COMMUNITY AWARENESS SCHOLARSHIP", city: "AVONDALE", state: "PA" })!;
    expect(out.funder.extra?.objectId).toBe("202620169349100102");
    expect(out.funder.grantsToIndividuals).toBe(true);
    const opps = opportunitiesFor(out.detail, TODAY);
    expect(opps.map((o) => o.type)).toEqual(["scholarship"]);
    const s = opps[0];
    expect(s).toMatchObject({ canonicalKey: "ein:232846736:individual", status: "open", eligibility: ["individual"], funderKey: "ein:232846736", noticeType: "foundation" });
    expect(s.title).toMatch(/American Mushroom Institute/);
    const all = JSON.stringify({ funder: out.funder, opps });
    for (const n of personNames(MUSHROOM_XML)) expect(all).not.toContain(n);
  });

  test("preselected-only foundations and foreign 4948(b) filers make no open rows", () => {
    const d: FoundationDetail = {
      ein: "123456789", name: "Example", filedName: "EXAMPLE", city: "Columbus", state: "OH", taxYear: 2024, objectId: "1", sourceUrl: "https://apps.irs.gov/x",
      totalGiving: 100000, grantCount: 10, grantLow: 1000, grantMedian: 5000, grantHigh: 20000, focus: ["Education"], granteeStates: [{ state: "OH", count: 9 }, { state: "KY", count: 1 }],
      onlyPreselected: true, accepts: false, application: null, individual: { count: 0, total: 0, min: null, median: null, max: null, scholarships: 0 },
    };
    expect(opportunitiesFor(d)).toHaveLength(0);
    expect(candidateRows(d).every((c) => !c.qualifies)).toBe(true);
    const app = { contact: null, contactName: null, phone: null, email: null, howTo: "N/a - section 4948(b)", deadlines: null, restrictions: null };
    expect(opportunitiesFor({ ...d, onlyPreselected: false, accepts: true, application: app })).toHaveLength(0);
    const open = opportunitiesFor({ ...d, onlyPreselected: false, accepts: true, application: { ...app, howTo: "Letter to the trustee" } }, TODAY);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ type: "grant", amountMin: 1000, amountMax: 20000, rolling: true, place: { state: "OH" }, causes: ["education"], eligibility: ["nonprofit"] });
    expect(givingState({ ...d, granteeStates: [{ state: "OH", count: 4 }, { state: "KY", count: 3 }, { state: "IN", count: 3 }] })).toBeNull();
    expect(causesFromFocus(["Rural health", "Scholarships", "Unknown"])).toEqual(["health", "education"]);
  });

  test("the filing PDF link comes from the IRS returns list for the same tax period and form", async () => {
    const f = irsFetch();
    expect(await filingPdfUrl(f, "562156876", "202412")).toMatch(/^https:\/\/apps\.irs\.gov\/pub\/epostcard\/cor\/562156876_202412_990PF_\d+\.pdf$/);
    expect(await filingPdfUrl(f, "562156876", "199912")).toBeNull();
  });
});

test.describe("IRS 990-PF: the connector", () => {
  test("emits Tier 1 funders, then Tier 2 detail and open opportunities, funders first", async () => {
    cleanCache();
    const calls: string[] = [];
    const { sink, result } = await runOffline(irs990pf, irsFetch(calls), { env: ENV });
    expect(result.status).toBe("succeeded");
    const keys = sink.funderRows.map((f) => f.key);
    expect(new Set(keys)).toEqual(new Set(["ein:562156876", "ein:352607595", "ein:232846736"]));
    const detailed = sink.funderRows.filter((f) => f.extra?.objectId);
    expect(detailed).toHaveLength(3);
    const armfield = detailed.find((f) => f.key === "ein:562156876")!;
    expect(armfield.sourceUrl).toMatch(/\/pub\/epostcard\/cor\/562156876_202412_990PF_/);
    expect(armfield.giving?.[0]).toMatchObject({ year: 2024 });
    const grantees = armfield.extra?.grantees as [string, string | null, string | null, number, string | null][];
    expect(grantees).toHaveLength(15);
    expect(grantees[0][3]).toBeGreaterThanOrEqual(grantees[14][3]);
    expect((armfield.extra?.granteeStates as [string, number][])[0][0]).toBe("NC");
    expect(armfield.acceptsApplications).toBe(true);
    const coughlin = detailed.find((f) => f.key === "ein:352607595")!;
    expect(coughlin.acceptsApplications).toBe(false);
    const byKey = new Map(sink.opportunityRows.map((o) => [o.canonicalKey, o]));
    expect([...byKey.keys()].sort()).toEqual(["ein:232846736:individual", "ein:562156876:grant"]);
    const g = byKey.get("ein:562156876:grant")!;
    expect(g).toMatchObject({ type: "grant", status: "open", rolling: false, funderName: "Edward M Armfield Sr Foundation Inc.", eligibility: ["nonprofit"] });
    expect(g.closeText).toMatch(/june 15th and october 31st/i);
    expect(new Date(g.closeAt!).getTime()).toBeGreaterThan(Date.now());
    expect(g.closeAt).toMatch(/-(06-15|10-31)T23:59/);
    expect(g.summary).not.toMatch(/[—–]/);
    for (const o of sink.opportunityRows) expect(keys).toContain(o.funderKey);
    // Only the parts the index names and their lettered siblings were asked for, never a whole zip.
    expect(calls.filter((c) => c.endsWith(".zip")).every((c) => /_(11B|01A|11C|01B)\.zip$/.test(c))).toBe(true);
  });

  test("respects the per-run cap (largest first) and the opportunity limit", async () => {
    cleanCache();
    const capped = await runOffline(irs990pf, irsFetch(), { env: { ...ENV, IRS_990PF_MAX_XML: "1" } });
    expect(capped.sink.funderRows.filter((f) => f.extra?.objectId).map((f) => f.key)).toEqual(["ein:562156876"]);
    const limited = await runOffline(irs990pf, irsFetch(), { env: ENV, limit: 1 });
    expect(limited.sink.opportunityRows.length).toBe(1);
  });

  test("a higher giving threshold leaves smaller foundations at Tier 1", async () => {
    cleanCache();
    const { sink } = await runOffline(irs990pf, irsFetch(), { env: { ...ENV, IRS_990PF_MIN_GIVING: "100000" }, mode: "incremental", since: new Date("2026-10-01T00:00:00Z") });
    expect(sink.funderRows.filter((f) => f.extra?.objectId).map((f) => f.key)).toEqual(["ein:562156876"]);
    expect(sink.funderRows.filter((f) => !f.extra?.objectId)).toHaveLength(3);
  });
});
