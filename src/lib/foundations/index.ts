import type { EligibilityCheck, Fact, Funder, Opportunity, Organization } from "@/lib/types";
import { displayName } from "./names";

/**
 * Private foundations from public IRS Form 990-PF filings (see
 * docs/foundations-data.md for the source and refresh steps). Matching here
 * is plain code over that data: no model, no network, no cost, so it runs the
 * same in the demo and in production. Every reason it gives quotes a number
 * from the filing and leans on one of the organization's confirmed facts.
 */
export interface FoundationGrant {
  name: string;
  city: string;
  state: string;
  amount: number;
  purpose: string;
}

export interface FoundationRecord {
  ein: string;
  /** The name as we display it; see names.ts. */
  name: string;
  /** The name exactly as filed with the IRS. */
  filedName: string;
  city: string;
  state: string;
  zip: string;
  website: string | null;
  taxYear: number;
  objectId: string;
  batchId: string;
  assets: number | null;
  totalGiving: number | null;
  grantCount: number;
  grantMedian: number | null;
  grantMin: number | null;
  grantMax: number | null;
  acceptsUnsolicited: boolean | null;
  application: { contact: string | null; howTo: string | null; deadlines: string | null; restrictions: string | null } | null;
  focus: string[];
  granteeStates: { state: string; count: number }[];
  granteeCities: { city: string; state: string; count: number }[];
  grantees: FoundationGrant[];
  officers?: { name: string; title: string }[];
  /** The filing itself (a PDF on apps.irs.gov) when the database found it; better than the search page link. */
  filingUrl?: string | null;
}

interface Dataset {
  generatedAt: string;
  states: string[];
  foundations: FoundationRecord[];
}

// The demo's foundation set (390 filings, about 1 MB) loads on first use, not with every page: callers
// `await loadFoundations()` before the synchronous helpers below, which throw if it has not loaded.
let data: Dataset | null = null;
let loading: Promise<void> | null = null;

export function loadFoundations(): Promise<void> {
  return (loading ??= import("@/data/foundations.json", { with: { type: "json" } }).then((m) => {
    const raw = (m.default ?? m) as unknown as Dataset;
    // On the 990-PF, application details are filled in only when the "preselected organizations only" box is not checked.
    data = {
      ...raw,
      foundations: raw.foundations.map((f) => ({ ...f, name: displayName(f.name), filedName: f.name, acceptsUnsolicited: f.acceptsUnsolicited == null && f.application?.howTo ? true : f.acceptsUnsolicited })),
    };
  }));
}

function loaded(): Dataset {
  if (!data) throw new Error("Foundation data is not loaded yet. Call loadFoundations() first.");
  return data;
}

/** When the bundled filings were read. Fixed at build time so pages can show it without loading the set. */
export const FOUNDATIONS_GENERATED_AT = "2026-10-18T22:04:05Z";

export function allFoundations(): FoundationRecord[] {
  return loaded().foundations;
}

export const funderIdFor = (ein: string) => `pf_${ein}`;
export const opportunityIdFor = (ein: string) => `pf_${ein}_grants`;

/** Foundations read from the opportunity database in this process, so detail lookups find them too. */
const fromDatabase = new Map<string, FoundationRecord>();
export function rememberFoundations(records: FoundationRecord[]) {
  for (const r of records) fromDatabase.set(r.ein, r);
}

export function foundationByFunderId(id: string): FoundationRecord | null {
  const ein = id.replace(/^pf_/, "").replace(/_grants$/, "");
  // Never throws: in the real product most foundations come from the database and the bundled set may not be loaded.
  return fromDatabase.get(ein) ?? data?.foundations.find((f) => f.ein === ein) ?? null;
}

const STATE_CODES: Record<string, string> = { ohio: "OH", kentucky: "KY", "north carolina": "NC", indiana: "IN", "west virginia": "WV", tennessee: "TN", virginia: "VA", "south carolina": "SC", michigan: "MI", pennsylvania: "PA" };
export function stateCode(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATE_CODES[t.toLowerCase()] ?? "";
}

