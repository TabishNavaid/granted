import { causesFromText, uniq, type EligibilityCode } from "../vocab";
import { isoDate, money, plainText } from "../normalize";
import type { Connector, FunderInput, IngestContext, OpportunityInput, SourceDefinition } from "../types";
import { HttpError } from "../ingest/http";
import { isFuture, sleep, slug, timestamp, ukCanonicalKey, zonedIso } from "./_intl-shared";

/**
 * UK public tenders from the two official OCDS APIs:
 *   Contracts Finder (England, mostly below the threshold for Find a Tender):
 *     https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search
 *   Find a Tender (above threshold, all of the UK):
 *     https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages
 * Both publish under the Open Government Licence v3.0. We read the tender stage only and keep notices still open for
 * bids (status active and a closing date ahead). A notice sent to both services keeps one dedupe key (buyer plus
 * the buyer's reference), so it shows once.
 */
const OGL = "Open Government Licence v3.0";
const OGL_ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0.";
const LONDON = "Europe/London";

export const contractsFinderSource: SourceDefinition = {
  id: "uk_contracts_finder",
  name: "Contracts Finder (UK)",
  covers: "Open UK public sector tenders published on Contracts Finder, mostly English contracts from about 12,000 pounds up to the Find a Tender threshold.",
  homepage: "https://www.contractsfinder.service.gov.uk",
  docsUrl: "https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search",
  termsUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
  license: OGL,
  attribution: OGL_ATTRIBUTION,
  kinds: ["contract"],
  region: "international",
  cadence: "Daily",
  schedule: "10 6 * * *",
  enabled: true,
  priority: 22,
};

export const findATenderSource: SourceDefinition = {
  id: "uk_find_a_tender",
  name: "Find a Tender (UK)",
  covers: "Open UK public sector tenders above the procurement thresholds, from every part of the UK, published on Find a Tender.",
  homepage: "https://www.find-tender.service.gov.uk",
  docsUrl: "https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages",
  termsUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
  license: OGL,
  attribution: OGL_ATTRIBUTION,
  kinds: ["contract"],
  region: "international",
  cadence: "Daily",
  schedule: "25 6 * * *",
  enabled: true,
  priority: 20,
};

export const findAGrantSource: SourceDefinition = {
  id: "uk_find_a_grant",
  name: "Find a grant (GOV.UK)",
  covers: "UK government grants listed on GOV.UK Find a grant.",
  homepage: "https://www.find-government-grants.service.gov.uk",
  termsUrl: "https://www.find-government-grants.service.gov.uk/info/terms-and-conditions",
  license: OGL,
  attribution: OGL_ATTRIBUTION,
  kinds: ["grant"],
  region: "international",
  cadence: "Not scheduled",
  enabled: false,
  priority: 20,
  notes:
    "Off: the content is under the Open Government Licence, but the service offers no API or open data export of its listings, and we do not scrape web pages. Turn on if GOV.UK publishes a feed.",
};

/**
 * Days of notices a backfill reads. Contracts Finder is small now (most notices moved to Find a Tender in February
 * 2025), so a year is cheap. Find a Tender's stage filter misses Procurement Act notices, so we read every release
 * and keep the tender ones; at about 400 releases a weekday, 60 days covers nearly every tender still open.
 */
const BACKFILL_DAYS: Record<"cf" | "fts", number> = {
  cf: Number(process.env.UK_CF_BACKFILL_DAYS ?? 365),
  fts: Number(process.env.UK_FTS_BACKFILL_DAYS ?? 60),
};
const PAGE_LIMIT = 100;
/** A safety stop: 600 pages of 100 is far more than a year of tender-stage notices on either service. */
const MAX_PAGES = Number(process.env.UK_TENDERS_MAX_PAGES ?? 600);

// ---------- OCDS shapes (the fields we read) ----------

