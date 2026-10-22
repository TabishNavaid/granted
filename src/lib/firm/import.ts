import type { ClientType, Personnel, PortfolioProject, ProjectRole } from "@/lib/types";

/**
 * Reading a firm's project list and staff list from a spreadsheet: a CSV or tab-separated export, a paste from
 * Excel, or an .xlsx read on the server (src/app/api/import/sheet). Column names vary by firm, so each field
 * accepts the common ways people label it. Nothing is invented: a cell we cannot read stays empty and the row
 * is listed with the reason, and the person checks the preview before anything is saved.
 */
export interface Table {
  headers: string[];
  rows: string[][];
}

export interface ImportIssue {
  row: number;
  message: string;
}

/** CSV or TSV text to a table. Handles quoted cells, doubled quotes, and line breaks inside quotes. */
export function parseTable(text: string): Table {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.slice(0, clean.indexOf("\n") >= 0 ? clean.indexOf("\n") : clean.length);
  const delim = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    out.push(row);
  }
  const nonEmpty = out.filter((r) => r.some((c) => c));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Find the column for a field from its common names. Exact names first, then names that start with one. */
function column(headers: string[], names: string[]): number {
  const hs = headers.map(norm);
  for (const n of names) {
    const i = hs.indexOf(n);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = hs.findIndex((h) => h.startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
}

const PROJECT_FIELDS = {
  name: ["project name", "project", "name", "title", "project title"],
  client: ["client", "owner", "client name", "agency", "owner client"],
  city: ["city", "location city", "town"],
  state: ["state", "st", "location state"],
  location: ["location", "project location", "city state", "address"],
  scope: ["scope", "description", "project description", "summary", "scope of work", "services provided"],
  sector: ["sector", "market", "market sector", "client type"],
  projectType: ["project type", "building type", "type", "facility type"],
  sizeSqft: ["size sf", "square feet", "sf", "sq ft", "gsf", "size", "area"],
  contractValue: ["fee", "contract value", "our fee", "contract amount", "firm fee", "design fee"],
  constructionCost: ["construction cost", "construction value", "cost", "project cost", "total cost", "budget"],
  startDate: ["start date", "start", "begin"],
  completionDate: ["completion date", "completed", "completion", "end date", "year completed", "year", "finish"],
  status: ["status"],
  role: ["role", "our role", "firm role"],
  deliveryMethod: ["delivery method", "delivery", "procurement method"],
  services: ["services", "disciplines", "services provided"],
  outcomes: ["outcomes", "awards", "results", "highlights"],
  referenceName: ["reference name", "reference", "client contact", "contact name", "reference contact"],
  referenceTitle: ["reference title", "contact title"],
  referenceOrg: ["reference organization", "reference org", "contact organization"],
  referencePhone: ["reference phone", "contact phone", "phone"],
  referenceEmail: ["reference email", "contact email", "email"],
  profileCode: ["sf 330 code", "sf330 code", "profile code", "experience code"],
} as const;

const PERSON_FIELDS = {
  name: ["name", "full name", "employee", "person", "staff name"],
  firstName: ["first name", "first"],
  lastName: ["last name", "last", "surname"],
  title: ["title", "job title", "position"],
  role: ["proposed role", "role", "project role"],
  discipline: ["discipline", "department", "practice area"],
  yearsTotal: ["years experience", "total years", "years total", "experience years", "experience", "yrs experience"],
  yearsWithFirm: ["years with firm", "years at firm", "firm years", "tenure"],
  education: ["education", "degree", "degrees"],
  registrations: ["registrations", "licenses", "license", "registration", "professional registration", "pe", "ra"],
  certifications: ["certifications", "certs", "credentials"],
  summary: ["summary", "bio", "biography", "experience summary"],
  office: ["office", "location", "branch"],
} as const;

function cellOf(row: string[], i: number): string {
  return i >= 0 ? (row[i] ?? "").trim() : "";
}

/** "$1,250,000", "1.25M", "1,250k" to a number; anything else to null. */
export function readMoney(s: string): number | null {
  const v = s.replace(/[$,\s]/g, "").toLowerCase();
  const m = v.match(/^(\d+(?:\.\d+)?)(k|m|mm|b)?$/);
  if (!m) return null;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" || m[2] === "mm" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  const n = Number(m[1]) * mult;
  return n > 0 ? Math.round(n) : null;
}

export function readInt(s: string): number | null {
  const m = s.replace(/[,\s]/g, "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

/** A year or a date to YYYY-MM-DD (a bare year becomes its last day, so "2024" still sorts as 2024). */
export function readDate(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = v.match(/^(19|20)\d{2}$/);
  if (m) return `${v}-12-31`;
  return null;
}

const list = (s: string) =>
  s
    .split(/[;\n|]|,(?=\s*[A-Z])/)
    .map((x) => x.trim())
    .filter(Boolean);

const STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI".split(" "));

function clientTypeOf(client: string, sector: string): ClientType {
  const t = `${client} ${sector}`.toLowerCase();
  if (/\b(school district|isd|usd|k-12|k12|elementary|high school)\b/.test(t)) return "k12";
  if (/\b(university|college|community college)\b/.test(t)) return "higher_ed";
  if (/\b(hospital|health|clinic|medical)\b/.test(t)) return "healthcare";
  if (/\b(department of|u\.?s\.? |army|navy|air force|veterans affairs|gsa|usace|federal|national park)\b/.test(t)) return "federal";
  if (/\b(state of|state department|dot\b|txdot|caltrans|state)\b/.test(t)) return "state";
  if (/\b(city of|county|town of|village of|municipal|authority|district)\b/.test(t)) return "municipal";
  if (/\b(foundation|nonprofit|non-profit|church|ymca)\b/.test(t)) return "nonprofit";
  return "private";
}

function roleOf(s: string): ProjectRole {
  const t = s.toLowerCase();
  if (/sub/.test(t)) return "subconsultant";
  if (/joint|jv/.test(t)) return "joint_venture";
  if (/cm\b|construction manager|cmar/.test(t)) return "construction_manager";
  if (/general contractor|\bgc\b|builder/.test(t)) return /design/.test(t) ? "design_builder" : "general_contractor";
  if (/design.?build/.test(t)) return "design_builder";
  return "prime";
}

export type ProjectDraft = Omit<PortfolioProject, "id" | "orgId">;
export type PersonDraft = Omit<Personnel, "id" | "orgId">;

export function mapProjects(t: Table, today = new Date(), sourceLabel = "Imported spreadsheet"): { items: ProjectDraft[]; issues: ImportIssue[]; columns: Record<string, string | null> } {
  const col = Object.fromEntries(Object.entries(PROJECT_FIELDS).map(([k, names]) => [k, column(t.headers, [...names])])) as Record<keyof typeof PROJECT_FIELDS, number>;
  const issues: ImportIssue[] = [];
  const items: ProjectDraft[] = [];
  if (col.name < 0) issues.push({ row: 0, message: "No column for the project name. Name one column \"Project name\"." });
  t.rows.forEach((r, i) => {
    const row = i + 2;
    const name = cellOf(r, col.name);
    if (!name) {
      if (r.some((c) => c)) issues.push({ row, message: "No project name, so this row was skipped." });
      return;
    }
    let city = cellOf(r, col.city);
    let state = cellOf(r, col.state).toUpperCase();
    const loc = cellOf(r, col.location);
    if ((!city || !state) && loc) {
      const m = loc.match(/^(.*?),\s*([A-Za-z]{2})\b/);
      if (m) {
        city ||= m[1].trim();
        state ||= m[2].toUpperCase();
      } else city ||= loc;
    }
    if (state && !STATES.has(state)) {
      issues.push({ row, message: `"${state}" is not a two-letter state code; left blank.` });
      state = "";
    }
    const completion = readDate(cellOf(r, col.completionDate));
    const statusCell = cellOf(r, col.status).toLowerCase();
    const status: ProjectDraft["status"] = /progress|ongoing|active|current/.test(statusCell) || (!statusCell && completion && new Date(completion) > today) ? "in_progress" : "completed";
    const refName = cellOf(r, col.referenceName);
    const client = cellOf(r, col.client);
    const sector = cellOf(r, col.sector);
    items.push({
      name,
      client,
      clientType: clientTypeOf(client, sector),
      city,
      state,
      scope: cellOf(r, col.scope),
      sector,
      projectType: cellOf(r, col.projectType),
      sizeSqft: readInt(cellOf(r, col.sizeSqft)),
      contractValue: readMoney(cellOf(r, col.contractValue)),
      constructionCost: readMoney(cellOf(r, col.constructionCost)),
      startDate: readDate(cellOf(r, col.startDate)),
      completionDate: completion,
      status,
      role: roleOf(cellOf(r, col.role)),
      deliveryMethod: cellOf(r, col.deliveryMethod) || null,
      services: list(cellOf(r, col.services)),
      outcomes: list(cellOf(r, col.outcomes)),
      reference: refName ? { name: refName, title: cellOf(r, col.referenceTitle), organization: cellOf(r, col.referenceOrg) || client, phone: cellOf(r, col.referencePhone) || null, email: cellOf(r, col.referenceEmail) || null } : null,
      photos: [],
      personnelIds: [],
      profileCode: cellOf(r, col.profileCode).toUpperCase() || null,
      source: { kind: "document", label: sourceLabel, url: null },
    });
    if (!cellOf(r, col.scope)) issues.push({ row, message: `"${name}" has no description; bids will ask you for one.` });
  });
  const columns = Object.fromEntries(Object.entries(col).map(([k, i]) => [k, i >= 0 ? t.headers[i] : null]));
  return { items, issues, columns };
}

/** "PE TX 123456; RA OK" to registrations. Numbers and states are kept only when written. */
export function readRegistrations(s: string): PersonDraft["registrations"] {
  return list(s).map((part) => {
    const state = part.match(/\b([A-Z]{2})\b(?![a-z])/g)?.find((x) => STATES.has(x)) ?? "";
    const number = part.match(/#?\s?([A-Z]{0,3}-?\d{3,})/)?.[1] ?? null;
    const license = part.replace(/#?\s?[A-Z]{0,3}-?\d{3,}/, "").replace(new RegExp(`\\b${state}\\b`), "").replace(/[(),:-]+/g, " ").replace(/\s+/g, " ").trim() || part;
    return { license, state, number, expires: null };
  });
}

export function mapPeople(t: Table): { items: PersonDraft[]; issues: ImportIssue[]; columns: Record<string, string | null> } {
  const col = Object.fromEntries(Object.entries(PERSON_FIELDS).map(([k, names]) => [k, column(t.headers, [...names])])) as Record<keyof typeof PERSON_FIELDS, number>;
  const issues: ImportIssue[] = [];
  const items: PersonDraft[] = [];
  if (col.name < 0 && (col.firstName < 0 || col.lastName < 0)) issues.push({ row: 0, message: "No column for names. Name one column \"Name\", or use \"First name\" and \"Last name\"." });
  t.rows.forEach((r, i) => {
    const row = i + 2;
    const name = cellOf(r, col.name) || [cellOf(r, col.firstName), cellOf(r, col.lastName)].filter(Boolean).join(" ");
    if (!name) {
      if (r.some((c) => c)) issues.push({ row, message: "No name, so this row was skipped." });
      return;
    }
    items.push({
      name,
      title: cellOf(r, col.title),
      role: cellOf(r, col.role) || cellOf(r, col.title),
      discipline: cellOf(r, col.discipline),
      yearsTotal: readInt(cellOf(r, col.yearsTotal)),
      yearsWithFirm: readInt(cellOf(r, col.yearsWithFirm)),
      education: list(cellOf(r, col.education)),
      registrations: readRegistrations(cellOf(r, col.registrations)),
      certifications: list(cellOf(r, col.certifications)),
      summary: cellOf(r, col.summary),
      projectIds: [],
      resumeDocumentId: null,
      office: cellOf(r, col.office) || null,
    });
  });
  const columns = Object.fromEntries(Object.entries(col).map(([k, i]) => [k, i >= 0 ? t.headers[i] : null]));
  return { items, issues, columns };
}