/** The IRS page for this organization, where its filed returns can be opened. */
export function irsPageUrl(f: Pick<FoundationRecord, "ein" | "filedName" | "city" | "state"> & { filingUrl?: string | null }): string {
  if (f.filingUrl) return f.filingUrl;
  const q = new URLSearchParams({ ein: f.ein, name: f.filedName.toUpperCase(), city: f.city.toUpperCase(), state: f.state, countryAbbr: "US", dba: "", type: "CHARITIES", orgTags: "CHARITIES" });
  return `https://apps.irs.gov/app/eos/details/?${q.toString()}`;
}

export function formatEin(ein: string) {
  return ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ein;
}

const money = (n: number | null | undefined) => (n == null ? "not stated" : `$${Math.round(n).toLocaleString("en-US")}`);

// ---------- Deadlines as filed ----------

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * The next date named in the filing's deadline text, if it names one. "None",
 * "rolling", and "any time" mean rolling. Anything we cannot read is left as
 * text for the director to read, never guessed.
 */
export function nextDeadline(text: string | null | undefined, today = new Date()): { date: string | null; type: "fixed" | "rolling"; asFiled: string | null } {
  const raw = (text ?? "").trim();
  if (!raw || /\b(none|no deadline|rolling|any ?time|year[- ]round|ongoing|open)\b/i.test(raw)) return { date: null, type: "rolling", asFiled: raw || null };
  const found: Date[] = [];
  const re = new RegExp(`\\b(${MONTHS.join("|")}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi");
  for (const m of raw.matchAll(re)) {
    const mi = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
    const day = Number(m[2]);
    if (mi < 0 || day < 1 || day > 31) continue;
    const y = today.getUTCFullYear();
    let d = new Date(Date.UTC(y, mi, day));
    if (d.getTime() < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) d = new Date(Date.UTC(y + 1, mi, day));
    found.push(d);
  }
  if (!found.length) return { date: null, type: "rolling", asFiled: raw };
  found.sort((a, b) => a.getTime() - b.getTime());
  return { date: found[0].toISOString().slice(0, 10), type: "fixed", asFiled: raw };
}

// ---------- Rows the rest of the product uses ----------

export function noticeTextFor(f: FoundationRecord): string {
  const lines = [
    `Funder: ${f.name}, a private foundation in ${f.city}, ${f.state} (EIN ${formatEin(f.ein)})`,
    `Source: IRS Form 990-PF for tax year ${f.taxYear}`,
    `Grants paid that year: ${money(f.totalGiving)} across ${f.grantCount} grants to organizations`,
    f.grantMedian != null ? `Typical grant (median): ${money(f.grantMedian)}; smallest ${money(f.grantMin)}; largest ${money(f.grantMax)}` : "",
    f.focus.length ? `Giving focus, from the purposes of its grants: ${f.focus.join(", ")}` : "",
    f.granteeStates.length ? `Where grantees are: ${f.granteeStates.slice(0, 4).map((s) => `${s.state} (${s.count})`).join(", ")}` : "",
    f.acceptsUnsolicited === false ? "Applications: the foundation reports that it gives only to preselected organizations and does not accept unsolicited requests." : "",
    f.application?.howTo ? `How to apply, as filed: ${f.application.howTo}` : "",
    f.application?.deadlines ? `Deadlines, as filed: ${f.application.deadlines}` : "",
    f.application?.restrictions ? `Restrictions, as filed: ${f.application.restrictions}` : "",
    f.application?.contact ? `Contact, as filed: ${f.application.contact}` : "",
    "Recent grants:",
    ...f.grantees.slice(0, 10).map((g) => `- ${g.name} (${[g.city, g.state].filter(Boolean).join(", ")}): ${money(g.amount)}${g.purpose ? ` for ${g.purpose}` : ""}`),
  ];
  return lines.filter(Boolean).join("\n");
}

export function toFunder(f: FoundationRecord, checkedAt = FOUNDATIONS_GENERATED_AT): Funder {
  const where = f.granteeStates.slice(0, 2).map((s) => s.state);
  return {
    id: funderIdFor(f.ein),
    name: f.name,
    ein: formatEin(f.ein),
    type: "private_foundation",
    description: `A private foundation in ${f.city}, ${f.state}. In tax year ${f.taxYear} it paid ${money(f.totalGiving)} in ${f.grantCount} grants${f.grantMedian != null ? `, typically ${money(f.grantMedian)}` : ""}. Figures are from its IRS Form 990-PF.`,
    focusAreas: f.focus,
    geography: where.length ? `Grantees mostly in ${where.join(" and ")}` : `${f.state}`,
    givingMin: f.grantMin,
    givingMax: f.grantMax,
    websiteUrl: f.website ?? irsPageUrl(f),
    sourceUrl: irsPageUrl(f),
    aiPolicy: null,
    lastVerifiedAt: checkedAt,
    recentGrantees: f.grantees.slice(0, 8).map((g) => ({ name: g.name, amount: g.amount, year: f.taxYear })),
    sourceNote: `Form 990-PF for tax year ${f.taxYear}`,
  };
}

export function toOpportunity(f: FoundationRecord, today = new Date(), checkedAt = FOUNDATIONS_GENERATED_AT): Opportunity {
  const dl = nextDeadline(f.application?.deadlines, today);
  const how = f.application?.howTo?.trim();
  return {
    id: opportunityIdFor(f.ein),
    funderId: funderIdFor(f.ein),
    title: `${f.name} grants`,
    summary: [
      `Grants of ${money(f.grantMin)} to ${money(f.grantMax)} in tax year ${f.taxYear}, typically ${money(f.grantMedian)}.`,
      how ? `How to apply, as filed: ${how.length > 220 ? `${how.slice(0, 218).trimEnd()}…` : how}` : "The filing does not describe how to apply. Contact the foundation first.",
      dl.asFiled ? `Deadlines as filed: ${dl.asFiled}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    deadline: dl.date,
    deadlineType: dl.type,
    amountMin: f.grantMin,
    amountMax: f.grantMax,
    eligibility: [{ label: "Organizations described in section 501(c)(3)", required: true }, ...(f.application?.restrictions ? [{ label: `Restrictions as filed: ${f.application.restrictions}`, required: true }] : [])],
    guidelinesUrl: f.website ?? irsPageUrl(f),
    sourceUrl: irsPageUrl(f),
    lastVerifiedAt: checkedAt,
    effort: (f.grantMedian ?? 0) <= 10_000 ? "low" : (f.grantMedian ?? 0) <= 50_000 ? "medium" : "high",
    forecasted: false,
    sourceNote: `Form 990-PF for tax year ${f.taxYear}`,
  };
}