interface OcdsValue {
  amount?: number | string | null;
  currency?: string | null;
}
interface OcdsClassification {
  scheme?: string;
  id?: string;
  description?: string;
}
interface OcdsParty {
  id?: string;
  name?: string;
  identifier?: { legalName?: string; scheme?: string; id?: string };
  address?: { locality?: string; region?: string; postalCode?: string; countryName?: string };
  contactPoint?: { name?: string; email?: string; telephone?: string; url?: string };
  details?: { url?: string };
  roles?: string[];
}
export interface OcdsRelease {
  ocid: string;
  id: string;
  date?: string;
  tag?: string[];
  description?: string;
  tender?: {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    datePublished?: string;
    value?: OcdsValue;
    minValue?: OcdsValue;
    classification?: OcdsClassification;
    additionalClassifications?: OcdsClassification[];
    items?: { additionalClassifications?: OcdsClassification[]; deliveryAddresses?: { region?: string; countryName?: string }[]; deliveryLocation?: { description?: string } }[];
    procurementMethod?: string;
    procurementMethodDetails?: string;
    mainProcurementCategory?: string;
    tenderPeriod?: { startDate?: string; endDate?: string };
    enquiryPeriod?: { endDate?: string };
    contractPeriod?: { startDate?: string; endDate?: string };
    suitability?: { sme?: boolean; vcse?: boolean };
    documents?: { documentType?: string; url?: string; description?: string; title?: string }[];
    lots?: { suitability?: { sme?: boolean; vcse?: boolean } }[];
  };
  parties?: OcdsParty[];
  buyer?: { id?: string; name?: string };
}
export interface OcdsPackage {
  releases?: OcdsRelease[];
  links?: { next?: string };
  license?: string;
}

type Service = "cf" | "fts";

