import { causesFromText, uniq } from "../vocab";
import { isoDate, plainText } from "../normalize";
import type { Connector, FunderInput, OpportunityInput, SourceDefinition } from "../types";
import { getJson } from "../ingest/http";
import { countryCode, isFuture } from "./_intl-shared";

/**
 * World Bank procurement notices for Bank-financed projects, from the official procurement notices API
 * (https://search.worldbank.org/api/v2/procnotices, linked from the Bank's Data Catalog procurement datasets).
 * Borrowers run these procurements; we keep invitations for bids, requests for expressions of interest, and
 * invitations for prequalification whose submission deadline is still ahead. Contract awards are never stored.
 */
export const source: SourceDefinition = {
  id: "world_bank_procurement",
  name: "World Bank procurement notices",
  covers: "Open invitations for bids and requests for expressions of interest on World Bank financed projects worldwide.",
  homepage: "https://projects.worldbank.org/en/projects-operations/procurement",
  docsUrl: "https://financesone.worldbank.org/api-explorer?id=DS01594",
  termsUrl: "https://www.worldbank.org/ext/en/legal/terms-conditions/datasets",
  license: "CC BY 4.0 (World Bank Data Catalog dataset terms)",
  attribution: "Source: World Bank procurement notices",
  kinds: ["contract"],
  region: "international",
  cadence: "Daily",
  schedule: "50 6 * * *",
  enabled: true,
  priority: 20,
};

const API = "https://search.worldbank.org/api/v2/procnotices";
export const detailUrl = (id: string) => `https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(id)}`;
const ROWS = 100;
/** A safety stop. About 1,500 notices are open at a time. */
const MAX_PAGES = Number(process.env.WB_PROC_MAX_PAGES ?? 60);

/** Notice types someone can still respond to. */
export const OPEN_TYPES = new Set(["Invitation for Bids", "Request for Expression of Interest", "Invitation for Prequalification", "Invitation for Prequalification and Bids"]);

const FIELDS = [
  "id",
  "notice_type",
  "noticedate",
  "notice_lang_name",
  "notice_status",
  "submission_deadline_date",
  "submission_deadline_time",
  "project_ctry_name",
  "project_id",
  "project_name",
  "bid_reference_no",
  "bid_description",
  "procurement_group",
  "procurement_method_code",
  "procurement_method_name",
  "contact_organization",
  "contact_name",
  "contact_email",
  "contact_phone_no",
  "contact_ctry_name",
  "notice_text",
];

/** Sorted by deadline, latest first, so paging stops at the first notice already closed. */
export const pageUrl = (offset: number) => `${API}?format=json&rows=${ROWS}&os=${offset}&srt=submission_deadline_date&order=desc&fl=${FIELDS.join(",")}`;

export interface WbNotice {
  id: string;
  notice_type?: string;
  noticedate?: string;
  notice_lang_name?: string;
  notice_status?: string;
  submission_deadline_date?: string;
  submission_deadline_time?: string;
  project_ctry_name?: string;
  project_id?: string;
  project_name?: string;
  bid_reference_no?: string;
  bid_description?: string;
  procurement_group?: string;
  procurement_method_code?: string;
  procurement_method_name?: string;
  contact_organization?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone_no?: string;
  contact_ctry_name?: string;
  notice_text?: string;
}
export interface WbPage {
  rows?: number;
  os?: string;
  total?: string;
  procnotices?: WbNotice[];
}

const GROUPS: Record<string, string> = { GO: "Goods", CW: "Works", CS: "Consulting services", NC: "Non-consulting services" };

export const WORLD_BANK: FunderInput = {
  key: "intl:worldbank",
  name: "World Bank",
  kind: "international",
  country: "US",
  city: "Washington",
  state: "DC",
  website: "https://www.worldbank.org",
  sourceUrl: "https://projects.worldbank.org/en/projects-operations/procurement",
};

/**
 * The deadline. The API gives the day and a local time ("10:00") without a zone, so the stored time is that day at
 * that hour in UTC and the local wording goes in closeText.
 */
