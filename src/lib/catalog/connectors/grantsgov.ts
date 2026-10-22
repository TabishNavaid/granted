import { createReadStream } from "node:fs";
import sax from "sax";
import yauzl from "yauzl";
import { causesFromGrantsGovCategories, causesFromText, GRANTSGOV_CATEGORIES, GRANTSGOV_ELIGIBILITY, researchAreasFromText, uniq, type EligibilityCode } from "../vocab";
import { deadline, int, isoDate, money, plainText } from "../normalize";
import type { Connector, FunderInput, IngestContext, OpportunityInput, SourceDefinition } from "../types";

/**
 * Grants.gov: every federal grant opportunity, from the full daily XML extract
 * (https://www.grants.gov/xml-extract). One zip a day holds every synopsis and
 * forecast ever posted, so each run is a full snapshot. We keep open and
 * forecasted notices with their summaries and closed ones from the last few
 * years for history; older closed notices are counted and skipped.
 *
 * Live detail for one notice uses the search2 and fetchOpportunity APIs in
 * src/lib/grantsgov (the app calls them when a person opens a notice).
 */
export const source: SourceDefinition = {
  id: "grantsgov",
  name: "Grants.gov",
  covers: "Every federal grant and cooperative agreement notice, forecasts included, from all 26 federal grant-making agencies.",
  homepage: "https://www.grants.gov",
  docsUrl: "https://www.grants.gov/xml-extract",
  termsUrl: "https://www.grants.gov/policies",
  license: "Public domain (U.S. government work)",
  attribution: "Source: Grants.gov",
  kinds: ["grant", "research", "scholarship"],
  region: "us",
  cadence: "Daily",
  schedule: "15 9 * * *",
  enabled: true,
  priority: 10,
};

const EXTRACT_URL = (day: string) => `https://prod-grants-gov-chatbot.s3.amazonaws.com/extracts/GrantsDBExtract${day}v2.zip`;
export const detailUrl = (id: string) => `https://www.grants.gov/search-results-detail/${id}`;

/** Closed notices older than this many years are skipped (history for analytics, without the bulk). */
const HISTORY_YEARS = Number(process.env.GRANTSGOV_HISTORY_YEARS ?? 3);

/** Agencies whose notices are research funding. Prefix match on the Grants.gov agency code. */
const RESEARCH_AGENCIES = ["HHS-NIH", "NSF", "NASA", "DOD-DARPA", "DOD-ONR", "DOD-AFRL", "DOD-AMRAA", "DOD-AMRMC", "DOD-ARO", "DOE-SC", "PAMS-SC", "DOE-ARPAE", "USDA-NIFA", "HHS-AHRQ", "NIST", "DOC-NIST", "NEH", "IMLS-RES", "DOT-FHWA-RES"];

export type GgRecord = Record<string, string | string[]> & { _kind: "synopsis" | "forecast" };

const MULTI = new Set(["EligibleApplicants", "CFDANumbers", "CategoryOfFundingActivity", "FundingInstrumentType"]);

/** Stream records out of the extract XML. Memory stays flat on the 300 MB file. */
export function parseExtract(input: NodeJS.ReadableStream, onRecord: (r: GgRecord) => void | Promise<void>): Promise<number> {
  return new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: false, normalize: false });
    let rec: GgRecord | null = null;
    let field: string | null = null;
    let text = "";
    let count = 0;
    let queued = 0;
    let pending: Promise<void> = Promise.resolve();
    parser.on("opentag", (node) => {
      const name = node.name.replace(/^.*:/, "");
      if (name === "OpportunitySynopsisDetail_1_0" || name === "OpportunityForecastDetail_1_0") {
        rec = { _kind: name.startsWith("OpportunitySynopsis") ? "synopsis" : "forecast" } as GgRecord;
      } else if (rec) {
        field = name;
        text = "";
      }
    });
    parser.on("text", (t) => {
      if (field) text += t;
    });
    parser.on("cdata", (t) => {
      if (field) text += t;
    });
    parser.on("closetag", (tag) => {
      const name = tag.replace(/^.*:/, "");
      if (rec && (name === "OpportunitySynopsisDetail_1_0" || name === "OpportunityForecastDetail_1_0")) {
        const r = rec;
        rec = null;
        count++;
        // Keep records in order; pause the file while the consumer (the database) catches up.
        queued++;
        pending = pending.then(() => onRecord(r)).finally(() => {
          queued--;
          if (queued < 200 && input.isPaused()) input.resume();
        });
        if (queued > 1_000) input.pause();
        return;
      }
      if (rec && field === name) {
        const v = text.trim();
        if (MULTI.has(name)) rec[name] = [...((rec[name] as string[] | undefined) ?? []), v];
        else rec[name] = v;
        field = null;
      }
    });
    parser.on("error", reject);
    input.on("data", (chunk) => parser.write(chunk));
    input.on("end", () => {
      parser.end();
      pending.then(() => resolve(count), reject);
    });
    input.on("error", reject);
  });
}

function s(r: GgRecord, k: string): string {
  const v = r[k];
  return Array.isArray(v) ? v.join(" ") : (v ?? "");
}
function arr(r: GgRecord, k: string): string[] {
  const v = r[k];
  return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
}