const SERVICE = {
  cf: {
    sourceId: "uk_contracts_finder",
    stages: "stages=tender&",
    base: "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search",
    from: "publishedFrom",
    to: "publishedTo",
    noticeUrl: (r: OcdsRelease) =>
      r.tender?.documents?.find((d) => d.documentType === "tenderNotice" && /^https:\/\/www\.contractsfinder\.service\.gov\.uk\/Notice\//.test(d.url ?? ""))?.url ??
      `https://www.contractsfinder.service.gov.uk/Notice/${r.id.replace(/-\d+$/, "")}`,
  },
  fts: {
    sourceId: "uk_find_a_tender",
    // "stages=tender" here returns only notices under the old regulations, so the stage is checked per release.
    stages: "",
    base: "https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages",
    from: "updatedFrom",
    to: "updatedTo",
    noticeUrl: (r: OcdsRelease) => `https://www.find-tender.service.gov.uk/Notice/${r.id}`,
  },
} as const;

/** "2026-11-27T12:00:00Z" as is; a bare "2026-11-20" means the end of that day in London. */
export function ukDeadline(v: string | undefined): string | null {
  if (!v) return null;
  return timestamp(v) ?? (isoDate(v) ? zonedIso(isoDate(v)!, "23:59", LONDON) : null);
}

function buyerOf(r: OcdsRelease): OcdsParty | null {
  const parties = r.parties ?? [];
  return parties.find((p) => p.roles?.includes("buyer")) ?? (r.buyer?.id ? (parties.find((p) => p.id === r.buyer!.id) ?? null) : null) ?? (r.buyer?.name ? { name: r.buyer.name } : null);
}

export function ukFunder(p: OcdsParty, fallbackUrl: string): FunderInput | null {
  const name = plainText(p.name ?? p.identifier?.legalName ?? "");
  if (!name) return null;
  const website = p.details?.url && /^https?:\/\//i.test(p.details.url) ? p.details.url : null;
  return {
    key: `intl:gb:${slug(name)}`,
    name,
    kind: "international",
    country: "GB",
    city: p.address?.locality ? plainText(p.address.locality) : null,
    website,
    sourceUrl: website ?? fallbackUrl,
  };
}

function cpvList(r: OcdsRelease): OcdsClassification[] {
  const t = r.tender ?? {};
  const list = [t.classification, ...(t.additionalClassifications ?? []), ...(t.items ?? []).flatMap((i) => i.additionalClassifications ?? [])];
  return [...new Map(list.filter((c): c is OcdsClassification => !!c?.id && (c.scheme ?? "CPV").toUpperCase() === "CPV").map((c) => [c.id!, c])).values()];
}

/** One tender-stage release to our model, or null when it is not open for bids. */
export function toOpportunity(service: Service, r: OcdsRelease, now = new Date()): { opportunity: OpportunityInput; funder: FunderInput | null } | null {
  const t = r.tender;
  if (!t || !r.ocid) return null;
  const status = (t.status ?? "active").toLowerCase();
  if (status !== "active") return null;
  const closeAt = ukDeadline(t.tenderPeriod?.endDate);
  if (!closeAt || !isFuture(closeAt, now)) return null;
  const title = plainText(t.title);
  if (!title) return null;
  const cfg = SERVICE[service];
  const sourceUrl = cfg.noticeUrl(r);
  const buyer = buyerOf(r);
  const funder = buyer ? ukFunder(buyer, sourceUrl) : null;
  const summary = plainText(t.description) || plainText(r.description);
  const suit = [t.suitability, ...(t.lots ?? []).map((l) => l.suitability)].filter(Boolean);
  const eligibility: EligibilityCode[] = [];
  if (suit.some((s) => s?.sme)) eligibility.push("small_business");
  if (suit.some((s) => s?.vcse)) eligibility.push("nonprofit");
  const cpv = cpvList(r);
  const regions = uniq((t.items ?? []).flatMap((i) => [...(i.deliveryAddresses ?? []).map((a) => a.region), i.deliveryLocation?.description]).filter((x): x is string => !!x && !!x.trim()));
  const value = money(t.value?.amount);
  const contact = buyer?.contactPoint;
  const posted = isoDate(t.datePublished ?? r.date);
  return {
    funder,
    opportunity: {
      sourceId: r.ocid,
      sourceUrl,
      opportunityNumber: t.id?.trim() || null,
      canonicalKey: ukCanonicalKey(funder?.name, t.id),
      type: "contract",
      noticeType: t.procurementMethodDetails ? slug(t.procurementMethodDetails, 60).replace(/-/g, "_") : "tender",
      title,
      summary,
      funderKey: funder?.key ?? null,
      funderName: funder?.name ?? null,
      status: "open",
      postedAt: posted,
      openAt: isoDate(t.tenderPeriod?.startDate) ?? posted,
      closeAt,
      keyDates: [
        ...(isoDate(t.enquiryPeriod?.endDate) ? [{ kind: "questions_due", date: isoDate(t.enquiryPeriod?.endDate)!, label: "Clarification questions due" }] : []),
        ...(isoDate(t.contractPeriod?.startDate) ? [{ kind: "contract_start", date: isoDate(t.contractPeriod?.startDate)!, label: "Contract starts" }] : []),
      ],
      amountMin: money(t.minValue?.amount),
      amountMax: value,
      currency: (t.value?.currency || t.minValue?.currency || "GBP").toUpperCase(),
      eligibility,
      causes: causesFromText(`${title} ${summary.slice(0, 1_500)}`),
      categories: uniq([t.mainProcurementCategory ? t.mainProcurementCategory[0].toUpperCase() + t.mainProcurementCategory.slice(1) : null, ...cpv.map((c) => plainText(c.description))].filter((x): x is string => !!x)).slice(0, 10),
      place: { country: "GB", text: regions.length ? `${regions.slice(0, 4).join(", ")}, United Kingdom` : "United Kingdom" },
      contact: contact && (contact.email || contact.name || contact.telephone) ? { name: plainText(contact.name) || null, email: contact.email ?? null, phone: contact.telephone ?? null } : null,
      extra: {
        ocid: r.ocid,
        notice: r.id,
        cpv: cpv.map((c) => c.id),
        procedure: t.procurementMethodDetails ?? t.procurementMethod ?? null,
        contractStart: isoDate(t.contractPeriod?.startDate),
        contractEnd: isoDate(t.contractPeriod?.endDate),
        sme: suit.some((s) => s?.sme) || undefined,
        vcse: suit.some((s) => s?.vcse) || undefined,
      },
    },
  };
}

type Mapped = NonNullable<ReturnType<typeof toOpportunity>>;
export type ReleaseEffect = { kind: "open"; row: Mapped } | { kind: "closed" } | { kind: "ignore" };

const ENDING_TAGS = /^(award|awardUpdate|contract|contractUpdate|contractAmendment|contractTermination|implementation|implementationUpdate|tenderCancellation)$/;

/**
 * What one release says about its process: open for bids (with the row), finished (an award, a contract, a
 * cancellation, or a tender that is no longer active), or nothing we can use (planning notices, and partial
 * updates that carry neither a status nor a closing date).
 */
export function releaseEffect(service: Service, r: OcdsRelease, now = new Date()): ReleaseEffect {
  const tags = r.tag ?? [];
  if (tags.some((t) => ENDING_TAGS.test(t))) return { kind: "closed" };
  if (tags.length && !tags.some((t) => /^tender/.test(t))) return { kind: "ignore" };
  const row = toOpportunity(service, r, now);
  if (row) return { kind: "open", row };
  const status = r.tender?.status?.toLowerCase();
  if (status && status !== "active") return { kind: "closed" };
  const end = ukDeadline(r.tender?.tenderPeriod?.endDate);
  if (end && !isFuture(end, now)) return { kind: "closed" };
  return { kind: "ignore" };
}

/** The API's own date form, in UTC: YYYY-MM-DDTHH:MM:SS. */
export function apiDate(d: Date): string {
  return d.toISOString().slice(0, 19);
}

export function firstUrl(service: Service, from: Date, to: Date): string {
  const cfg = SERVICE[service];
  return `${cfg.base}?${cfg.stages}limit=${PAGE_LIMIT}&${cfg.from}=${apiDate(from)}&${cfg.to}=${apiDate(to)}`;
}

/** Contracts Finder answers 403 when a client asks too often and asks for a five-minute pause. */
const CF_PAUSE_MS = 5 * 60_000;

async function getPage(ctx: IngestContext, service: Service, url: string): Promise<OcdsPackage> {
  const pause = Number(ctx.env.UK_CF_PAUSE_MS ?? CF_PAUSE_MS);
  for (let attempt = 0; ; attempt++) {
    const res = await ctx.fetch(url, { timeoutMs: 120_000 });
    if (res.ok) return (await res.json()) as OcdsPackage;
    const body = await res.text().catch(() => "");
    if (service === "cf" && res.status === 403 && attempt < 2) {
      ctx.log(`Contracts Finder asked us to slow down; pausing ${Math.round(pause / 1000)}s`);
      await sleep(pause);
      continue;
    }
    throw new HttpError(res.status, url, body);
  }
}

function makeConnector(service: Service, def: SourceDefinition): Connector {
  return {
    source: def,
    fullSnapshot: true,
    async run(ctx) {
      const now = new Date();
      const from =
        ctx.mode === "incremental"
          ? new Date((ctx.since?.getTime() ?? now.getTime() - 3 * 86_400_000) - 86_400_000)
          : new Date(now.getTime() - BACKFILL_DAYS[service] * 86_400_000);
      let url: string | undefined = firstUrl(service, from, now);
      // One process can appear several times (amendments); its latest release decides. Only the mapped row is kept,
      // so memory stays small on a year of notices.
      const latest = new Map<string, { date: string; mapped: Mapped | null }>();
      let pages = 0;
      let releases = 0;
      let open = 0;
      while (url && pages < MAX_PAGES) {
        const pkg = await getPage(ctx, service, url);
        pages++;
        for (const r of pkg.releases ?? []) {
          releases++;
          if (!r?.ocid) continue;
          const date = r.date ?? "";
          const prev = latest.get(r.ocid);
          if (prev && prev.date > date) continue;
          let effect: ReleaseEffect;
          try {
            effect = releaseEffect(service, r, now);
          } catch (err) {
            ctx.warn(`Could not read release ${r.id}`, err);
            continue;
          }
          if (effect.kind === "ignore") continue;
          const mapped = effect.kind === "open" ? effect.row : null;
          if (prev?.mapped) open--;
          if (mapped) open++;
          latest.set(r.ocid, { date, mapped });
        }
        const next = pkg.links?.next;
        url = next && next !== url && (pkg.releases?.length ?? 0) > 0 ? next : undefined;
        if (ctx.limit !== null && open >= ctx.limit) break;
      }
      if (url && pages >= MAX_PAGES) ctx.warn(`Stopped after ${pages} pages; more notices remain`);
      const rows = [...latest.values()].flatMap((x) => (x.mapped ? [x.mapped] : []));
      const funders = [...new Map(rows.flatMap((x) => (x.funder ? [[x.funder.key, x.funder] as const] : []))).values()];
      await ctx.funders(funders);
      for (let i = 0; i < rows.length && !ctx.done(); i += 400) await ctx.opportunities(rows.slice(i, i + 400).map((x) => x.opportunity));
      ctx.log(`${pages} pages, ${releases} releases, ${latest.size} processes, ${rows.length} open for bids, ${funders.length} buyers`);
    },
  };
}

export const ukContractsFinder = makeConnector("cf", contractsFinderSource);
export const ukFindATender = makeConnector("fts", findATenderSource);

/** Off: no official API or export (see notes). Running it does nothing and fetches nothing. */
export const ukFindAGrant: Connector = {
  source: findAGrantSource,
  async run(ctx) {
    ctx.log("GOV.UK Find a grant has no official API or open data export; nothing to read.");
  },
};