export function wbDeadline(n: WbNotice): { closeAt: string | null; closeText: string | null } {
  const day = isoDate(n.submission_deadline_date);
  if (!day) return { closeAt: null, closeText: null };
  const t = /^(\d{1,2}):(\d{2})$/.exec((n.submission_deadline_time ?? "").trim());
  if (!t || +t[1] > 23 || +t[2] > 59) return { closeAt: `${day}T23:59:00Z`, closeText: null };
  const hhmm = `${t[1].padStart(2, "0")}:${t[2]}`;
  return { closeAt: `${day}T${hhmm}:00Z`, closeText: `${hhmm} local time in ${n.project_ctry_name?.trim() || "the borrower country"}` };
}

export function toOpportunity(n: WbNotice, now = new Date()): OpportunityInput | null {
  if (!n?.id || !OPEN_TYPES.has((n.notice_type ?? "").trim())) return null;
  if ((n.notice_status ?? "Published") !== "Published") return null;
  const { closeAt, closeText } = wbDeadline(n);
  if (!closeAt || !isFuture(closeAt, now)) return null;
  const title = plainText(n.bid_description) || plainText(n.project_name);
  if (!title) return null;
  const summary = plainText(n.notice_text);
  const countryName = n.project_ctry_name?.trim() || null;
  const group = GROUPS[(n.procurement_group ?? "").trim()] ?? null;
  // "20-Oct-2026"
  const posted = isoDate((n.noticedate ?? "").replace(/-/g, " "));
  return {
    sourceId: n.id,
    sourceUrl: detailUrl(n.id),
    opportunityNumber: n.bid_reference_no?.trim() || null,
    type: "contract",
    noticeType: (n.notice_type ?? "").toLowerCase().replace(/[^a-z]+/g, "_"),
    title,
    summary,
    funderKey: WORLD_BANK.key,
    funderName: WORLD_BANK.name,
    agencyCode: "WB",
    status: "open",
    postedAt: posted,
    openAt: posted,
    closeAt,
    closeText,
    eligibility: [],
    causes: causesFromText(`${title} ${n.project_name ?? ""}`),
    categories: uniq([n.notice_type?.trim(), group, n.procurement_method_name?.trim()].filter((x): x is string => !!x)),
    place: { country: countryCode(countryName), text: countryName },
    contact:
      n.contact_email || n.contact_name || n.contact_phone_no
        ? { name: plainText(n.contact_name) || null, email: n.contact_email?.trim() || null, phone: n.contact_phone_no?.trim() || null, title: plainText(n.contact_organization) || null }
        : null,
    extra: {
      project: n.project_id ?? null,
      projectName: plainText(n.project_name) || null,
      projectUrl: n.project_id ? `https://projects.worldbank.org/en/projects-operations/project-detail/${encodeURIComponent(n.project_id)}` : null,
      borrowerAgency: plainText(n.contact_organization) || null,
      procurementGroup: group,
      method: n.procurement_method_name?.trim() || null,
      language: n.notice_lang_name ?? null,
    },
  };
}

export const worldBankProcurement: Connector = {
  source,
  fullSnapshot: true,
  async run(ctx) {
    const now = new Date();
    await ctx.funders([WORLD_BANK]);
    let offset = 0;
    let pages = 0;
    let read = 0;
    let kept = 0;
    const seen = new Set<string>();
    const unmatched = new Set<string>();
    while (pages < MAX_PAGES && !ctx.done()) {
      const page = await getJson<WbPage>(ctx.fetch, pageUrl(offset), { timeoutMs: 120_000 });
      pages++;
      const rows = page.procnotices ?? [];
      if (!rows.length) break;
      offset += rows.length;
      read += rows.length;
      const batch: OpportunityInput[] = [];
      let pastDeadline = 0;
      for (const n of rows) {
        try {
          const day = isoDate(n.submission_deadline_date);
          if (!day || day < now.toISOString().slice(0, 10)) pastDeadline++;
          if (seen.has(n.id)) continue;
          const o = toOpportunity(n, now);
          if (!o) continue;
          seen.add(n.id);
          if (o.place?.text && !o.place.country) unmatched.add(o.place.text);
          batch.push(o);
        } catch (err) {
          ctx.warn(`Could not read notice ${n?.id}`, err);
        }
      }
      kept += batch.length;
      await ctx.opportunities(batch);
      // Sorted by deadline, latest first: once a whole page is past its deadline, the rest is too.
      if (pastDeadline === rows.length) break;
    }
    if (unmatched.size) ctx.log(`places kept as text (regions, not countries): ${[...unmatched].slice(0, 12).join("; ")}`);
    ctx.log(`${pages} pages, ${read} notices read, ${kept} open`);
  },
};