// ---------- Matching ----------

/**
 * Kinds of work, in priority order. A cause maps to the first kind whose
 * words it contains; a grant counts as the same work when its recipient's
 * name or purpose contains that kind's words. A grant that matches only
 * `near` is related work at another scale (a hospital system's cancer
 * institute for a rural clinic) and counts for less.
 */
const WORK: { key: string; cause: RegExp; grant: RegExp; near?: RegExp; focus: string[] }[] = [
  { key: "food", cause: /food|hunger|nutrition|pantry|meal/i, grant: /\bfood|hunger|pantry|pantries|meals?\b|feed(ing)?\b|nutrition|healthy eating|grocer|harvest|soup kitchen|backpack/i, focus: ["Food security", "Human services"] },
  {
    key: "health",
    cause: /health|clinic|medical|chronic|recovery|substance|care\b/i,
    grant: /(?<!cleveland |mayo )clinic|primary care|community health|rural health|public health|health (department|district|center)|dental|nurs(e|ing)|wellness|recovery|addiction|substance|diabet|chronic disease|patients?\b/i,
    near: /health|medical|hospitals?\b/i,
    focus: ["Health", "Rural health"],
  },
  { key: "youth", cause: /youth|teen|after.?school|mentor|young people/i, grant: /\byouth|teens?\b|after.?school|mentor|boys (&|and) girls|boys club|girls club|big brothers|big sisters|ymca|ywca|scouts|young people|\bkids\b/i, focus: ["Youth development", "Education"] },
  { key: "education", cause: /educat|school|literacy|tutor|college|student/i, grant: /school|educat|literacy|tutor|learning|students?\b/i, focus: ["Education", "Scholarships"] },
  { key: "family", cause: /famil|housing|stabil|basic needs/i, grant: /famil|housing|shelter|homeless/i, focus: ["Human services", "Housing"] },
  { key: "rural", cause: /rural/i, grant: /\brural\b|\bappalachia\b/i, focus: ["Community development", "Rural health"] },
  { key: "work", cause: /workforce|job|employment|career/i, grant: /workforce|job training|employment|career/i, focus: ["Community development", "Education"] },
  { key: "farm", cause: /agricultur|farm/i, grant: /farm|agricultur|garden/i, focus: ["Food security", "Environment"] },
  { key: "arts", cause: /\bart|music|culture/i, grant: /\barts?\b|music|museum|theat/i, focus: ["Arts and culture"] },
];

