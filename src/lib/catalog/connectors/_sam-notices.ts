import { deadline, httpUrl, isoDate, normalizeNumber, plainText } from "../normalize";
import type { Amendment, Attachment, EligibilityCode, OpportunityInput } from "../types";
import { SET_ASIDES, stateCode } from "../vocab";
import { agencyKeys, type AgencyPath } from "./_sam-shared";

/**
 * SAM.gov Contract Opportunities: one notice, read from either the public CSV extract or the Opportunities API v2,
 * into one shape, then into our model. Both paths share every rule here so a notice looks the same whichever way
 * it arrived.
 */

export interface SamContact {
  kind: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
}

export interface SamNotice extends AgencyPath {
  noticeId: string;
  title: string;
  solicitationNumber: string | null;
  office: string | null;
  officeCode: string | null;
  /** As published: "2026-10-21 12:44:36" (extract) or "2026-10-15" (API). */
  posted: string | null;
  type: string | null;
  baseType: string | null;
  archiveType: string | null;
  archiveDate: string | null;
  setAsideCode: string | null;
  setAsideLabel: string | null;
  responseDeadline: string | null;
  naics: string[];
  psc: string | null;
  place: { street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null };
  active: boolean;
  contacts: SamContact[];
  description: string | null;
  /** The API's link to the description (needs the key); never stored. */
  descriptionUrl: string | null;
  additionalInfoLink: string | null;
  resourceLinks: string[];
}

/** The public page for a notice. The extract's own link points into the signed-in workspace. */
export const noticeUrl = (noticeId: string) => `https://sam.gov/opp/${noticeId}/view`;

/** Notice types we list, with our code and the status a live one gets. */
const KINDS: Record<string, { code: string; label: string; status: "open" | "forecasted" }> = {
  solicitation: { code: "solicitation", label: "Solicitation", status: "open" },
  "combined synopsis/solicitation": { code: "combined_synopsis_solicitation", label: "Combined synopsis/solicitation", status: "open" },
  presolicitation: { code: "presolicitation", label: "Presolicitation", status: "forecasted" },
  "sources sought": { code: "sources_sought", label: "Sources sought", status: "open" },
  "special notice": { code: "special_notice", label: "Special notice", status: "open" },
};

/** The kind of a notice; the legacy "Modification/Amendment/Cancel" type takes its base type. Null for types we do not list. */
export function kindOf(n: Pick<SamNotice, "type" | "baseType">) {
  const t = (n.type ?? "").trim().toLowerCase();
  if (KINDS[t]) return KINDS[t];
  if (t.startsWith("modification")) return KINDS[(n.baseType ?? "").trim().toLowerCase()] ?? null;
  return null;
}

export const isAwardNotice = (n: Pick<SamNotice, "type">) => /award/i.test(n.type ?? "");

/** Rows are one per solicitation: notices sharing a distinctive solicitation number are one opportunity. */
export function groupKey(n: Pick<SamNotice, "solicitationNumber" | "noticeId">): string {
  const s = normalizeNumber(n.solicitationNumber);
  if (s && s.length >= 6 && /[A-Z]/.test(s) && /\d/.test(s)) return `sol:${s}`;
  return n.noticeId;
}

/** A sortable posted timestamp: "2026-10-21 12:44:36" and "2026-10-15" compare correctly as strings. */
export function postedSortKey(posted: string | null): string {
  const s = (posted ?? "").trim().replace("T", " ");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}(?::\d{2})?))?/);
  if (!m) return "";
  return `${m[1]} ${(m[2] ?? "00:00:00").padEnd(8, ":00")}`;
}

// ---------- Deadlines ----------

/** US Eastern offset ("-04:00" or "-05:00") on a given wall-clock date and time. */
export function easternOffset(localDateTime: string): string {
  const probe = new Date(`${localDateTime.slice(0, 19)}Z`);
  if (Number.isNaN(probe.getTime())) return "-05:00";
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" })
    .formatToParts(new Date(probe.getTime() + 5 * 3_600_000))
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}):?(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "-05:00";
}

/**
 * The response deadline as an instant, plus its published wall-clock time and offset. A time without an offset
 * is read as US Eastern (how SAM.gov shows deadlines when an office gives none); a bare date is the end of that
 * day Eastern, like every other source.
 */