export function classify(r: GgRecord, eligibility: EligibilityCode[]): OpportunityInput["type"] {
  const title = s(r, "OpportunityTitle");
  const agency = s(r, "AgencyCode").toUpperCase();
  const instruments = arr(r, "FundingInstrumentType");
  if (eligibility.length && eligibility.every((e) => e === "individual") && /fellow|scholar|award|prize|internship/i.test(title)) return "scholarship";
  if (/\b(fellowship|scholarship)s?\b/i.test(title) && eligibility.includes("individual")) return "scholarship";
  if (RESEARCH_AGENCIES.some((p) => agency === p || agency.startsWith(`${p}-`) || agency.startsWith(p))) return "research";
  if (arr(r, "CategoryOfFundingActivity").includes("ST") && /\bresearch\b/i.test(title)) return "research";
  if (instruments.length && instruments.every((i) => i === "PC")) return "contract";
  return "grant";
}

/** One extract record to our model, or null when it is closed history older than the window. */
export function toOpportunity(r: GgRecord, now = new Date()): OpportunityInput | null {
  const id = s(r, "OpportunityID");
  const title = plainText(s(r, "OpportunityTitle"));
  if (!id || !title) return null;
  const forecast = r._kind === "forecast";
  const post = isoDate(s(r, "PostDate"));
  const closeRaw = forecast ? s(r, "EstimatedSynopsisCloseDate") : s(r, "CloseDate");
  const close = deadline(closeRaw);
  const archive = isoDate(s(r, "ArchiveDate"));
  const nowMs = now.getTime();
  let status: OpportunityInput["status"];
  if (forecast) {
    // Grants.gov keeps a forecast listed until its archive date, even when the estimated dates have passed. We follow
    // the source, except a forecast with no archive date whose estimated close has passed, which is stale.
    if (archive && new Date(`${archive}T00:00:00Z`).getTime() < nowMs) status = "archived";
    else if (!archive && close && new Date(close).getTime() < nowMs - 86_400_000) status = "closed";
    else status = "forecasted";
  }
  else if (archive && new Date(`${archive}T00:00:00Z`).getTime() < nowMs) status = close && new Date(close).getTime() >= nowMs ? "open" : "archived";
  else if (close && new Date(close).getTime() < nowMs) status = "closed";
  else status = "open";

  const ref = close ?? (post ? `${post}T00:00:00Z` : null);
  const cutoff = nowMs - HISTORY_YEARS * 365 * 86_400_000;
  if ((status === "closed" || status === "archived") && (!ref || new Date(ref).getTime() < cutoff)) return null;

  const eligibility = uniq(arr(r, "EligibleApplicants").flatMap((c) => GRANTSGOV_ELIGIBILITY[c] ?? []));
  const categories = arr(r, "CategoryOfFundingActivity");
  const description = plainText(s(r, "Description"));
  const text = `${title} ${description}`;
  const type = classify(r, eligibility);
  const agencyCode = s(r, "AgencyCode") || null;
  const agencyName = plainText(s(r, "AgencyName")) || null;
  const closeExplanation = plainText(forecast ? s(r, "EstimatedSynopsisCloseDateExplanation") : s(r, "CloseDateExplanation"));
  const keyDates: OpportunityInput["keyDates"] = [];
  if (forecast) {
    const est = isoDate(s(r, "EstimatedSynopsisPostDate"));
    if (est) keyDates.push({ kind: "estimated_post", date: est, label: "Expected posting" });
    const award = isoDate(s(r, "EstimatedAwardDate"));
    if (award) keyDates.push({ kind: "estimated_award", date: award, label: "Expected award" });
    const start = isoDate(s(r, "EstimatedProjectStartDate"));
    if (start) keyDates.push({ kind: "project_start", date: start, label: "Expected project start" });
  }
  const contactEmail = s(r, "GrantorContactEmail") || null;
  return {
    sourceId: id,
    sourceUrl: detailUrl(id),
    opportunityNumber: s(r, "OpportunityNumber") || null,
    // Grants.gov writes NSF solicitation numbers bare ("25-543"); NSF's own listing says "NSF 25-543". Same notice.
    canonicalKey: agencyCode?.toUpperCase().startsWith("NSF") && /^\d{2}-\d{3}$/.test(s(r, "OpportunityNumber").trim()) ? `num:NSF${s(r, "OpportunityNumber").trim()}` : null,
    type,
    noticeType: forecast ? "forecast" : "nofo",
    title,
    summary: description,
    funderKey: agencyCode ? `agency:${agencyCode}` : null,
    funderName: agencyName,
    agencyCode,
    status,
    postedAt: post,
    openAt: forecast ? isoDate(s(r, "EstimatedSynopsisPostDate")) : post,
    closeAt: close,
    closeText: closeExplanation ? closeExplanation.slice(0, 300) : null,
    archiveAt: archive,
    rolling: !close && /rolling|continuous|open until/i.test(closeExplanation),
    keyDates,
    amountMin: money(s(r, "AwardFloor")),
    amountMax: money(s(r, "AwardCeiling")),
    amountTotal: money(s(r, "EstimatedTotalProgramFunding")),
    awardCount: int(s(r, "ExpectedNumberOfAwards")),
    eligibility,
    eligibilityText: plainText(s(r, "AdditionalInformationOnEligibility")) || null,
    assistanceListings: arr(r, "CFDANumbers"),
    categories: categories.map((c) => GRANTSGOV_CATEGORIES[c] ?? c),
    causes: uniq([...causesFromGrantsGovCategories(categories), ...(type === "grant" ? causesFromText(text) : [])]),
    researchAreas: type === "research" ? researchAreasFromText(text) : [],
    place: { country: "US" },
    contact: contactEmail || s(r, "GrantorContactName") ? { name: plainText(s(r, "GrantorContactName")) || null, email: contactEmail, phone: s(r, "GrantorContactPhoneNumber") || null } : null,
    attachments: s(r, "AdditionalInformationURL") ? [{ name: plainText(s(r, "AdditionalInformationText")) || "More information", url: s(r, "AdditionalInformationURL") }] : [],
    extra: {
      costSharing: s(r, "CostSharingOrMatchingRequirement") === "Yes",
      instruments: arr(r, "FundingInstrumentType"),
      fiscalYear: s(r, "FiscalYear") || undefined,
      version: s(r, "Version") || undefined,
      lastUpdated: isoDate(s(r, "LastUpdatedDate")),
    },
  };
}