/** The kinds of work an organization does, most important first, from its causes in the order it gave them. */
function workOf(org: Organization): { key: string; grant: RegExp; near?: RegExp; focus: string[]; weight: number }[] {
  const out: { key: string; grant: RegExp; near?: RegExp; focus: string[]; weight: number }[] = [];
  const seen = new Set<string>();
  const add = (text: string) => {
    const w = WORK.find((k) => k.cause.test(text));
    if (!w || seen.has(w.key)) return;
    seen.add(w.key);
    out.push({ key: w.key, grant: w.grant, near: w.near, focus: w.focus, weight: out.length === 0 ? 1 : out.length === 1 ? 0.6 : 0.3 });
  };
  for (const c of org.causes) add(c);
  if (!out.length) add(org.mission);
  return out;
}

export interface FoundationMatch {
  foundation: FoundationRecord;
  fitScore: number;
  reasons: string[];
  cautions: string[];
  eligibilityChecks: EligibilityCheck[];
  /** The confirmed facts the reasons lean on. */
  factIds: string[];
}

export interface FoundationScreen {
  matches: FoundationMatch[];
  screened: number;
  inState: number;
  closedToRequests: number;
  setAside: { name: string; reason: string }[];
}

function findFact(facts: Fact[], re: RegExp): Fact | undefined {
  return facts.find((f) => re.test(f.label));
}

/**
 * Score every foundation against the organization. Hard filters first, in
 * code: the foundation must give in the organization's state, must have made
 * grants for related work (a focus label alone is not enough), and must not
 * say it gives only to organizations it picks. Then a score from how much of
 * its giving is the organization's main work, how much is in the state and
 * city, and whether its typical grant fits the organization's budget. A
 * foundation with no grant for that main work stays a possible fit at most,
 * and one that scores very low is left out.
 */
/**
 * `pool` is the set of foundations to screen: in the real product, the foundations in the opportunity database that
 * give in the organization's state (every state is covered); in the demo, the bundled sample of three states.
 */
