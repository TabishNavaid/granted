import type { Certification, FirmProfile, Personnel, PortfolioProject } from "@/lib/types";

/**
 * Choosing what to show: the firm's projects most like this solicitation,
 * and a person for each role it asks for. Plain code, so the choice is the
 * same every time and every pick comes with its reason.
 */

const STOP = new Set("the a an and or of for to in on at by with from as is are be will shall must this that these those any all each other such its their our your which who may can new project projects services service work provide including include within under over into than per both".split(" "));

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, "").replace(/(ies)$/, "y").replace(/(?<=[a-z]{3})s$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Words that say what kind of building or work this is. They count more than ordinary words. */
const TYPE_WORDS = /\b(fire station|police|public safety|clinic|hospital|medical|healthcare|school|k-12|classroom|university|laboratory|lab|library|courthouse|jail|detention|office|barracks|dormitor|housing|hangar|maintenance facility|warehouse|community center|recreation|aquatic|park|water|wastewater|treatment plant|bridge|road|transit|parking|historic|renovation|addition|new construction|roof|hvac|mechanical|electrical|plumbing|fire protection|elevator|accessibility|ada|energy|sustainab|leed|net zero|resilien|flood|levee|dam|airfield|runway|veterans|va\b|military|army|navy|air force|corps of engineers|federal|courthouse|post office)\w*/gi;

export interface ProjectPick {
  project: PortfolioProject;
  score: number;
  reasons: string[];
}

export function solicitationProfile(text: string, state: string | null) {
  const words = new Set(tokens(text));
  const types = [...new Set((text.match(TYPE_WORDS) ?? []).map((w) => w.toLowerCase()))];
  const yearsWindow = Number(text.match(/\bwithin the (?:last|past)\s+(\w+)\s+years\b/i)?.[1]?.replace(/^five$/i, "5").replace(/^ten$/i, "10").replace(/^seven$/i, "7").replace(/^three$/i, "3")) || null;
  const federal = /\b(federal|FAR\b|SF\s?330|SAM\.gov|U\.S\.|department of|corps of engineers|veterans affairs|GSA)\b/i.test(text);
  return { words, types, yearsWindow, federal, state };
}

export function pickProjects(projects: PortfolioProject[], sol: ReturnType<typeof solicitationProfile>, opts: { limit?: number; today?: string } = {}): ProjectPick[] {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const nowYear = Number(today.slice(0, 4));
  const picks = projects.map((p) => {
    const reasons: string[] = [];
    let score = 0;
    const text = `${p.name} ${p.projectType} ${p.sector} ${p.scope} ${p.services.join(" ")}`;
    const ptypes = [...new Set((text.match(TYPE_WORDS) ?? []).map((w) => w.toLowerCase()))];
    const sharedTypes = ptypes.filter((t) => sol.types.includes(t));
    if (sharedTypes.length) {
      score += 30 + Math.min(20, (sharedTypes.length - 1) * 8);
      reasons.push(`Same kind of work: ${sharedTypes.slice(0, 3).join(", ")}.`);
    }
    const shared = tokens(text).filter((w) => sol.words.has(w));
    const overlap = new Set(shared).size;
    score += Math.min(20, overlap * 2);
    const finished = p.completionDate ? Number(p.completionDate.slice(0, 4)) : p.status === "in_progress" ? nowYear : null;
    if (finished != null) {
      const age = nowYear - finished;
      if (sol.yearsWindow && age > sol.yearsWindow) {
        score -= 25;
        reasons.push(`Completed ${finished}, outside the ${sol.yearsWindow}-year window the solicitation sets.`);
      } else if (age <= 5) {
        score += 10;
        reasons.push(p.status === "in_progress" ? "Under way now." : `Completed ${finished}.`);
      }
    }
    if (sol.state && p.state === sol.state) {
      score += 8;
      reasons.push(`In ${p.state}, like this project.`);
    }
    if (sol.federal && p.clientType === "federal") {
      score += 10;
      reasons.push("A federal client.");
    }
    if (p.role === "prime") score += 4;
    if (p.reference) score += 2;
    return { project: p, score, reasons };
  });
  return picks.filter((x) => x.score > 15).sort((a, b) => b.score - a.score || (b.project.completionDate ?? "").localeCompare(a.project.completionDate ?? "")).slice(0, opts.limit ?? 5);
}

/** Roles a solicitation names, in the order it names them. */
const ROLE_PATTERNS: [RegExp, string][] = [
  [/\bproject manager\b/i, "Project manager"],
  [/\b(principal[- ]in[- ]charge|principal)\b/i, "Principal in charge"],
  [/\b(lead |project )?architect\b|architect of record/i, "Architect"],
  [/\bstructural engineer/i, "Structural engineer"],
  [/\bmechanical engineer/i, "Mechanical engineer"],
  [/\belectrical engineer/i, "Electrical engineer"],
  [/\bplumbing (engineer|designer)/i, "Plumbing engineer"],
  [/\bcivil engineer/i, "Civil engineer"],
  [/\bfire protection engineer/i, "Fire protection engineer"],
  [/\b(cost estimator|cost engineer)\b/i, "Cost estimator"],
  [/\bspecifications? writer\b/i, "Specifications writer"],
  [/\binterior designer\b/i, "Interior designer"],
  [/\blandscape architect\b/i, "Landscape architect"],
  [/\b(superintendent)\b/i, "Superintendent"],
  [/\b(safety (officer|manager)|site safety and health officer|SSHO)\b/i, "Safety manager"],
  [/\b(quality control (manager|officer)|QC manager)\b/i, "Quality control manager"],
  [/\bcommissioning (agent|authority|provider)\b/i, "Commissioning agent"],
  [/\b(geotechnical engineer)\b/i, "Geotechnical engineer"],
  [/\b(environmental (engineer|scientist))\b/i, "Environmental engineer"],
];

export function rolesIn(text: string): string[] {
  const found: { role: string; at: number }[] = [];
  for (const [re, role] of ROLE_PATTERNS) {
    const m = text.match(re);
    if (m && !found.some((f) => f.role === role)) found.push({ role, at: m.index ?? 0 });
  }
  // Architect also matches "landscape architect"; keep it only when it stands on its own.
  return found.sort((a, b) => a.at - b.at).map((f) => f.role);
}

export interface RoleAssignment {
  role: string;
  personnelId: string | null;
  why: string;
}

const roleWords = (r: string) => tokens(r).filter((w) => !["lead", "engineer", "manager"].includes(w) || r.split(" ").length === 1);

export function assignPeople(people: Personnel[], roles: string[], state: string | null): RoleAssignment[] {
  // When a solicitation names few roles, propose the team an A-E submission usually shows, from the disciplines on staff.
  const usual = ["Principal in charge", "Project manager", "Architect", "Mechanical engineer", "Electrical engineer", "Structural engineer", "Construction administrator"].filter((r) => people.some((p) => `${p.role} ${p.title} ${p.discipline}`.toLowerCase().includes(r.split(" ")[0].toLowerCase())));
  const want = roles.length >= 3 ? roles : [...roles, ...usual.filter((r) => !roles.includes(r))].slice(0, 7);
  const used = new Set<string>();
  const out: RoleAssignment[] = want.map((role) => ({ role, personnelId: null, why: "No one on staff matches this role. Add a person or a subconsultant." }));
  const licensedNote = (p: Personnel, role: string) => {
    const here = state ? p.registrations.some((r) => r.state === state) : false;
    return here ? `, licensed in ${state}` : state && /architect|engineer/i.test(role) ? `, not yet licensed in ${state}` : "";
  };
  // Pass 1: someone whose usual proposal role is exactly this one.
  for (const a of out) {
    const p = people.find((x) => !used.has(x.id) && x.role.toLowerCase() === a.role.toLowerCase());
    if (p) {
      used.add(p.id);
      a.personnelId = p.id;
      a.why = `${p.name}, ${p.title}${p.yearsTotal ? `, ${p.yearsTotal} years` : ""}${licensedNote(p, a.role)}.`;
    }
  }
  // Pass 2: the closest discipline. One person may carry two roles on a small team, as SF 330 Section E allows.
  for (const a of out.filter((x) => !x.personnelId)) {
    const scored = people
      .map((p) => {
        const hay = `${p.role} ${p.title} ${p.discipline}`.toLowerCase();
        let s = 0;
        if (hay.includes(a.role.toLowerCase())) s += 10;
        for (const w of roleWords(a.role)) if (hay.includes(w)) s += 3;
        if (used.has(p.id)) s -= 2;
        if (state && p.registrations.some((r) => r.state === state)) s += 1;
        return { p, s };
      })
      .filter((x) => x.s >= 3)
      .sort((x, y) => y.s - x.s || (y.p.yearsTotal ?? 0) - (x.p.yearsTotal ?? 0));
    const best = scored[0]?.p;
    if (!best) continue;
    const also = used.has(best.id) ? `; also ${out.find((x) => x.personnelId === best.id)?.role.toLowerCase()}` : "";
    used.add(best.id);
    a.personnelId = best.id;
    a.why = `${best.name}, ${best.title}${best.yearsTotal ? `, ${best.yearsTotal} years` : ""}${licensedNote(best, a.role)}${also}.`;
  }
  return out;
}

/** Does the firm hold the status this set-aside needs? */
export function holdsSetAside(setAside: string | null, certs: Certification[], profile: FirmProfile | null): { needed: string | null; held: boolean } {
  if (!setAside) return { needed: null, held: true };
  const kinds = new Set(certs.map((c) => c.kind));
  const s = setAside.toLowerCase();
  const need = /8\(a\)/.test(s) ? "8a" : /hubzone/.test(s) ? "hubzone" : /service-?disabled/.test(s) ? "sdvosb" : /economically disadvantaged women/.test(s) ? "edwosb" : /women/.test(s) ? "wosb" : /small business/.test(s) ? "small_business" : null;
  if (!need) return { needed: setAside, held: true };
  const held = kinds.has(need as Certification["kind"]) || (need === "small_business" && [...kinds].some((k) => ["small_business", "8a", "wosb", "edwosb", "sdvosb", "hubzone", "vosb"].includes(k))) || (need === "wosb" && kinds.has("edwosb"));
  void profile;
  return { needed: setAside, held };
}