export function toFunder(r: GgRecord): FunderInput | null {
  const code = s(r, "AgencyCode");
  if (!code) return null;
  const top = code.split("-")[0];
  return {
    key: `agency:${code}`,
    name: plainText(s(r, "AgencyName")) || code,
    kind: "federal_agency",
    parentKey: top !== code ? `agency:${top}` : null,
    country: "US",
    sourceUrl: `https://www.grants.gov/search-grants?agencies=${encodeURIComponent(code)}`,
  };
}

function openZipEntry(file: string): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("Could not open zip"));
      zip.readEntry();
      zip.on("entry", (entry: yauzl.Entry) => {
        if (!/\.xml$/i.test(entry.fileName)) return zip.readEntry();
        zip.openReadStream(entry, (e, stream) => (e || !stream ? reject(e) : resolve(stream)));
      });
      zip.on("end", () => reject(new Error("No XML file in the Grants.gov extract")));
    });
  });
}

/** The newest extract published: today's, else the days before (it is posted early each morning Eastern). */
async function latestExtract(ctx: IngestContext): Promise<{ day: string; file: string }> {
  for (let back = 0; back < 5; back++) {
    const d = new Date(Date.now() - back * 86_400_000);
    const day = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    const head = await ctx.fetch(EXTRACT_URL(day), { method: "HEAD", retries: 1 });
    if (head.ok) return { day, file: await ctx.download(EXTRACT_URL(day), `GrantsDBExtract${day}v2.zip`, { maxAgeHours: 20 }) };
  }
  throw new Error("No Grants.gov extract found for the last five days");
}

export const grantsgov: Connector = {
  source,
  fullSnapshot: true,
  async run(ctx) {
    const { day, file } = ctx.env.GRANTSGOV_EXTRACT_FILE ? { day: "local", file: ctx.env.GRANTSGOV_EXTRACT_FILE } : await latestExtract(ctx);
    ctx.log(`reading extract ${day}`);
    const stream = /\.zip$/i.test(file) ? await openZipEntry(file) : createReadStream(file);
    let skipped = 0;
    const funders = new Map<string, FunderInput>();
    let batch: OpportunityInput[] = [];
    // An opportunity can appear twice: as a forecast and, once posted, as a synopsis with the same id. The synopsis
    // wins; forecasts wait until the end and are written only when no synopsis came with them.
    const synopses = new Set<string>();
    const forecasts = new Map<string, OpportunityInput>();
    const total = await parseExtract(stream, async (r) => {
      if (ctx.done()) return;
      const f = toFunder(r);
      if (f && !funders.has(f.key)) {
        funders.set(f.key, f);
        await ctx.funders([f]);
      }
      try {
        const o = toOpportunity(r);
        if (!o) {
          if (r._kind === "synopsis") synopses.add(s(r, "OpportunityID"));
          skipped++;
          return;
        }
        if (r._kind === "forecast") {
          forecasts.set(o.sourceId, o);
          return;
        }
        synopses.add(o.sourceId);
        batch.push(o);
        if (batch.length >= 400) {
          const b = batch;
          batch = [];
          await ctx.opportunities(b);
        }
      } catch (err) {
        ctx.warn(`Could not read opportunity ${s(r, "OpportunityID")}`, err);
      }
    });
    for (const [id, o] of forecasts) {
      if (synopses.has(id)) continue;
      batch.push(o);
      if (batch.length >= 400) {
        await ctx.opportunities(batch);
        batch = [];
      }
    }
    if (batch.length) await ctx.opportunities(batch);
    ctx.log(`${total} records in the extract, ${skipped} closed before the ${HISTORY_YEARS}-year window skipped`);
  },
};

export const connectors: Connector[] = [grantsgov];