export function matchFoundations(input: { org: Organization; facts: Fact[]; limit?: number; pool?: FoundationRecord[] }): FoundationScreen {
  const { org, facts } = input;
  const st = stateCode(org.state);
  const work = workOf(org);
  const budget = org.annualBudget ?? null;
  const placeFact = findFact(facts, /zip|service area|county|counties|location|geograph|partner schools|grocery|mobile unit communities/i) ?? facts.find((f) => f.category === "geography");
  const sizeFact = findFact(facts, /expense|budget/i);
  const reachFact = facts.find((f) => f.category === "reach") ?? facts[0];
  const near = [org.city, org.serviceArea]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 5 && !/^(count|north|south|carolina|kentucky|virginia|ohio|codes|areas?|states?|parts?|eastern|western|central)/.test(w));
  const all = input.pool ?? loaded().foundations;
  const setAside: FoundationScreen["setAside"] = [];
  let inState = 0;
  let closed = 0;
  const scored: FoundationMatch[] = [];
  for (const f of all) {
    const total = f.granteeStates.reduce((n, s) => n + s.count, 0) || f.grantCount || 1;
    const here = f.granteeStates.find((s) => s.state === st)?.count ?? 0;
    const share = here / total;
    if (!st || (f.state !== st && share < 0.25) || here === 0) continue;
    inState++;
    const relevance = (g: FoundationGrant) => {
      const text = `${g.name} ${g.purpose}`;
      return Math.max(0, ...work.map((w) => (w.grant.test(text) ? w.weight : w.near?.test(text) ? w.weight * 0.6 : 0)));
    };
    const relevant = f.grantees.map((g) => ({ g, r: relevance(g) })).filter((x) => x.r >= 0.6);
    // The kind of work itself ("Food security"), not a broad label every funder shares ("Human services").
    const primaryFocus = work[0] ? f.focus.includes(work[0].focus[0]) : false;
    if (!relevant.length) continue;
    if (f.acceptsUnsolicited === false) {
      closed++;
      if (setAside.length < 40) setAside.push({ name: f.name, reason: "its filing says it gives only to organizations it chooses" });
      continue;
    }
    const strong = relevant.filter((x) => x.r === 1).length;
    const strongShare = strong / (f.grantees.length || 1);
    const cityHits = f.granteeCities.filter((c) => c.state === st && org.city && c.city.toLowerCase() === org.city.toLowerCase()).reduce((n, c) => n + c.count, 0);
    // Based in the organization's own area: its city, or a place named in its service area ("Rutherford" for Rutherfordton).
    const nearby = f.state === st && near.some((t) => f.city.toLowerCase().startsWith(t));
    // A funder that keeps most of its giving in its own city is a local funder somewhere else.
    // Its two most common grantee cities, when they hold most of its grants and neither is near the organization.
    const topTwo = [...f.granteeCities].sort((x, y) => y.count - x.count).slice(0, 2);
    const topShare = topTwo.reduce((n, c) => n + c.count, 0) / total;
    const topNear = topTwo.some((c) => near.some((t) => c.city.toLowerCase().startsWith(t)));
    const localElsewhere = !nearby && !cityHits && !topNear && topShare >= 0.6;
    const median = f.grantMedian ?? 0;
    const ratio = budget && median ? median / budget : null;
    let score = 38;
    if (localElsewhere) score -= 16;
    score += Math.round(16 * Math.min(1, strong / 2));
    score += Math.round(6 * Math.min(1, strongShare / 0.25));
    score += Math.round(6 * Math.min(1, (relevant.length - strong) / 2));
    score += primaryFocus ? 8 : 0;
    score += Math.round(12 * share);
    score += cityHits ? 5 : 0;
    score += nearby ? 8 : 0;
    if (ratio != null) score += ratio >= 0.005 && ratio <= 0.2 ? 5 : ratio > 0.5 ? -10 : 0;
    if (f.acceptsUnsolicited === true) score += 3;
    if (f.application?.howTo) score += 2;
    if (f.grantCount < 5) score -= 6;
    if (!strong) score = Math.min(score - 10, 55);
    if (score < 45) continue;
    score = Math.min(90, score);

    const reasons: string[] = [];
    const factIds: string[] = [];
    // The example grant: the most relevant one in the organization's state, and of an ordinary size.
    const example = [...relevant].sort((a, b) => b.r - a.r || Number(b.g.state === st) - Number(a.g.state === st) || Math.abs(a.g.amount - median) - Math.abs(b.g.amount - median))[0].g;
    reasons.push(`In ${f.taxYear} it gave ${money(example.amount)} to ${example.name}${example.city ? ` in ${example.city}` : ""}${purposePhrase(example.purpose)}.`);
    if (reachFact) factIds.push(reachFact.id);
    reasons.push(nearby ? `It is based in ${f.city}, inside your service area, and ${here} of its ${total} grants that year stayed in ${st}.` : `${here} of its ${total} grants that year went to organizations in ${st}${cityHits ? `, ${cityHits} of them in ${org.city}` : ""}.`);
    if (placeFact) factIds.push(placeFact.id);
    if (median && budget) {
      reasons.push(`Its typical grant of ${money(median)} is about ${Math.max(1, Math.round((median / budget) * 100))}% of your annual budget${ratio != null && ratio <= 0.2 ? ", a sensible size to ask for" : ""}.`);
      if (sizeFact) factIds.push(sizeFact.id);
    }
    const cautions: string[] = [`Based on its ${f.taxYear} filing with the IRS. Giving may have changed since.`];
    if (!strong && org.causes[0]) cautions.unshift(`None of its ${f.taxYear} grants were for ${org.causes[0].toLowerCase()} work like yours. The closest went to ${example.name}.`);
    if (localElsewhere) cautions.push(`Most of its grants stay in and around ${topTwo.map((c) => c.city).join(" and ")}. Ask whether it funds outside that area before you write.`);
    if (f.acceptsUnsolicited == null) cautions.push("The filing does not say whether it accepts unsolicited requests. Ask before you write.");
    if (!f.application?.howTo) cautions.push("The filing does not describe how to apply.");
    if (ratio != null && ratio > 0.5) cautions.push("Its typical grant is large next to your budget.");
    if (f.application?.restrictions) cautions.push(`Restrictions as filed: ${f.application.restrictions.length > 140 ? `${f.application.restrictions.slice(0, 138)}…` : f.application.restrictions}`);
    const eligibilityChecks: EligibilityCheck[] = [
      { label: f.acceptsUnsolicited ? "Accepts applications" : "Applications not ruled out", passed: f.acceptsUnsolicited === true, detail: f.acceptsUnsolicited ? "Its 990-PF describes how to apply and does not say it gives only to preselected organizations." : "The filing does not answer this. Contact the foundation first." },
      { label: `Gives in ${st}`, passed: here > 0, detail: `${here} grant${here === 1 ? "" : "s"} to ${st} organizations in tax year ${f.taxYear}.` },
    ];
    scored.push({ foundation: f, fitScore: score, reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 3), eligibilityChecks, factIds: [...new Set(factIds)] });
  }
  scored.sort((a, b) => b.fitScore - a.fitScore || (b.foundation.totalGiving ?? 0) - (a.foundation.totalGiving ?? 0));
  return { matches: scored.slice(0, input.limit ?? 6), screened: all.length, inState, closedToRequests: closed, setAside };
}

