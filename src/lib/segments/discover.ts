import * as gg from "@/lib/grantsgov";
import type { EligibilityCheck, FirmProfile, FundedAnalog, Funder, Opportunity, Organization, ResearchProfile } from "@/lib/types";
import { replayActive } from "@/lib/replay/active";
import { aiPolicyFor } from "@/lib/research/policies";
import { programsFrom } from "@/lib/research";
import { SEGMENT_SEARCHES } from "./searches";

/**
 * Discovery for firms (grants and incentives a for-profit firm can get) and
 * research teams (research funding), in plain rules over Grants.gov, which
 * is free and needs no key. Every reason quotes the notice or the profile.
 * Results come back as opportunities of the right kind, kept separate from
 * bids on screen.
 */
export interface SegmentMatch {
  opportunity: Opportunity;
  funder: Funder;
  noticeText: string;
  fitScore: number;
  reasons: string[];
  cautions: string[];
  eligibilityChecks: EligibilityCheck[];
}

export interface SegmentDiscovery {
  matches: SegmentMatch[];
  searched: { keyword: string; hits: number }[];
  read: number;
  dropped: { title: string; reason: string }[];
}

type Search = { keyword: string; fundingCategories: readonly string[] };

async function runSearches(searches: readonly Search[], eligibilities: string, perSearch: number, onEvent?: (e: { kind: "search" | "note" | "dropped"; text: string; detail?: string }) => void) {
  const ids: string[] = [];
  const searched: SegmentDiscovery["searched"] = [];
  for (const s of searches) {
    const { result, from } = await gg.search({ keyword: s.keyword, oppStatuses: "forecasted|posted", eligibilities, fundingCategories: s.fundingCategories.join("|"), rows: 25 });
    searched.push({ keyword: s.keyword, hits: result.hitCount });
    onEvent?.({ kind: "search", text: `Searched ${from === "database" ? "the opportunity database" : "Grants.gov"} for "${s.keyword}"`, detail: `${result.hitCount.toLocaleString("en-US")} notices` });
    for (const h of result.oppHits.slice(0, perSearch)) if (!ids.includes(String(h.id))) ids.push(String(h.id));
  }
  const details: gg.OpportunityDetail[] = [];
  for (const id of ids) {
    try {
      details.push((await gg.fetchOpportunity(id)).detail);
    } catch {
      // A notice the recorded run did not read, or one Grants.gov would not return: skip it rather than guess.
    }
  }
  return { searched, details };
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
const quoteAround = (text: string, re: RegExp, max = 160) => {
  const m = text.match(re);
  if (!m || m.index == null) return null;
  const start = Math.max(0, text.lastIndexOf(".", m.index) + 1);
  const end = text.indexOf(".", m.index + m[0].length);
  const s = text.slice(start, end > 0 ? end + 1 : undefined).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// ---------- Firms ----------

const FIRM_TOPICS: { re: RegExp; label: string }[] = [
  { re: /\benergy efficien|renewable energy|solar|weatheriz|building performance|decarboni|retrofit/i, label: "energy and building performance" },
  { re: /\bworkforce|apprentice|job training|training grant|on-the-job/i, label: "workforce training" },
  { re: /\bsmall business innovation|SBIR|STTR/i, label: "small business innovation research" },
  { re: /\bresilien|hazard mitigation|flood|infrastructure/i, label: "resilience and infrastructure" },
  { re: /\bhistoric preservation|historic/i, label: "historic preservation" },
];
const NOT_FOR_AEC = /\bclinical|translational|biomedical|cancer|drug|vaccine|alzheimer|mental health services|maternal|child health|agricultural producer|fishery|marine mammal|tribal|embassy|fellowship|dissertation|qubit|quantum|collaboratory|energy technologies|chemical technolog|social, behavioral|research access|mathematical|infrastructure program for (mathematical|research)/i;
/** Research programs fund science, not a design firm's services, unless they are SBIR or STTR. */
const RESEARCH_TITLE = /\b(research|science|scientific|institute|laboratory|discovery|fundamental)\b/i;

export async function firmGrants(input: { org: Organization; profile: FirmProfile | null; onEvent?: Parameters<typeof runSearches>[3]; today?: string }): Promise<SegmentDiscovery> {
  const plan = SEGMENT_SEARCHES.firm;
  const { searched, details } = await runSearches(plan.searches, plan.eligibilities, plan.detailsPerSearch, input.onEvent);
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const matches: SegmentMatch[] = [];
  const dropped: SegmentDiscovery["dropped"] = [];
  const firmWords = words([input.org.mission, ...(input.profile?.sectors ?? []), ...(input.profile?.naics.map((n) => n.label) ?? [])].join(" "));
  for (const d of details) {
    const text = gg.opportunityText(d, 6000);
    const n = gg.notice(d);
    const types = new Set((n?.applicantTypes ?? []).map((t) => t.id));
    if (!gg.isStillOpen(d, today)) {
      dropped.push({ title: d.opportunityTitle, reason: "it has closed" });
      continue;
    }
    if (types.size && !types.has(gg.ELIGIBILITY.smallBusiness) && !types.has(gg.ELIGIBILITY.forProfit) && !types.has(gg.ELIGIBILITY.unrestricted)) {
      dropped.push({ title: d.opportunityTitle, reason: "for-profit firms are not among the eligible applicants" });
      continue;
    }
    if (NOT_FOR_AEC.test(d.opportunityTitle)) {
      dropped.push({ title: d.opportunityTitle, reason: "it is for work an architecture and engineering firm does not do" });
      continue;
    }
    // Match on what the notice is about (title and description), not on assistance listing numbers or appendix lines.
    const about = `${d.opportunityTitle}\n${(gg.notice(d)?.synopsisDesc ?? gg.notice(d)?.forecastDesc ?? "").replace(/<[^>]+>/g, " ").slice(0, 4000)}`;
    const inTitle = FIRM_TOPICS.filter((t) => t.re.test(d.opportunityTitle));
    const topics = FIRM_TOPICS.filter((t) => t.re.test(about));
    if (RESEARCH_TITLE.test(d.opportunityTitle) && !/\b(SBIR|STTR|small business innovation)\b/i.test(d.opportunityTitle)) {
      dropped.push({ title: d.opportunityTitle, reason: "it is a research program, not one for a design or construction firm's work" });
      continue;
    }
    if (!inTitle.length && topics.length < 2) {
      dropped.push({ title: d.opportunityTitle, reason: "nothing in it matches building, energy, workforce, or innovation work" });
      continue;
    }
    const overlap = [...words(text)].filter((w) => firmWords.has(w)).length;
    let score = 45 + topics.length * 8 + Math.min(12, overlap * 2);
    const reasons: string[] = [];
    const cautions: string[] = [];
    const eligibleQuote = types.has(gg.ELIGIBILITY.smallBusiness) ? "Small businesses are among the eligible applicant types." : types.has(gg.ELIGIBILITY.forProfit) ? "For-profit organizations are among the eligible applicant types." : "Eligibility is unrestricted.";
    reasons.push(eligibleQuote);
    for (const t of topics.slice(0, 2)) {
      const q = quoteAround(about, t.re);
      if (q) reasons.push(`It funds ${t.label}: "${q}"`);
    }
    if (/\brural\b/i.test(n?.applicantEligibilityDesc ?? "") || /\brural (small )?business/i.test(text)) {
      score -= 15;
      cautions.push("Eligibility is limited to rural areas or rural businesses. Check whether your office or the project site qualifies.");
    }
    if (/\bagricultur/i.test(text)) cautions.push("Part of the eligibility is for agricultural producers.");
    if (d.docType === "forecast") cautions.push("Forecast only. Applications are not open yet.");
    if (/\b(SBIR|STTR)\b/i.test(d.opportunityTitle)) cautions.push("SBIR and STTR fund research and development of a new product or technology, not design services.");
    const { opportunity, funder } = gg.toOpportunity(d);
    matches.push({ opportunity: { ...opportunity, kind: "grant" }, funder, noticeText: text, fitScore: Math.max(30, Math.min(85, score)), reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 3), eligibilityChecks: [{ label: "For-profit firms may apply", passed: true, detail: eligibleQuote }] });
  }
  matches.sort((a, b) => b.fitScore - a.fitScore || b.opportunity.id.localeCompare(a.opportunity.id));
  // The same program is sometimes posted twice; keep the newest notice.
  const seen = new Set<string>();
  const unique = matches.filter((m) => (seen.has(m.opportunity.title.toLowerCase()) ? false : (seen.add(m.opportunity.title.toLowerCase()), true)));
  return { matches: unique.slice(0, 8), searched, read: details.length, dropped };
}

// ---------- Research teams ----------

const HIGHER_ED = new Set([gg.ELIGIBILITY.publicHigherEd, gg.ELIGIBILITY.privateHigherEd, gg.ELIGIBILITY.unrestricted, gg.ELIGIBILITY.others]);

export async function researchMatches(input: { org: Organization; profile: ResearchProfile | null; analogs: FundedAnalog[]; onEvent?: Parameters<typeof runSearches>[3]; today?: string }): Promise<SegmentDiscovery> {
  const plan = SEGMENT_SEARCHES.lab;
  const live = !replayActive() && (input.profile?.keywords.length ?? 0) > 0;
  const searches: Search[] = live ? input.profile!.keywords.slice(0, 4).map((k) => ({ keyword: k, fundingCategories: ["ST", "ENV", "NR", "HL"] })) : plan.searches.map((s) => ({ keyword: s.keyword, fundingCategories: [...s.fundingCategories] }));
  const { searched, details } = await runSearches(searches, plan.eligibilities, plan.detailsPerSearch, input.onEvent);
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const teamWords = words([input.org.mission, ...(input.profile?.keywords ?? []), ...(input.profile?.capabilities ?? []), ...(input.profile?.publications.map((p) => p.title) ?? [])].join(" "));
  const programs = programsFrom(input.analogs);
  const matches: SegmentMatch[] = [];
  const dropped: SegmentDiscovery["dropped"] = [];
  for (const d of details) {
    const text = gg.opportunityText(d, 6000);
    const n = gg.notice(d);
    const types = new Set((n?.applicantTypes ?? []).map((t) => t.id));
    if (!gg.isStillOpen(d, today)) {
      dropped.push({ title: d.opportunityTitle, reason: "it has closed" });
      continue;
    }
    if (types.size && ![...types].some((t) => HIGHER_ED.has(t as never))) {
      dropped.push({ title: d.opportunityTitle, reason: "universities are not among the eligible applicants" });
      continue;
    }
    if (/\btribes? only|for indian tribes|intertribal/i.test(d.opportunityTitle)) {
      dropped.push({ title: d.opportunityTitle, reason: "it is for tribes and tribal consortia" });
      continue;
    }
    const lower = text.toLowerCase();
    // The team's own search phrases count most; then the topic words in its keywords and capabilities.
    const phrases = (input.profile?.keywords ?? []).filter((k) => lower.includes(k.toLowerCase()));
    const topics = [...teamWords].filter((w) => w.length > 4 && new RegExp(`\\b${w}`).test(lower));
    const agencyText = `${n?.agencyName ?? ""} ${d.owningAgencyCode}`;
    const evidence = programs.find((p) => (p.source === "nsf" && /NSF|National Science Foundation/.test(agencyText)) || (p.source === "nih" && /NIH|HHS/.test(agencyText)));
    // A broad program at an agency that has funded several projects like this one is worth a look even if its text is general.
    if (!phrases.length && topics.length < 3 && !(evidence && evidence.count >= 2 && topics.length >= 1)) {
      dropped.push({ title: d.opportunityTitle, reason: "it shares too little with the team's research" });
      continue;
    }
    const reasons: string[] = [];
    const cautions: string[] = [];
    let score = 40 + Math.min(24, phrases.length * 12) + Math.min(16, topics.length * 2);
    const key = phrases[0] ?? topics.sort((x, y) => y.length - x.length)[0];
    const q = quoteAround(text, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    if (q) reasons.push(`It asks for work like yours: "${q}"`);
    const agency = agencyText;
    const prog = evidence;
    if (prog) {
      score += 8;
      reasons.push(`${prog.count} similar ${prog.source.toUpperCase()} project${prog.count === 1 ? " was" : "s were"} funded through ${prog.program}${prog.officers[0] ? `, managed by ${prog.officers[0]}` : ""}.`);
    }
    const ceiling = Number(n?.awardCeiling ?? 0);
    if (ceiling) reasons.push(`Awards up to $${Math.round(ceiling).toLocaleString("en-US")}.`);
    if (d.docType === "forecast") cautions.push("Forecast only. Applications are not open yet.");
    const only = quoteAround(gg.notice(d)?.applicantEligibilityDesc ?? "", /\bonly\b[^.]{0,120}\b(eligible|may apply)\b/i, 200);
    if (only) {
      cautions.unshift(`Eligibility: "${only}"`);
      score -= 8;
    }
    const policy = aiPolicyFor(agency);
    if (policy && policy.level !== "allowed") cautions.push(`${policy.agency} rules on AI: ${policy.whatToDo}`);
    if (/\bclinical trial/i.test(d.opportunityTitle)) cautions.push("A clinical research mechanism. Read the notice's scope before planning an environmental project for it.");
    const { opportunity, funder } = gg.toOpportunity(d);
    matches.push({ opportunity: { ...opportunity, kind: "research" }, funder: { ...funder, aiPolicy: policy ? `${policy.summary} ${policy.whatToDo}` : funder.aiPolicy }, noticeText: text, fitScore: Math.max(35, Math.min(88, score)), reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 3), eligibilityChecks: [{ label: "Universities may apply", passed: true, detail: types.size ? "Higher education is among the eligible applicant types." : "No applicant types listed; read the eligibility section." }] });
  }
  matches.sort((a, b) => b.fitScore - a.fitScore);
  return { matches: matches.slice(0, 8), searched, read: details.length, dropped };
}
