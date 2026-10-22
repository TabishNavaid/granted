import { SCHOLARSHIPS, type CuratedScholarship, type ScholarshipField, type ScholarshipLevel } from "../curated/scholarships";
import { deadline as toDeadline, trimSummary } from "../normalize";
import type { CauseCode, Connector, FunderInput, IngestContext, OpportunityInput, ResearchAreaCode, SourceDefinition } from "../types";

/**
 * Curated scholarships: well-known national scholarships and fellowships for students and individuals,
 * each verified by hand on the sponsor's official page (see src/lib/catalog/curated/scholarships.ts).
 * The data lives in the repo, so a run makes no requests; scripts/check-scholarships.ts re-checks the
 * pages each month.
 */
export const source: SourceDefinition = {
  id: "curated_scholarships",
  name: "Scholarships and fellowships, checked by hand",
  covers: "Well-known national scholarships and fellowships for U.S. students and individuals, each checked on the sponsor's official page.",
  homepage: "https://fundfellows.com/data",
  license: "Facts from each sponsor's official page; links only",
  attribution: "Source: each sponsor's official program page",
  kinds: ["scholarship"],
  region: "us",
  cadence: "Checked by hand each month",
  schedule: "0 12 * * 1",
  enabled: true,
  priority: 30,
  notes: "Federal notices already on Grants.gov and NSF solicitations are left to those connectors.",
};

export const LEVEL_LABELS: Record<ScholarshipLevel, string> = {
  middle_school: "Middle school",
  high_school: "High school",
  community_college: "Community college",
  undergraduate: "Undergraduate",
  graduate: "Graduate",
  postdoctoral: "Postdoctoral",
  early_career: "Early career",
  mid_career: "Mid career",
  any: "Any stage",
};

export const FIELD_LABELS: Record<ScholarshipField, string> = {
  any: "Any field",
  stem: "Science, technology, engineering, and math",
  biomedical: "Biomedical sciences",
  computing: "Computing",
  public_service: "Public service",
  international: "International study",
  languages: "Languages",
  arts: "Arts",
  humanities: "Humanities",
  education: "Education",
  law: "Law",
  environment: "Environment",
  entrepreneurship: "Entrepreneurship",
};

const FIELD_CAUSES: Partial<Record<ScholarshipField, CauseCode[]>> = {
  stem: ["science"],
  biomedical: ["health", "science"],
  computing: ["science"],
  public_service: ["community"],
  international: ["international"],
  languages: ["international"],
  arts: ["arts"],
  humanities: ["arts"],
  education: ["education"],
  law: ["justice"],
  environment: ["environment"],
};

const FIELD_AREAS: Partial<Record<ScholarshipField, ResearchAreaCode[]>> = {
  biomedical: ["biomedical"],
  computing: ["computing"],
  humanities: ["humanities"],
  environment: ["environment"],
};

export const funderKey = (s: CuratedScholarship) => `org:${s.sponsor.slug}`;

/**
 * Status from the entry's own dates: past deadline is closed; a window that has not opened yet is
 * forecasted; a future deadline (or an open, rolling, or no-deadline-but-open page) is open; no posted
 * deadline is forecasted.
 */
export function statusOf(s: CuratedScholarship, now = new Date()): "open" | "closed" | "forecasted" {
  const close = toDeadline(s.deadline);
  if (close && new Date(close).getTime() < now.getTime()) return "closed";
  if (s.opensAt && new Date(`${s.opensAt}T00:00:00-05:00`).getTime() > now.getTime()) return "forecasted";
  if (s.pendingOpen) return "forecasted";
  if (close) return "open";
  if (s.rolling || s.openNow) return "open";
  return "forecasted";
}

export const NOT_POSTED = "The next deadline is not posted yet";

function closeTextOf(s: CuratedScholarship, status: string): string {
  const parts: string[] = [];
  if (s.deadlineText) parts.push(s.deadlineText);
  else if (!s.deadline && !s.rolling) parts.push(NOT_POSTED);
  if (status === "forecasted" && s.opensText) parts.push(s.opensText);
  if (status !== "open" && s.nextCycleText) parts.push(s.nextCycleText);
  return parts.join(". ").replace(/\.\./g, ".");
}

export function toFunder(s: CuratedScholarship): FunderInput {
  return {
    key: funderKey(s),
    name: s.sponsor.name,
    kind: s.sponsor.kind,
    website: s.sponsor.website,
    country: "US",
    acceptsApplications: true,
    grantsToIndividuals: true,
    sourceUrl: s.url,
  };
}

export function toOpportunity(s: CuratedScholarship, now = new Date()): OpportunityInput {
  const status = statusOf(s, now);
  const levels = s.level.map((l) => LEVEL_LABELS[l]);
  const fields = s.field.map((f) => FIELD_LABELS[f]);
  const summary = [s.eligibility, s.amountText ? `Award: ${s.amountText}.` : null, `Who can apply: ${s.citizenship}`].filter(Boolean).join(" ");
  return {
    sourceId: s.slug,
    sourceUrl: s.url,
    canonicalKey: `scholarship:${s.slug}`,
    type: "scholarship",
    title: s.name,
    summary: trimSummary(summary),
    funderKey: funderKey(s),
    funderName: s.sponsor.name,
    status,
    openAt: s.opensAt ?? null,
    closeAt: toDeadline(s.deadline),
    closeText: closeTextOf(s, status) || null,
    rolling: Boolean(s.rolling),
    amountMax: s.amount,
    currency: "USD",
    eligibility: ["individual"],
    eligibilityText: `${s.citizenship} ${s.eligibility}`,
    causes: [...new Set(["education" as CauseCode, ...s.field.flatMap((f) => FIELD_CAUSES[f] ?? [])])],
    researchAreas: [...new Set(s.field.flatMap((f) => FIELD_AREAS[f] ?? []))],
    categories: [...levels, ...fields],
    extra: {
      level: s.level,
      field: s.field,
      amountText: s.amountText,
      citizenship: s.citizenship,
      lastChecked: s.lastChecked,
      sources: s.sources ?? [],
      ...(s.deadlineRule ? { deadlineFromYearlyRule: true } : {}),
    },
    license: source.license,
  };
}

export async function run(ctx: IngestContext, entries: CuratedScholarship[] = SCHOLARSHIPS, now = new Date()) {
  const seen = new Set<string>();
  const funders = new Map<string, FunderInput>();
  const rows: OpportunityInput[] = [];
  for (const s of entries) {
    if (ctx.done() || (ctx.limit !== null && rows.length >= ctx.limit)) break;
    try {
      if (seen.has(s.slug)) throw new Error(`duplicate slug ${s.slug}`);
      if (!/^https:\/\//.test(s.url)) throw new Error(`not an https link: ${s.url}`);
      seen.add(s.slug);
      const f = toFunder(s);
      if (!funders.has(f.key)) funders.set(f.key, f);
      rows.push(toOpportunity(s, now));
    } catch (err) {
      ctx.warn(`Skipped scholarship ${s.slug}`, err);
    }
  }
  const used = new Set(rows.map((r) => r.funderKey));
  await ctx.funders([...funders.values()].filter((f) => used.has(f.key)));
  await ctx.opportunities(rows);
  ctx.log(`${rows.length} scholarships from ${used.size} sponsors`);
}

export const curatedScholarships: Connector = {
  source,
  fullSnapshot: true,
  run: (ctx) => run(ctx),
};

export const connectors: Connector[] = [curatedScholarships];