export function responseDeadline(raw: string | null): { closeAt: string | null; local: string | null; tz: string | null } {
  const s = (raw ?? "").trim();
  if (!s) return { closeAt: null, local: null, tz: null };
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    const time = m[2].length === 5 ? `${m[2]}:00` : m[2];
    const tz = m[3] ? (m[3] === "Z" ? "+00:00" : m[3].replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")) : easternOffset(`${m[1]}T${time}`);
    const local = `${m[1]}T${time}${tz}`;
    const d = new Date(local);
    if (Number.isNaN(d.getTime()) || !isoDate(m[1])) return { closeAt: null, local: null, tz: null };
    return { closeAt: d.toISOString(), local, tz };
  }
  const close = deadline(s);
  return { closeAt: close, local: close ? s : null, tz: null };
}

// ---------- Set-asides and eligibility ----------

/** Set-aside codes that reserve the award for small businesses. */
const SMALL_BUSINESS_CODES = new Set(["SBA", "SBP", "8A", "8AN", "HZC", "HZS", "SDVOSBC", "SDVOSBS", "WOSB", "WOSBSS", "EDWOSB", "EDWOSBSS", "VSA", "VSS", "ISBEE", "ESB", "RSB"]);

/** "SBA", '["SBA"]', "NONE", "" to our code and label. Unknown codes keep the source's label. */
export function setAsideOf(rawCode: string | null, rawLabel: string | null): { code: string | null; label: string | null; smallBusiness: boolean } {
  const code = (rawCode ?? "").match(/[A-Za-z0-9]+/)?.[0] ?? null;
  const label = plainText(rawLabel ?? "") || null;
  if ((!code || /^none$/i.test(code)) && (!label || /no set aside/i.test(label))) return { code: null, label: null, smallBusiness: false };
  const known = code ? (SET_ASIDES[code] ?? SET_ASIDES[code.toUpperCase()]) : undefined;
  const text = known ?? label ?? code;
  const smallBusiness = (!!code && SMALL_BUSINESS_CODES.has(code.toUpperCase())) || /small business/i.test(label ?? "");
  return { code: code && !/^none$/i.test(code) ? code : null, label: text, smallBusiness };
}

export function eligibilityFor(smallBusiness: boolean): EligibilityCode[] {
  return smallBusiness ? ["small_business"] : ["for_profit", "small_business"];
}

// ---------- Links ----------

/** Never keep a key or token in a stored link. */
export function cleanLink(url: string | null | undefined): string | null {
  const u = httpUrl(url);
  if (!u) return null;
  const parsed = new URL(u);
  for (const k of [...parsed.searchParams.keys()]) if (/key|token|secret|password|signature|credential/i.test(k)) parsed.searchParams.delete(k);
  return parsed.toString();
}

export function attachmentsOf(n: SamNotice): Attachment[] {
  const out: Attachment[] = [];
  n.resourceLinks.forEach((link, i) => {
    const url = cleanLink(link);
    if (url) out.push({ name: `Attachment ${i + 1}`, url });
  });
  const info = cleanLink(n.additionalInfoLink);
  if (info) out.push({ name: "Additional information", url: info });
  return out;
}

// ---------- Readers ----------

const nz = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && !/^(null|n\/a)$/i.test(s) ? s : null;
};

const naicsList = (...vals: unknown[]): string[] => {
  const out = new Set<string>();
  for (const v of vals.flat()) for (const m of String(v ?? "").match(/\b\d{6}\b/g) ?? []) out.add(m);
  return [...out];
};

/** One row of ContractOpportunitiesFullCSV.csv. Null when it has no notice id or title. */
export function fromCsv(r: Record<string, string>): SamNotice | null {
  const noticeId = nz(r.NoticeId);
  const title = plainText(r.Title ?? "");
  if (!noticeId || !/^[0-9a-f]{20,40}$/i.test(noticeId) || !title) return null;
  const contacts: SamContact[] = [];
  for (const kind of ["Primary", "Secondary"]) {
    const name = nz(r[`${kind}ContactFullname`]);
    const email = nz(r[`${kind}ContactEmail`]);
    const phone = nz(r[`${kind}ContactPhone`]);
    if (name || email || phone) contacts.push({ kind: kind.toLowerCase(), name, email, phone, title: nz(r[`${kind}ContactTitle`]) });
  }
  return {
    noticeId,
    title,
    solicitationNumber: nz(r["Sol#"]),
    department: nz(r["Department/Ind.Agency"]),
    departmentCode: nz(r.CGAC),
    subTier: nz(r["Sub-Tier"]),
    subTierCode: nz(r["FPDS Code"]),
    office: nz(r.Office),
    officeCode: nz(r["AAC Code"]),
    posted: nz(r.PostedDate),
    type: nz(r.Type),
    baseType: nz(r.BaseType),
    archiveType: nz(r.ArchiveType),
    archiveDate: nz(r.ArchiveDate),
    setAsideCode: nz(r.SetASideCode),
    setAsideLabel: nz(r.SetASide),
    responseDeadline: nz(r.ResponseDeadLine),
    naics: naicsList(r.NaicsCode),
    psc: nz(r.ClassificationCode),
    place: { street: nz(r.PopStreetAddress), city: nz(r.PopCity), state: nz(r.PopState), zip: nz(r.PopZip), country: nz(r.PopCountry) },
    active: !/^no$/i.test(r.Active ?? ""),
    contacts,
    description: nz(r.Description),
    descriptionUrl: null,
    additionalInfoLink: nz(r.AdditionalInfoLink),
    resourceLinks: [],
  };
}