/** " for general operations", " to support the food pantry": the filed purpose, read as the end of a sentence. */
export function purposePhrase(purpose: string): string {
  const p = purpose.trim().replace(/\.$/, "");
  if (!p || /^(general|charitable|exempt) purposes?$/i.test(p)) return p ? ` for ${p.toLowerCase()}` : "";
  const lower = p.charAt(0).toLowerCase() + p.slice(1);
  return /^(to|for)\s/i.test(lower) ? ` ${lower.replace(/^for to /i, "to ")}` : ` for ${lower}`;
}

// ---------- Peers and funders like you ----------

export interface PeerOrg {
  name: string;
  city: string;
  state: string;
  /** Foundations that funded both this organization and work like yours. */
  sharedFunders: { funderId: string; name: string; amount: number; purpose: string; year: number }[];
  total: number;
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(inc|incorporated|the|of|corp|corporation)\b/g, "").replace(/\s+/g, " ").trim();

/**
 * Organizations funded by the same foundations, in the same state, for the
 * same kind of work: people to ask for advice, or to apply with.
 */
export function peerOrganizations(input: { org: Organization; funderIds: string[]; limit?: number }): PeerOrg[] {
  const st = stateCode(input.org.state);
  const tests = workOf(input.org).filter((w) => w.weight >= 0.6).map((w) => w.grant);
  const self = normName(input.org.name);
  const byName = new Map<string, PeerOrg>();
  for (const id of input.funderIds) {
    const f = foundationByFunderId(id);
    if (!f) continue;
    for (const g of f.grantees) {
      if (st && g.state !== st) continue;
      if (tests.length && !tests.some((re) => re.test(`${g.name} ${g.purpose}`))) continue;
      const key = normName(g.name);
      if (!key || key === self) continue;
      const p = byName.get(key) ?? { name: g.name, city: g.city, state: g.state, sharedFunders: [], total: 0 };
      if (!p.sharedFunders.some((s) => s.funderId === id)) p.sharedFunders.push({ funderId: id, name: f.name, amount: g.amount, purpose: g.purpose, year: f.taxYear });
      p.total += g.amount;
      byName.set(key, p);
    }
  }
  return [...byName.values()].sort((a, b) => b.sharedFunders.length - a.sharedFunders.length || b.total - a.total).slice(0, input.limit ?? 12);
}

