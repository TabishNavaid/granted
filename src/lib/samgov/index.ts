import type { SamNotice } from "@/lib/services/contracts";

/**
 * SAM.gov contract opportunities through the official Opportunities API v2
 * (https://open.gsa.gov/api/get-opportunities-public-api/). It needs a free
 * public API key from a SAM.gov account (SAM_GOV_API_KEY). Without one the
 * product says plainly that SAM.gov is not connected; the demo replays a
 * recorded search, mapped to the same v2 fields, through this same code.
 */
export const SAM_API = "https://api.sam.gov/opportunities/v2/search";

export interface SamV2Notice {
  noticeId: string;
  title: string;
  solicitationNumber: string | null;
  fullParentPathName: string | null;
  postedDate: string | null;
  type: string | null;
  baseType: string | null;
  typeOfSetAside: string | null;
  typeOfSetAsideDescription: string | null;
  responseDeadLine: string | null;
  naicsCode: string | null;
  classificationCode: string | null;
  active: string | null;
  pointOfContact: { type?: string | null; fullName?: string | null; email?: string | null; phone?: string | null; title?: string | null }[] | null;
  placeOfPerformance: { city?: { code?: string; name?: string } | null; state?: { code?: string; name?: string } | null; zip?: string | null; country?: { code?: string; name?: string } | null } | null;
  /** A link to the description in the official API. */
  description: string | null;
  uiLink: string | null;
  /** The description text itself, when we have already fetched it (always in the recording). */
  descriptionText?: string;
}

export class SamError extends Error {
  constructor(
    message: string,
    readonly code: "no_key" | "unreachable" | "rate_limited" | "bad_response",
  ) {
    super(message);
  }
}

export const samKey = () => process.env.SAM_GOV_API_KEY?.trim() || null;

const mmddyyyy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;

/** Live search: notices posted in the last 90 days for each NAICS code, optionally in one state. */
export async function searchSam(input: { naics: string[]; state?: string | null; limit?: number; today?: Date }): Promise<SamV2Notice[]> {
  const key = samKey();
  if (!key) throw new SamError("SAM.gov is not connected. Add a free SAM_GOV_API_KEY to search it.", "no_key");
  const today = input.today ?? new Date();
  const from = new Date(today.getTime() - 89 * 86400_000);
  const out = new Map<string, SamV2Notice>();
  for (const code of input.naics.slice(0, 5)) {
    const q = new URLSearchParams({ api_key: key, postedFrom: mmddyyyy(from), postedTo: mmddyyyy(today), ncode: code, limit: String(input.limit ?? 50), offset: "0" });
    if (input.state) q.set("state", input.state);
    let res: Response;
    try {
      res = await fetch(`${SAM_API}?${q.toString()}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new SamError("We could not reach SAM.gov just now. Try again in a few minutes.", "unreachable");
    }
    if (res.status === 429) throw new SamError("SAM.gov's daily limit for this key is used up. It resets tomorrow.", "rate_limited");
    if (!res.ok) throw new SamError(`SAM.gov answered ${res.status}.`, "bad_response");
    const body = (await res.json()) as { opportunitiesData?: SamV2Notice[] };
    for (const n of body.opportunitiesData ?? []) out.set(n.noticeId, n);
  }
  return [...out.values()];
}

/** The description behind the v2 `description` link. Needs the key too. */
export async function fetchDescription(n: SamV2Notice): Promise<string> {
  if (n.descriptionText != null) return n.descriptionText;
  const key = samKey();
  if (!key || !n.description?.startsWith("http")) return "";
  try {
    const res = await fetch(`${n.description}${n.description.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return "";
    const t = await res.text();
    try {
      const j = JSON.parse(t) as { description?: string };
      return stripHtml(j.description ?? "");
    } catch {
      return stripHtml(t);
    }
  } catch {
    return "";
  }
}

export function stripHtml(s: string): string {
  return s
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function placeOf(n: SamV2Notice): string | null {
  const p = n.placeOfPerformance;
  if (!p) return null;
  const city = p.city?.name ?? null;
  const state = p.state?.code ?? p.state?.name ?? null;
  return [city, state].filter(Boolean).join(", ") || null;
}

export const agencyOf = (n: SamV2Notice) => (n.fullParentPathName ?? "").split(".").filter(Boolean)[0]?.trim() ?? "Federal agency";
export const officeOf = (n: SamV2Notice) => {
  const parts = (n.fullParentPathName ?? "").split(".").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].trim() : null;
};

/** The notice in the shape screens use. `fit` and `added` are filled by the caller. */
export function toSamNotice(n: SamV2Notice): SamNotice {
  const poc = (n.pointOfContact ?? []).find((p) => p.type === "primary") ?? (n.pointOfContact ?? [])[0] ?? null;
  return {
    noticeId: n.noticeId,
    title: n.title.replace(/\s+/g, " ").trim(),
    solicitationNumber: n.solicitationNumber,
    agency: titleCaseAgency(agencyOf(n)),
    office: officeOf(n),
    postedDate: n.postedDate,
    type: n.type ?? n.baseType ?? "Notice",
    setAside: n.typeOfSetAsideDescription ?? n.typeOfSetAside,
    setAsideCode: n.typeOfSetAside,
    responseDeadLine: n.responseDeadLine,
    naicsCode: n.naicsCode,
    classificationCode: n.classificationCode,
    placeOfPerformance: placeOf(n),
    description: n.descriptionText ?? "",
    pointOfContact: poc?.fullName ? { name: poc.fullName, email: poc.email ?? null, phone: poc.phone ?? null } : null,
    uiLink: n.uiLink ?? `https://sam.gov/opp/${n.noticeId}/view`,
    fit: null,
    added: false,
  };
}

/** "VETERANS AFFAIRS, DEPARTMENT OF" reads as "Department of Veterans Affairs". */
export function titleCaseAgency(s: string): string {
  const flipped = s.replace(/^(.+?),\s*(DEPARTMENT OF|DEPT OF)$/i, "Department of $1").replace(/^DEPT OF\b/i, "Department of");
  return flipped
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Of|The|And|For)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\b(Gsa|Nasa|Usace|Va|Dod|Hhs|Usda|Doe|Epa|Noaa|Afrl|Fbi|Dhs)\b/g, (w) => w.toUpperCase());
}
