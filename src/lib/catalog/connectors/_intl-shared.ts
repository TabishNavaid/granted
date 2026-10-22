/**
 * Helpers shared by the international connectors (EU, UK, World Bank):
 * local times in a named time zone, country names to ISO codes, and a few
 * small parsing utilities. Not a connector (the leading underscore keeps the
 * registry from loading it as one).
 */
import { isoDate, normalizeNumber } from "../normalize";

/** Minutes east of UTC for a time zone at one instant ("Europe/Brussels" in July is +120). */
export function tzOffsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/**
 * A wall-clock time on a day in a named zone, as an ISO timestamp with the zone's offset that day:
 * zonedIso("2027-12-01", "17:00", "Europe/Brussels") is "2027-12-01T17:00:00+01:00".
 */
export function zonedIso(day: string, time: string, timeZone: string): string | null {
  const d = isoDate(day);
  const t = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!d || !t || +t[1] > 23 || +t[2] > 59) return null;
  const [y, m, dd] = d.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, dd, +t[1], +t[2]);
  let off = tzOffsetMinutes(wall, timeZone);
  const second = tzOffsetMinutes(wall - off * 60_000, timeZone);
  if (second !== off) off = second;
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${d}T${String(+t[1]).padStart(2, "0")}:${t[2]}:00${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** A source timestamp ("2026-12-21T15:00:59.000+0000", "2026-11-27T12:00:00Z") as ISO, or null. */
export function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** True when the ISO time is after `now`. */
export function isFuture(iso: string | null | undefined, now: Date): boolean {
  return !!iso && new Date(iso).getTime() > now.getTime();
}

// ---------- country names to ISO 3166 alpha-2 ----------

/** Names used by the World Bank and others that the standard English names do not match. */
const COUNTRY_ALIASES: Record<string, string> = {
  "congo democratic republic of": "CD",
  "democratic republic of the congo": "CD",
  "congo republic of": "CG",
  "republic of congo": "CG",
  "egypt arab republic of": "EG",
  "yemen republic of": "YE",
  "iran islamic republic of": "IR",
  "korea republic of": "KR",
  "korea democratic peoples republic of": "KP",
  "lao peoples democratic republic": "LA",
  "kyrgyz republic": "KG",
  "slovak republic": "SK",
  "gambia the": "GM",
  "bahamas the": "BS",
  "micronesia federated states of": "FM",
  "venezuela republica bolivariana de": "VE",
  "venezuela rb": "VE",
  "west bank and gaza": "PS",
  "palestine": "PS",
  "kosovo": "XK",
  "turkiye": "TR",
  "turkey": "TR",
  "cote divoire": "CI",
  "ivory coast": "CI",
  "cabo verde": "CV",
  "cape verde": "CV",
  "sao tome and principe": "ST",
  "st lucia": "LC",
  "st vincent and the grenadines": "VC",
  "st kitts and nevis": "KN",
  "myanmar": "MM",
  "burma": "MM",
  "eswatini": "SZ",
  "swaziland": "SZ",
  "timor leste": "TL",
  "east timor": "TL",
  "north macedonia": "MK",
  "macedonia": "MK",
  "hong kong sar china": "HK",
  "macao sar china": "MO",
  "russian federation": "RU",
  "syrian arab republic": "SY",
  "viet nam": "VN",
  "vietnam": "VN",
  "bolivia plurinational state of": "BO",
  "tanzania united republic of": "TZ",
  "moldova republic of": "MD",
  "czechia": "CZ",
  "czech republic": "CZ",
  "united kingdom": "GB",
  "england": "GB",
  "scotland": "GB",
  "wales": "GB",
  "northern ireland": "GB",
  "united states": "US",
  "united states of america": "US",
};

function normCountry(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’.]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

let countryIndex: Map<string, string> | null = null;

function buildCountryIndex(): Map<string, string> {
  const map = new Map<string, string>();
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const A = 65;
  for (let i = 0; i < 26; i++)
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j);
      let name: string | undefined;
      try {
        name = names.of(code);
      } catch {
        name = undefined;
      }
      if (!name || name === code || /unknown/i.test(name)) continue;
      // "Congo - Kinshasa" and "Myanmar (Burma)" also match on the part before the qualifier.
      map.set(normCountry(name), code);
      const base = name.replace(/\s*[-(].*$/, "");
      if (base && base !== name && !map.has(normCountry(base))) map.set(normCountry(base), code);
    }
  for (const [k, v] of Object.entries(COUNTRY_ALIASES)) map.set(normCountry(k), v);
  // Bare "congo" is ambiguous between the two Congos.
  map.delete("congo");
  return map;
}

/** "Mozambique", "Congo, Democratic Republic of", "Türkiye" to "MZ", "CD", "TR". Regions ("Western and Central Africa") give null. */
export function countryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  countryIndex ??= buildCountryIndex();
  const n = normCountry(name);
  if (!n) return null;
  const hit = countryIndex.get(n);
  if (hit) return hit;
  // "Gambia, The" and "Korea, Rep." style: try "rest first" ordering.
  const comma = name.split(",");
  if (comma.length === 2) {
    const flipped = countryIndex.get(normCountry(`${comma[1]} ${comma[0]}`));
    if (flipped) return flipped;
    // "Somalia, Federal Republic of": the short name before the comma.
    if (/\b(republic|state|federal|kingdom|plurinational)\b/i.test(comma[1])) return countryIndex.get(normCountry(comma[0])) ?? null;
  }
  return null;
}

// ---------- small utilities ----------

/** A stable slug for keys: lower case, ascii letters and digits, single dashes. */
export function slug(s: string, max = 80): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** First string of a value that may be a string, an array of strings, or missing. */
export function first(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : v[0] == null ? "" : String(v[0]);
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Every string of a value that may be a string or an array of strings. */
export function all(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  return typeof v === "string" && v.trim() ? [v] : [];
}

/** JSON inside a string field, or null when it does not parse. */
export function parseJsonField<T>(v: unknown): T | null {
  const s = first(v);
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * A dedupe key for UK notices that Contracts Finder and Find a Tender both carry: the buyer and the buyer's own
 * reference. Scoped to the UK so a short reference never matches a U.S. notice.
 */
export function ukCanonicalKey(buyer: string | null | undefined, reference: string | null | undefined): string | null {
  const ref = normalizeNumber(reference);
  if (!buyer || !ref || ref.length < 4) return null;
  return `gb:${slug(buyer, 60)}:${ref}`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