/** Foundations that funded the organization's peers, which it has not matched yet. */
export function fundersLikeYou(input: { org: Organization; peers: PeerOrg[]; exclude: string[]; limit?: number }): { foundation: FoundationRecord; peers: string[] }[] {
  const peerKeys = new Set(input.peers.map((p) => normName(p.name)));
  const out: { foundation: FoundationRecord; peers: string[] }[] = [];
  for (const f of loaded().foundations) {
    if (input.exclude.includes(funderIdFor(f.ein))) continue;
    const hits = f.grantees.filter((g) => peerKeys.has(normName(g.name))).map((g) => g.name);
    if (hits.length) out.push({ foundation: f, peers: [...new Set(hits)] });
  }
  return out.sort((a, b) => b.peers.length - a.peers.length).slice(0, input.limit ?? 8);
}

// ---------- Ask amount ----------

/**
 * A suggested ask from the funder's own giving and the organization's size:
 * near the funder's typical grant, kept within what a budget this size can
 * absorb. Shown with its reasoning, never applied without the director.
 */
export function recommendAsk(input: { median: number | null; min: number | null; max: number | null; budget: number | null; past?: number | null }): { amount: number; low: number; high: number; why: string[] } | null {
  const { median, min, max, budget, past } = input;
  if (!median && !max) return null;
  const why: string[] = [];
  let base = median ?? (max ?? 0) / 2;
  why.push(median ? `Their typical grant is $${Math.round(median).toLocaleString("en-US")}.` : `Their largest award is $${Math.round(max ?? 0).toLocaleString("en-US")}.`);
  if (past) {
    base = Math.max(base, past * 1.1);
    why.push(`They gave you $${Math.round(past).toLocaleString("en-US")} before; a modest step up is normal for a returning grantee.`);
  }
  if (budget) {
    const cap = budget * 0.25;
    if (base > cap) {
      base = cap;
      why.push(`Kept under a quarter of your $${Math.round(budget).toLocaleString("en-US")} budget, so one grant does not become your whole year.`);
    } else why.push(`That is about ${Math.max(1, Math.round((base / budget) * 100))}% of your annual budget.`);
  }
  const round = (n: number) => (n >= 20_000 ? Math.round(n / 5_000) * 5_000 : Math.round(n / 1_000) * 1_000);
  const amount = Math.max(round(base), 1_000);
  const low = Math.max(round(Math.max(min ?? 0, amount * 0.7)), 1_000);
  const high = round(Math.min(max ?? amount * 1.4, amount * 1.4));
  return { amount, low: Math.min(low, amount), high: Math.max(high, amount), why };
}

// ---------- Scholarships for individuals ----------

const SCHOLARSHIP = /scholar|tuition|student aid|educational award|fellowship/i;

/**
 * Scholarship mode: foundations whose 990-PF shows scholarship giving, ranked
 * for one person by state, level, field, and hometown. Filings list the
 * schools or programs awards went through; the people who received them are
 * never stored or shown.
 */