type Coded = { code?: string | null; name?: string | null } | string | null | undefined;
const nameOf = (v: Coded) => (typeof v === "string" ? nz(v) : nz(v?.name) ?? nz(v?.code));
const codeOf = (v: Coded) => (typeof v === "string" ? nz(v) : nz(v?.code) ?? nz(v?.name));

/** One record of the Opportunities API v2 `opportunitiesData`. Null when it has no notice id or title. */
export function fromApi(raw: Record<string, unknown>): SamNotice | null {
  const r = raw as Record<string, never>;
  const noticeId = nz(r.noticeId);
  const title = plainText(String(r.title ?? ""));
  if (!noticeId || !title) return null;
  const names = String(r.fullParentPathName ?? "").split(".").map((s) => s.trim());
  const codes = String(r.fullParentPathCode ?? "").split(".").map((s) => s.trim());
  const pop = (r.placeOfPerformance ?? {}) as { streetAddress?: string; city?: Coded; state?: Coded; zip?: string; country?: Coded };
  const contacts: SamContact[] = ((r.pointOfContact ?? []) as Record<string, unknown>[]).map((p) => ({
    kind: nz(p.type)?.toLowerCase() ?? "primary",
    name: nz(p.fullName),
    email: nz(p.email),
    phone: nz(p.phone),
    title: nz(p.title),
  })).filter((c) => c.name || c.email || c.phone);
  const desc = nz(r.descriptionText) ?? (nz(r.description) && !/^https?:\/\//i.test(String(r.description)) ? nz(r.description) : null);
  return {
    noticeId,
    title,
    solicitationNumber: nz(r.solicitationNumber),
    department: nz(r.department) ?? (names[0] || null),
    departmentCode: codes[0] || null,
    subTier: nz(r.subTier) ?? (names[1] || null),
    subTierCode: codes[1] || null,
    office: nz(r.office) ?? (names.length > 2 ? names.slice(2).join(".") : null),
    officeCode: codes[2] || null,
    posted: nz(r.postedDate),
    type: nz(r.type),
    baseType: nz(r.baseType),
    archiveType: nz(r.archiveType),
    archiveDate: nz(r.archiveDate),
    setAsideCode: nz(r.typeOfSetAside) ?? nz(r.setAsideCode),
    setAsideLabel: nz(r.typeOfSetAsideDescription) ?? nz(r.setAside),
    responseDeadline: nz(r.responseDeadLine),
    naics: naicsList(r.naicsCode, (r.naicsCodes ?? []) as unknown[]),
    psc: nz(r.classificationCode),
    place: { street: nz(pop.streetAddress), city: nameOf(pop.city), state: codeOf(pop.state), zip: nz(pop.zip), country: codeOf(pop.country) },
    active: !/^no$/i.test(String(r.active ?? "")),
    contacts,
    description: desc,
    descriptionUrl: nz(r.description) && /^https:\/\/api\.sam\.gov\//i.test(String(r.description)) ? String(r.description) : null,
    additionalInfoLink: nz(r.additionalInfoLink),
    resourceLinks: ((r.resourceLinks ?? []) as unknown[]).map((x) => nz(x)).filter((x): x is string => !!x),
  };
}

// ---------- To our model ----------

/** An earlier notice of the same solicitation, kept as an amendment of the row. */
export interface ChainEntry {
  noticeId: string;
  posted: string | null;
  type: string | null;
  title: string;
}

export interface ToOpportunityOptions {
  now?: Date;
  /** Backfill keeps live notices only; incremental emits whatever changed, closed included. */
  liveOnly?: boolean;
  /** Notices with no response deadline count as live this long after posting. */
  recentDays?: number;
  /** Other notices of the same solicitation, any order; the notice itself is skipped. */
  chain?: ChainEntry[];
}

export type SkipReason = "type" | "inactive" | "past_deadline" | "stale";

function placeOf(n: SamNotice): OpportunityInput["place"] {
  const country = n.place.country?.toUpperCase() ?? null;
  const us = !country || country === "USA" || country === "US";
  const state = us ? stateCode(n.place.state) : null;
  const parts = [n.place.city, state ?? n.place.state, n.place.zip, us ? null : country].filter(Boolean);
  return {
    city: n.place.city,
    state,
    zip: n.place.zip,
    country: us ? "US" : country,
    text: parts.length ? parts.join(", ") : null,
  };
}

/**
 * One notice to an opportunity. Returns the reason instead when the notice is not something to list: a type we do
 * not list (awards, justifications, surplus sales), or, in a backfill, a notice that is no longer live.
 */
export function toOpportunity(n: SamNotice, opts: ToOpportunityOptions = {}): OpportunityInput | SkipReason {
  const now = opts.now ?? new Date();
  const kind = kindOf(n);
  if (!kind) return "type";
  if (opts.liveOnly && !n.active) return "inactive";
  const dl = responseDeadline(n.responseDeadline);
  const posted = isoDate(n.posted);
  const archive = isoDate(n.archiveDate);
  const today = now.toISOString().slice(0, 10);
  let status: OpportunityInput["status"] = kind.status;
  if (!n.active) status = "archived";
  else if (/^\W*(cancel+ed|cancellation)\b/i.test(n.title)) status = "cancelled";
  else if (dl.closeAt && new Date(dl.closeAt).getTime() < now.getTime()) status = "closed";
  else if (!dl.closeAt && archive && archive < today) status = "archived";
  if (opts.liveOnly) {
    if (status === "closed") return "past_deadline";
    if (status !== "open" && status !== "forecasted") return "inactive";
    if (!dl.closeAt) {
      const recent = (opts.recentDays ?? 180) * 86_400_000;
      if (!posted || new Date(`${posted}T00:00:00Z`).getTime() < now.getTime() - recent) return "stale";
    }
  }
  const setAside = setAsideOf(n.setAsideCode, n.setAsideLabel);
  const keys = agencyKeys(n);
  const primary = n.contacts.find((c) => c.kind === "primary") ?? n.contacts[0] ?? null;
  const secondary = n.contacts.find((c) => c !== primary) ?? null;
  const key = groupKey(n);
  const amendments: Amendment[] = (opts.chain ?? [])
    .filter((c) => c.noticeId !== n.noticeId)
    .sort((a, b) => postedSortKey(b.posted).localeCompare(postedSortKey(a.posted)))
    .slice(0, 40)
    .map((c) => ({
      date: isoDate(c.posted),
      summary: c.title && c.title !== n.title ? `${c.type ?? "Notice"}: ${c.title}`.slice(0, 300) : (c.type ?? "Notice"),
      url: noticeUrl(c.noticeId),
    }));
  const extra: Record<string, unknown> = { noticeId: n.noticeId };
  if (n.office) extra.office = n.office;
  if (n.officeCode) extra.officeCode = n.officeCode;
  if (n.baseType && n.baseType !== n.type) extra.baseType = n.baseType;
  if (n.type && kind.label.toLowerCase() !== n.type.toLowerCase()) extra.publishedType = n.type;
  if (dl.tz) {
    extra.responseDeadlineLocal = dl.local;
    extra.responseTimeZone = dl.tz;
  }
  if (secondary) extra.secondaryContact = { name: secondary.name, email: secondary.email, phone: secondary.phone, title: secondary.title };
  return {
    sourceId: key,
    sourceUrl: noticeUrl(n.noticeId),
    opportunityNumber: n.solicitationNumber,
    type: "contract",
    noticeType: kind.code,
    title: n.title.slice(0, 500),
    summary: n.description ? plainText(n.description) : null,
    funderKey: keys.funderKey,
    funderName: keys.funderName,
    agencyCode: n.subTierCode ?? n.departmentCode ?? null,
    status,
    postedAt: posted,
    openAt: posted,
    closeAt: dl.closeAt,
    archiveAt: archive,
    rolling: false,
    eligibility: eligibilityFor(setAside.smallBusiness),
    eligibilityText: setAside.label ? `Set aside: ${setAside.label}` : null,
    naics: n.naics,
    psc: n.psc,
    setAside: setAside.label,
    setAsideCode: setAside.code,
    categories: [kind.label],
    place: placeOf(n),
    attachments: attachmentsOf(n),
    amendments,
    contact: primary ? { name: primary.name, email: primary.email, phone: primary.phone, title: primary.title } : null,
    extra,
  };
}

/** The newest notice of a chain: latest posted, and on a tie the one seen first (the extract lists newest first). */
export function latestOf<T extends { posted: string | null }>(entries: T[]): T | null {
  let best: T | null = null;
  for (const e of entries) if (!best || postedSortKey(e.posted) > postedSortKey(best.posted)) best = e;
  return best;
}

