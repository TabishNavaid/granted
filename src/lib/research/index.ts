import type { FundedAnalog, ResearchProfile } from "@/lib/types";
import { replayActive } from "@/lib/replay/active";
import { isDemoMode } from "@/lib/env";

/**
 * Who funds work like this team's: funded projects from the NSF Awards API
 * and NIH RePORTER, both free and keyless. They are evidence for a match
 * (this program funded this kind of work, this officer manages it), not
 * opportunities in themselves. Live outside the demo; the demo replays a
 * capture for the sample lab.
 */

const mdy = (s: string | undefined) => (s && /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? `${s.slice(6)}-${s.slice(0, 2)}-${s.slice(3, 5)}` : null);
const fourYearsAgo = () => {
  const d = new Date(Date.now() - 4 * 365 * 86400_000);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

export async function nsfAwards(phrase: string): Promise<FundedAnalog[]> {
  const q = new URLSearchParams({ keyword: `"${phrase}"`, expDateStart: fourYearsAgo(), rpp: "25", offset: "1" });
  const res = await fetch(`https://api.nsf.gov/services/v1/awards.json?${q.toString()}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  const body = (await res.json()) as { response?: { award?: Record<string, string>[] } };
  return (body.response?.award ?? []).map((a) => ({ source: "nsf" as const, id: a.id, title: a.title, institution: a.awardeeName ?? "", state: a.awardeeStateCode ?? null, investigators: [`${a.piFirstName ?? ""} ${a.piLastName ?? ""}`.trim()].filter(Boolean), program: a.fundProgramName ?? null, programOfficer: a.poName ?? null, amount: a.estimatedTotalAmt ? Math.round(Number(a.estimatedTotalAmt)) : null, startDate: mdy(a.startDate), endDate: mdy(a.expDate), url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id}` }));
}

export async function nihProjects(phrases: string[]): Promise<FundedAnalog[]> {
  const year = new Date().getUTCFullYear();
  const body = { criteria: { fiscal_years: [year - 2, year - 1, year], advanced_text_search: { operator: "advanced", search_field: "projecttitle,terms,abstracttext", search_text: phrases.map((p) => `"${p}"`).join(" OR ") } }, include_fields: ["ApplId", "ProjectNum", "ProjectTitle", "Organization", "PrincipalInvestigators", "AgencyIcAdmin", "ActivityCode", "AwardAmount", "ProgramOfficers", "OpportunityNumber", "ProjectStartDate", "ProjectEndDate", "ProjectDetailUrl"], offset: 0, limit: 25, sort_field: "fiscal_year", sort_order: "desc" };
  const res = await fetch("https://api.reporter.nih.gov/v2/projects/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  type P = { appl_id: number; project_num: string; project_title: string; organization?: { org_name?: string; org_state?: string }; principal_investigators?: { first_name?: string; last_name?: string }[]; program_officers?: { first_name?: string; last_name?: string }[]; agency_ic_admin?: { abbreviation?: string }; activity_code?: string; award_amount?: number; opportunity_number?: string; project_start_date?: string; project_end_date?: string; project_detail_url?: string };
  const data = (await res.json()) as { results?: P[] };
  const seen = new Set<string>();
  const out: FundedAnalog[] = [];
  for (const p of data.results ?? []) {
    const core = p.project_num?.slice(1, 12) ?? String(p.appl_id);
    if (seen.has(core)) continue;
    seen.add(core);
    const name = (x: { first_name?: string; last_name?: string }) => `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    out.push({ source: "nih", id: p.project_num, title: p.project_title, institution: (p.organization?.org_name ?? "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), state: p.organization?.org_state ?? null, investigators: (p.principal_investigators ?? []).map(name), program: `${p.agency_ic_admin?.abbreviation ?? ""} ${p.activity_code ?? ""}`.trim() + (p.opportunity_number ? ` (${p.opportunity_number})` : ""), programOfficer: p.program_officers?.[0] ? name(p.program_officers[0]) : null, amount: p.award_amount ?? null, startDate: p.project_start_date?.slice(0, 10) ?? null, endDate: p.project_end_date?.slice(0, 10) ?? null, url: p.project_detail_url ?? `https://reporter.nih.gov/project-details/${p.appl_id}` });
  }
  return out;
}

export async function fundedAnalogs(profile: ResearchProfile | null): Promise<{ status: "live" | "recorded"; analogs: FundedAnalog[]; recordedOn: string | null }> {
  if (isDemoMode() && replayActive()) {
    const rec = (await import("@/lib/replay/recordings/lab.analogs.json")).default as unknown as { recordedAt: string; analogs: FundedAnalog[] };
    return { status: "recorded", analogs: rec.analogs, recordedOn: rec.recordedAt };
  }
  const phrases = (profile?.keywords ?? []).slice(0, 3);
  if (!phrases.length) return { status: "live", analogs: [], recordedOn: null };
  const [nsf, nih] = await Promise.all([Promise.all(phrases.map((p) => nsfAwards(p).catch(() => []))).then((x) => x.flat()), nihProjects(phrases).catch(() => [])]);
  const seen = new Set<string>();
  return { status: "live", analogs: [...nsf, ...nih].filter((a) => (seen.has(`${a.source}:${a.id}`) ? false : (seen.add(`${a.source}:${a.id}`), true))), recordedOn: null };
}

/** Programs that fund this kind of work most often, from the analogs, with the officers who manage them. */
export function programsFrom(analogs: FundedAnalog[]): { program: string; source: FundedAnalog["source"]; count: number; officers: string[]; total: number; inState: number }[] {
  const m = new Map<string, { program: string; source: FundedAnalog["source"]; count: number; officers: Set<string>; total: number; inState: number }>();
  for (const a of analogs) {
    for (const prog of (a.program ?? "").split(/,\s*(?=[A-Z])/).filter(Boolean)) {
      const k = `${a.source}:${prog}`;
      const row = m.get(k) ?? { program: prog, source: a.source, count: 0, officers: new Set<string>(), total: 0, inState: 0 };
      row.count++;
      if (a.programOfficer) row.officers.add(a.programOfficer);
      row.total += a.amount ?? 0;
      m.set(k, row);
    }
  }
  return [...m.values()].map((r) => ({ ...r, officers: [...r.officers] })).sort((x, y) => y.count - x.count || y.total - x.total);
}