export function matchScholarships(input: { state: string; level: "high_school" | "undergraduate" | "graduate" | "adult"; field: string; hometown: string; limit?: number; pool?: FoundationRecord[] }): import("@/lib/types").ScholarshipMatch[] {
  const st = stateCode(input.state);
  const field = input.field.trim().toLowerCase();
  const town = input.hometown.trim().toLowerCase();
  const out: (import("@/lib/types").ScholarshipMatch & { score: number })[] = [];
  for (const f of input.pool ?? loaded().foundations) {
    const awards = f.grantees.filter((g) => SCHOLARSHIP.test(`${g.name} ${g.purpose}`));
    const isFund = f.focus.includes("Scholarships") || /scholar/i.test(f.name);
    // A foundation that mostly funds organizations is not a scholarship source, even if one grant mentions tuition.
    const share = f.grantees.length ? awards.length / f.grantees.length : 0;
    if (!isFund && share < 0.3) continue;
    if (f.acceptsUnsolicited === false && !f.application) continue;
    const restrictions = (f.application?.restrictions ?? "").toLowerCase();
    const inState = f.state === st || f.granteeStates.some((s) => s.state === st);
    if (!inState) continue;
    let score = 40;
    const reasons: string[] = [];
    const cautions: string[] = [`From its ${f.taxYear} IRS filing. Ask the foundation for this year's guidelines.`];
    if (f.state === st) {
      score += 10;
      reasons.push(`Based in ${f.city}, ${f.state}.`);
    }
    if (town && (restrictions.includes(town) || f.city.toLowerCase() === town || f.granteeCities.some((c) => c.city.toLowerCase() === town))) {
      score += 20;
      reasons.push(`Its filing or past awards mention ${input.hometown.trim()}.`);
    }
    if (field && (restrictions.includes(field) || awards.some((g) => g.purpose.toLowerCase().includes(field)))) {
      score += 12;
      reasons.push(`Past awards or restrictions mention ${input.field.trim()}.`);
    }
    if (input.level === "high_school" && /high school|graduat(e|ing) senior|seniors/.test(restrictions)) {
      score += 12;
      reasons.push("Its restrictions name graduating high school students.");
    }
    if (input.level === "graduate" && /graduate|medical|law|doctoral/.test(restrictions)) score += 8;
    if (f.application?.howTo) score += 4;
    else cautions.push("The filing does not say how to apply.");
    score += Math.round(10 * Math.min(1, share));
    const median = awards.length ? [...awards].sort((x, y) => x.amount - y.amount)[Math.floor(awards.length / 2)].amount : f.grantMedian ?? 0;
    if (median > 25_000) {
      score -= 12;
      cautions.unshift("Its typical award is large, which usually means it goes to a school or program rather than a student. Ask how individuals apply.");
    }
    if (!isFund && share < 0.6) cautions.unshift("Much of its giving goes to organizations. Ask whether it takes applications from individual students.");
    // A fund limited to one county or town that is not the student's.
    const place = restrictions.match(/\b(?:resid\w*|live|living|lives)\b[^.]{0,40}?\b([a-z]+) county\b|\b([a-z]+) county\b[^.]{0,30}\b(?:resident|residents|students|graduates)\b/);
    const placeName = place?.[1] ?? place?.[2] ?? null;
    if (placeName && (!town || !restrictions.includes(town))) {
      score -= 22;
      cautions.unshift(`Its restrictions limit it to ${placeName.replace(/\b\w/g, (c) => c.toUpperCase())} County. Check that you qualify before applying.`);
    }
    if (/\bloans?\b/.test(`${f.name} ${restrictions}`.toLowerCase())) {
      score -= 12;
      cautions.unshift("It makes educational loans, which you repay, rather than scholarships.");
    }
    if (restrictions && !reasons.some((r) => r.includes("restrictions"))) cautions.push(`Restrictions as filed: ${f.application!.restrictions!.length > 150 ? `${f.application!.restrictions!.slice(0, 148)}…` : f.application!.restrictions}`);
    const total = awards.reduce((n, g) => n + g.amount, 0);
    const amounts = awards.map((g) => g.amount).sort((a, b) => a - b);
    if (!reasons.length) reasons.push(`Gave ${awards.length || "several"} scholarship award${awards.length === 1 ? "" : "s"} in tax year ${f.taxYear}.`);
    out.push({
      score,
      funderId: funderIdFor(f.ein),
      name: f.name,
      city: f.city,
      state: f.state,
      taxYear: f.taxYear,
      totalScholarships: total || (f.totalGiving ?? 0),
      awards: awards.length,
      typicalAward: amounts.length ? amounts[Math.floor(amounts.length / 2)] : f.grantMedian,
      pastRecipients: awards.slice(0, 6).map((g) => ({ name: g.name, city: g.city, state: g.state, amount: g.amount })),
      application: f.application,
      reasons,
      cautions: cautions.slice(0, 2),
      irsUrl: irsPageUrl(f),
    });
  }
  return out
    .sort((a, b) => b.score - a.score || b.totalScholarships - a.totalScholarships)
    .slice(0, input.limit ?? 12)
    .map(({ score, ...m }) => ({ ...m, fit: Math.max(30, Math.min(90, score)) }));
}
