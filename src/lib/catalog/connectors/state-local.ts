import { int, isoDate, money } from "../normalize";
import { uniq } from "../vocab";
import type { Attachment, Connector, FunderInput, OpportunityInput, SourceDefinition } from "../types";
import {
  aecCategories,
  aecFromUnspsc,
  bidBase,
  bidStatus,
  cleanText,
  CONSTRUCTION,
  endOfDay,
  localDepartment,
  localGovernment,
  noticeTypeFrom,
  placeholderDate,
  setAsideFrom,
  setAsideSentences,
  slug,
  stateAgency,
  zonedTimestamp,
  type MappedBid,
} from "./_bids";
import { socrataConnector, sodaDatasetPage, sodaRecordUrl, soqlTime, txt, type SocrataPortal, type SodaRow } from "./_socrata";

/**
 * State and local public bids (RFPs, IFBs, RFQs, highway lettings). Each portal below is one config entry
 * and becomes one connector. Only portals that publish open (not only awarded) solicitations in a documented,
 * reusable format are here; see docs/adding-a-procurement-source.md for how to add one, and the research notes
 * for the portals we checked and left out.
 */

const DAY = 86_400_000;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);
const ahead = (now: Date, days: number) => new Date(now.getTime() + days * DAY);

/** The calendar day of a timestamp in a zone ("2026-10-19T19:00:00Z" in Los Angeles is 2026-10-19). */
export function localDay(ts: string | null, timeZone: string): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function source(def: Omit<SourceDefinition, "kinds"> & { kinds?: SourceDefinition["kinds"] }): SourceDefinition {
  return { kinds: ["contract"], ...def };
}

// =====================================================================================================
// New York City: City Record Online (CROL), the city's official journal of procurement notices.
// =====================================================================================================

const NYC_TZ = "America/New_York";
const NYC_DATASET = { domain: "data.cityofnewyork.us", dataset: "dg92-zbpx" };
const NYC = localGovernment("NY", "New York City", "City of New York", "https://a856-cityrecord.nyc.gov/", { city: "New York", website: "https://www.nyc.gov" });

/** PINs are the city's solicitation numbers. Some notices carry placeholders ("N/A", cut-off words) instead. */
export function nycPin(row: SodaRow): string | null {
  const pin = txt(row, "pin").toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{4,}$/.test(pin) && /\d/.test(pin) ? pin : null;
}

const NYC_PREFIX = /^(bid extension|extension|correction|amendment|re-?advertisement|re-?bid|pql label|bid cancell?ation|cancell?ation)\s*:\s*/i;

type NycRow = SodaRow & { _notices?: { id: string; date: string | null; title: string }[] };

export const nycCityRecord: SocrataPortal<NycRow> = {
  kind: "socrata",
  ...NYC_DATASET,
  source: source({
    id: "state_ny_nyc_cityrecord",
    name: "NYC City Record Online",
    covers: "Open solicitations from every New York City agency as published in the City Record, including construction and design work from DDC, DEP, Parks, NYCHA, and Health + Hospitals.",
    homepage: "https://a856-cityrecord.nyc.gov/",
    docsUrl: "https://data.cityofnewyork.us/City-Government/City-Record-Online/dg92-zbpx",
    termsUrl: "https://www.nyc.gov/main/terms-of-use",
    license: "Public domain (NYC Open Data)",
    attribution: "Source: The City Record, NYC Department of Citywide Administrative Services, via NYC Open Data",
    region: "local",
    cadence: "Daily",
    schedule: "40 11 * * *",
    enabled: true,
    priority: 20,
    notes: "Procurement section, solicitation notices only. Award notices are skipped (they name vendors).",
  }),
  where: (now) =>
    `section_name='Procurement' AND type_of_notice_description='Solicitation' AND due_date > '${soqlTime(ago(now, 45))}' AND start_date > '${soqlTime(ago(now, 3 * 365))}'`,
  order: "start_date ASC, request_id ASC",
  groupKey: (row) => {
    const pin = nycPin(row);
    return pin ? `${txt(row, "agency_name")}|${pin}` : null;
  },
  combine: (rows) => ({ ...rows[rows.length - 1], _notices: rows.map((r) => ({ id: txt(r, "request_id"), date: isoDate(txt(r, "start_date")), title: cleanText(txt(r, "short_title")) })) }),
  map: (row, now) => {
    const requestId = txt(row, "request_id");
    const raw = cleanText(txt(row, "short_title"));
    if (!requestId || !raw) return null;
    const prefix = raw.match(NYC_PREFIX)?.[1] ?? "";
    const title = raw.replace(NYC_PREFIX, "").trim() || raw;
    const agency = cleanText(txt(row, "agency_name")) || "City of New York";
    const pin = nycPin(row);
    const due = txt(row, "due_date");
    const open = placeholderDate(due);
    const closeAt = open ? null : zonedTimestamp(due, NYC_TZ);
    const posted = isoDate(txt(row, "start_date"));
    const recent = !!posted && new Date(`${posted}T00:00:00Z`).getTime() > ago(now, 548).getTime();
    const method = txt(row, "selection_method_description");
    const category = txt(row, "category_description");
    const description = cleanText([txt(row, "additional_description_1"), txt(row, "additional_description_2"), txt(row, "additional_description_3")].filter(Boolean).join("\n"));
    const other = [txt(row, "other_info_1"), txt(row, "other_info_2"), txt(row, "other_info_3")].map((x) => cleanText(x)).filter((x) => x && !/^n\/?a$/i.test(x));
    const noticeType = noticeTypeFrom(method, title);
    const sourceUrl = `https://a856-cityrecord.nyc.gov/RequestDetail/${requestId}`;
    const docs: Attachment[] = txt(row, "document_links")
      .split(",")
      .map((u) => u.trim().replace(/&amp;/g, "&"))
      .filter((u) => /^https:\/\//.test(u))
      .map((url, i) => ({ name: `Notice document ${i + 1}`, url }));
    const notices = (row._notices ?? []).filter((n) => n.id !== requestId);
    const dept = localDepartment(NYC, agency, `${agency} (New York City)`, "https://a856-cityrecord.nyc.gov/", { city: "New York" });
    const opportunity: OpportunityInput = {
      ...bidBase(nycCityRecord.source),
      sourceId: pin ? `${slug(agency)}:${pin}` : requestId,
      sourceUrl,
      opportunityNumber: pin,
      noticeType,
      title,
      summary: description || other.join(" ") || null,
      funderKey: dept.key,
      funderName: dept.name,
      status: bidStatus({ closeAt, cancelled: /cancel/i.test(prefix), sourceSaysOpen: open && recent }, now),
      postedAt: posted,
      openAt: posted,
      closeAt,
      closeText: open ? (/extension/i.test(prefix) ? "Postponed until further notice" : "Open-ended; no fixed due date") : null,
      rolling: open && (noticeType === "request_for_qualifications" || /open[- ]ended/i.test(title)),
      amountMax: money(txt(row, "contract_amount")),
      categories: uniq([category, method, ...aecCategories({ text: `${title} ${category}`, construction: /^construction\/construction services$/i.test(category) })].filter(Boolean)),
      setAside: setAsideFrom(`${title} ${method} ${other.join(" ")} ${setAsideSentences(description)}`),
      place: { state: "NY", city: "New York", country: "US" },
      contact: txt(row, "contact_name") || txt(row, "email") ? { name: txt(row, "contact_name") || null, email: txt(row, "email") || null, phone: txt(row, "contact_phone") || null } : null,
      attachments: docs,
      amendments: [
        ...notices.slice(-10).map((n) => ({ number: n.id, date: n.date, summary: n.title, url: `https://a856-cityrecord.nyc.gov/RequestDetail/${n.id}` })),
        ...(prefix ? [{ number: requestId, date: posted, summary: prefix.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), url: sourceUrl }] : []),
      ],
      extra: { requestId, selectionMethod: method || undefined, timeZone: NYC_TZ, otherInfo: other.length ? other.join(" | ").slice(0, 600) : undefined },
    };
    return { opportunity, funder: dept, parentFunder: NYC };
  },
};

// =====================================================================================================
// Los Angeles: RAMP (Regional Alliance Marketplace for Procurement) open bid opportunities.
// =====================================================================================================

const LA_TZ = "America/Los_Angeles";
const LA = localGovernment("CA", "Los Angeles", "City of Los Angeles", "https://www.rampla.org", { city: "Los Angeles", website: "https://lacity.gov" });

export const laRamp: SocrataPortal = {
  kind: "socrata",
  domain: "data.lacity.org",
  dataset: "hf3r-utnq",
  source: source({
    id: "state_ca_la_ramp",
    name: "Los Angeles RAMP open bids",
    covers: "Open bids, proposals, and qualification requests from City of Los Angeles departments (Public Works, LADWP, Airports, Harbor) and other agencies posting on RAMP.",
    homepage: "https://www.rampla.org",
    docsUrl: "https://data.lacity.org/d/hf3r-utnq",
    termsUrl: "https://data.lacity.org/terms-of-use",
    license: "CC0 1.0 (public domain dedication)",
    attribution: "Source: City of Los Angeles, RAMP, via data.lacity.org",
    region: "local",
    cadence: "Daily (the dataset refreshes hourly)",
    schedule: "25 12 * * *",
    enabled: true,
    priority: 20,
    notes: "Close dates in this dataset are UTC.",
  }),
  where: (now) => `closedate > '${soqlTime(ago(now, 30))}' OR closedate IS NULL`,
  order: "rampid ASC",
  map: (row, now) => {
    const id = txt(row, "rampid");
    const raw = cleanText(txt(row, "title"));
    const sourceUrl = txt(row, "url");
    if (!id || !raw || !sourceUrl) return null;
    const cancelled = /\bcancel+ed\b/i.test(raw);
    const title = raw.replace(/^\*?\s*cancel+ed\s*\*?\s*[|:-]?\s*/i, "").trim() || raw;
    const department = cleanText(txt(row, "department")).replace(/\s+/g, " ") || "City of Los Angeles";
    const category = txt(row, "category");
    const type = txt(row, "type");
    const closeAt = zonedTimestamp(txt(row, "closedate"), "UTC");
    const stage = txt(row, "stagename");
    // RAMP is regional: LAUSD and the County post there too. They are their own governments, not city departments.
    const separate = /\blausd\b|school district|\bcounty\b/i.test(department);
    const funder = separate
      ? localGovernment("CA", department, department, "https://www.rampla.org")
      : localDepartment(LA, department, `${department} (City of Los Angeles)`, "https://www.rampla.org", { city: "Los Angeles" });
    const opportunity: OpportunityInput = {
      ...bidBase(laRamp.source),
      sourceId: id,
      sourceUrl,
      opportunityNumber: title.match(/\b(?:RFQ|RFP|IFB|RFB|BID)[\s/#-]*([A-Z]{0,4}-?\d{4,}[A-Z0-9-]*)/i)?.[1] ?? null,
      noticeType: noticeTypeFrom(type === "None" ? "" : type, title),
      title,
      funderKey: funder.key,
      funderName: funder.name,
      status: bidStatus({ closeAt, cancelled, sourceSaysOpen: /^(open|amended)$/i.test(stage) }, now),
      postedAt: localDay(zonedTimestamp(txt(row, "bidpost"), "UTC"), LA_TZ),
      openAt: localDay(zonedTimestamp(txt(row, "bidpost"), "UTC"), LA_TZ),
      closeAt,
      categories: uniq([category, type === "None" ? "" : type, ...aecCategories({ text: title, construction: category === "Construction" })].filter(Boolean)),
      setAside: setAsideFrom(title),
      place: separate ? { state: "CA", country: "US", text: department } : { state: "CA", city: "Los Angeles", country: "US" },
      extra: { rampStage: stage || undefined, timeZone: LA_TZ },
    };
    return { opportunity, funder, parentFunder: separate ? null : LA };
  },
};

// =====================================================================================================
// San Francisco: open bid opportunities from the citywide financial system (SF City Partner).
// =====================================================================================================

const SF_TZ = "America/Los_Angeles";
const SF = localGovernment("CA", "San Francisco", "City and County of San Francisco", "https://sfcitypartner.sfgov.org", { city: "San Francisco", website: "https://www.sf.gov" });

export const sfCityPartner: SocrataPortal = {
  kind: "socrata",
  domain: "data.sf.gov",
  dataset: "eshn-8t3a",
  source: source({
    id: "state_ca_sf_citypartner",
    name: "San Francisco open bids",
    covers: "Open bid events from San Francisco departments on SF City Partner, including Public Works, Recreation and Park, and Public Utilities construction packages.",
    homepage: "https://sfcitypartner.sfgov.org",
    docsUrl: "https://data.sf.gov/d/eshn-8t3a",
    termsUrl: "https://www.sf.gov/reports--april-2017--datasf-terms-use",
    license: "Open Data Commons PDDL 1.0",
    attribution: "Source: City and County of San Francisco, Controller's Office, via DataSF",
    region: "local",
    cadence: "Weekly at the source; checked daily",
    schedule: "35 12 * * *",
    enabled: true,
    priority: 20,
  }),
  where: (now) => `due_date > '${soqlTime(ago(now, 30))}' OR due_date IS NULL`,
  order: "event_id ASC",
  map: (row, now) => {
    const eventId = txt(row, "event_id");
    const raw = cleanText(txt(row, "title"));
    const sourceUrl = txt(row, "sfcitypartner_link");
    if (!eventId || !raw || !sourceUrl) return null;
    // Titles start with an internal/external flag and a department code: "EXT DPW | PW SAN BRUNO AVE PAVE RENOV".
    const title = raw.replace(/^(?:EXT|INT)\s+(?:[A-Z0-9]{2,6}\s+){0,2}\|\s*/i, "").trim() || raw;
    const department = cleanText(txt(row, "department")) || "City and County of San Francisco";
    const due = txt(row, "due_date");
    const open = placeholderDate(due);
    const closeAt = open ? null : zonedTimestamp(due, SF_TZ);
    const number = title.match(/\b([A-Z]{2,5}\d{2}-\d{3,5})\b/)?.[1] ?? null;
    const category = txt(row, "category");
    const type = txt(row, "type");
    const dept = localDepartment(SF, department, `${department} (San Francisco)`, "https://sfcitypartner.sfgov.org", { city: "San Francisco" });
    const opportunity: OpportunityInput = {
      ...bidBase(sfCityPartner.source),
      sourceId: eventId,
      sourceUrl,
      opportunityNumber: number,
      noticeType: noticeTypeFrom(type, title),
      title,
      funderKey: dept.key,
      funderName: dept.name,
      status: bidStatus({ closeAt, sourceSaysOpen: /^(open|amended)$/i.test(txt(row, "status")) }, now),
      postedAt: isoDate(txt(row, "open_date")),
      openAt: isoDate(txt(row, "open_date")),
      closeAt,
      closeText: open ? "Open-ended; no fixed due date" : null,
      rolling: open,
      // Recreation and Park numbers its construction contracts CONyy-nnnn.
      categories: uniq([category, type, ...aecCategories({ text: title, construction: /^CON\d/.test(number ?? "") })].filter(Boolean)),
      setAside: setAsideFrom(title),
      place: { state: "CA", city: "San Francisco", country: "US" },
      extra: { eventId, sourceStatus: txt(row, "status") || undefined, timeZone: SF_TZ },
    };
    return { opportunity, funder: dept, parentFunder: SF };
  },
};

// =====================================================================================================
// Texas: TxDOT highway lettings and the 12-month letting schedule (Project Information on data.texas.gov).
// =====================================================================================================

const TX_TZ = "America/Chicago";
const TXDOT_DATA = { domain: "data.texas.gov", dataset: "drau-zphx" };
const TXDOT = stateAgency("TX", "Texas Department of Transportation", "https://www.txdot.gov", { key: "state:TX:txdot", website: "https://www.txdot.gov", focus: ["transportation"] });
const TXDOT_LET_TYPES = ["Statewide Let", "Statewide Letting", "Statewide Let No Charge", "Local District Let", "Design Build"];

type TxRow = SodaRow & { _projects?: SodaRow[] };

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export const txdotLettings: SocrataPortal<TxRow> = {
  kind: "socrata",
  ...TXDOT_DATA,
  source: source({
    id: "state_tx_txdot_lettings",
    name: "TxDOT highway lettings",
    covers: "Texas Department of Transportation construction and maintenance contracts: those advertised for the next letting, and those scheduled to let in the coming twelve months.",
    homepage: "https://www.txdot.gov",
    docsUrl: "https://data.texas.gov/d/drau-zphx",
    termsUrl: "https://data.texas.gov/",
    license: "Public information (State of Texas open data)",
    attribution: "Source: Texas Department of Transportation, TxDOTCONNECT, via the Texas Open Data Portal",
    region: "state",
    cadence: "Daily (the dataset refreshes several times a day)",
    schedule: "50 12 * * *",
    enabled: true,
    priority: 20,
    notes: "One opportunity per controlling project (CCSJ), which is how TxDOT lets contracts. Projects not yet advertised are forecasted.",
  }),
  select:
    "controlling_project_id_ccsj,control_section_job_csj,project_name,project_description,short_description,type_of_work,project_classification,project_type,highway,county,city,district_division,bid_received_until_date_and,project_estimated_let_date,project_stage,project_status,letting_status_description,let_type_description,project_estimate_low_bid,dbe_goal_percent,contract_number,maximum_number_of_working,project_limits_from,project_limits_to,bidder_pre_qualification",
  where: (now) =>
    `let_type_description in (${TXDOT_LET_TYPES.map((t) => `'${t}'`).join(",")}) AND (bid_received_until_date_and > '${soqlTime(ago(now, 30))}' OR (bid_received_until_date_and IS NULL AND project_estimated_let_date between '${soqlTime(ago(now, 7))}' and '${soqlTime(ahead(now, 365))}'))`,
  order: "controlling_project_id_ccsj ASC, control_section_job_csj ASC",
  pageSize: 2000,
  groupKey: (row) => txt(row, "controlling_project_id_ccsj") || txt(row, "control_section_job_csj") || null,
  combine: (rows) => {
    const ccsj = txt(rows[0], "controlling_project_id_ccsj");
    const lead = rows.find((r) => txt(r, "control_section_job_csj") === ccsj) ?? rows[0];
    return { ...lead, _projects: rows };
  },
  map: (row, now) => {
    const ccsj = txt(row, "controlling_project_id_ccsj") || txt(row, "control_section_job_csj");
    // Projects not let to contractors by TxDOT (local lets, value-only rows) are not bid opportunities.
    if (!ccsj || !TXDOT_LET_TYPES.includes(txt(row, "let_type_description"))) return null;
    const projects = row._projects ?? [row];
    const name = cleanText(txt(row, "project_name"));
    const work = cleanText(txt(row, "type_of_work") || txt(row, "short_description"));
    const highway = txt(row, "highway");
    const county = titleCase(txt(row, "county"));
    // Some names are internal file codes ("2026_ELP_SH0020_0002-04-039"); describe the work instead.
    const title = name && !/_/.test(name) ? name : [work ? titleCase(work) : "Highway project", highway && `on ${highway}`, county && `in ${county} County`].filter(Boolean).join(" ");
    const closeAt = zonedTimestamp(txt(row, "bid_received_until_date_and"), TX_TZ);
    const stage = txt(row, "project_stage");
    const advertised = stage === "Letting" || /before\/during letting/i.test(txt(row, "letting_status_description"));
    const est = isoDate(txt(row, "project_estimated_let_date"));
    const status = bidStatus({ closeAt, forecast: !advertised }, now);
    const live = status === "open" || status === "forecasted";
    const estimate = projects.reduce((sum, p) => sum + (money(txt(p, "project_estimate_low_bid")) ?? 0), 0);
    const dbe = Math.max(0, ...projects.map((p) => Number(txt(p, "dbe_goal_percent")) || 0));
    const counties = uniq(projects.map((p) => titleCase(txt(p, "county"))).filter(Boolean));
    const city = txt(row, "city");
    const from = cleanText(txt(row, "project_limits_from"));
    const to = cleanText(txt(row, "project_limits_to"));
    const days = int(txt(row, "maximum_number_of_working"));
    const summary = [
      cleanText(txt(row, "project_description")) || work,
      highway && (from || to) ? `${highway} from ${from || "?"} to ${to || "?"}.` : highway ? `${highway}.` : "",
      counties.length ? `${counties.join(", ")} County${counties.length > 1 ? "s" : ""}, ${txt(row, "district_division")} District.` : "",
      projects.length > 1 ? `${projects.length} projects let together under this contract.` : "",
      days ? `Up to ${days} working days.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const opportunity: OpportunityInput = {
      ...bidBase(txdotLettings.source),
      sourceId: ccsj,
      sourceUrl: sodaRecordUrl(TXDOT_DATA.domain, TXDOT_DATA.dataset, "controlling_project_id_ccsj", ccsj),
      opportunityNumber: ccsj,
      noticeType: advertised ? "letting" : "forecast",
      title,
      summary,
      funderKey: TXDOT.key,
      funderName: TXDOT.name,
      agencyCode: "TXDOT",
      status,
      openAt: !advertised ? est : null,
      closeAt,
      keyDates: est ? [{ kind: "letting", date: est, label: advertised ? "Letting" : "Estimated letting" }] : [],
      // After a letting this column holds the low bid; we keep amounts only while the contract is still ahead.
      amountTotal: live && estimate > 0 ? Math.round(estimate * 100) / 100 : null,
      categories: uniq([CONSTRUCTION, "Transportation", cleanText(txt(row, "project_classification")), work ? titleCase(work) : ""].filter(Boolean)),
      setAside: dbe > 0 ? `DBE goal ${dbe}%` : null,
      place: { state: "TX", city: city && city !== "NA" ? city : null, country: "US", text: counties.length ? `${counties.join(", ")} County, Texas` : null },
      extra: {
        csjs: projects.map((p) => txt(p, "control_section_job_csj")).filter(Boolean),
        contractNumber: txt(row, "contract_number") || undefined,
        district: txt(row, "district_division") || undefined,
        letType: txt(row, "let_type_description") || undefined,
        stage: stage || undefined,
        timeZone: TX_TZ,
      },
    };
    return { opportunity, funder: TXDOT };
  },
};

// =====================================================================================================
// Delaware: open bids posted on Delaware Bids (mmp.delaware.gov), state agencies and school districts.
// =====================================================================================================

const DE_TZ = "America/New_York";

export const delawareBids: SocrataPortal = {
  kind: "socrata",
  domain: "data.delaware.gov",
  dataset: "2hnj-zwix",
  source: source({
    id: "state_de_mmp_bids",
    name: "Delaware open bids",
    covers: "Open bids posted by Delaware state agencies, school districts, and colleges on the Delaware Bids marketplace.",
    homepage: "https://mmp.delaware.gov/Bids",
    docsUrl: "https://data.delaware.gov/d/2hnj-zwix",
    termsUrl: "http://opendatacouncil.delaware.gov/open-data-portal-terms-of-service/",
    license: "Public information (Delaware Open Data Portal)",
    attribution: "Source: Delaware Office of Management and Budget, Government Support Services, via data.delaware.gov",
    region: "state",
    cadence: "Weekly at the source; checked daily",
    schedule: "5 13 * * *",
    enabled: true,
    priority: 20,
    notes: "The dataset gives the due day only; we set the close to the end of that day, Eastern time.",
  }),
  where: (now) => `deadlinedate > '${soqlTime(ago(now, 30))}' OR deadlinedate IS NULL`,
  order: "contractnumber ASC",
  map: (row, now) => {
    const number = txt(row, "contractnumber");
    const title = cleanText(txt(row, "contracttitle"));
    const sourceUrl = txt(row, "bidurl");
    if (!number || !title || !sourceUrl) return null;
    const code = txt(row, "agencycode").toUpperCase() || "DE";
    const unspsc = txt(row, "unspsc").split(/[;,]/).map((c) => c.trim()).filter((c) => /^\d{2,8}$/.test(c));
    const closeAt = endOfDay(txt(row, "deadlinedate"), DE_TZ);
    // Agency codes only; the dataset carries no names, so the buyer is named by its code.
    const funder = stateAgency("DE", `State of Delaware buyer ${code}`, "https://mmp.delaware.gov/Bids", { key: `state:DE:${slug(code)}` });
    const opportunity: OpportunityInput = {
      ...bidBase(delawareBids.source),
      sourceId: number,
      sourceUrl,
      opportunityNumber: number,
      noticeType: noticeTypeFrom(title),
      title,
      funderKey: funder.key,
      funderName: funder.name,
      agencyCode: code,
      status: bidStatus({ closeAt, sourceSaysOpen: true }, now),
      postedAt: isoDate(txt(row, "opendate")),
      openAt: isoDate(txt(row, "opendate")),
      closeAt,
      closeText: closeAt ? "Due date only; the notice gives the time" : null,
      categories: uniq([...unspsc.map((c) => `UNSPSC ${c}`), ...aecFromUnspsc(unspsc), ...aecCategories({ text: title })]),
      setAside: setAsideFrom(title),
      place: { state: "DE", country: "US" },
      extra: { unspsc, timeZone: DE_TZ },
    };
    return { opportunity, funder };
  },
};

// =====================================================================================================
// Montgomery County, Maryland: Office of Procurement solicitations.
// =====================================================================================================

const MD_TZ = "America/New_York";
const MOCO = localGovernment("MD", "Montgomery County", "Montgomery County, Maryland", "https://www.montgomerycountymd.gov/PRO/", { website: "https://www.montgomerycountymd.gov" });

export const montgomeryBids: SocrataPortal = {
  kind: "socrata",
  domain: "data.montgomerycountymd.gov",
  dataset: "eeq6-nnwe",
  source: source({
    id: "state_md_montgomery_bids",
    name: "Montgomery County, MD solicitations",
    covers: "Active invitations for bids, requests for proposals, and informal solicitations from the Montgomery County, Maryland Office of Procurement, with construction and local small business reserve flags.",
    homepage: "https://www.montgomerycountymd.gov/PRO/",
    docsUrl: "https://data.montgomerycountymd.gov/d/eeq6-nnwe",
    termsUrl: "https://opendatapolicyhub.sunlightfoundation.com/collection/montgomery-county-md-2012-12-17/",
    license: "Public information (Montgomery County Open Data Act, no restriction on use)",
    attribution: "Source: Montgomery County, Maryland, Office of Procurement, via dataMontgomery",
    region: "local",
    cadence: "Daily",
    schedule: "15 13 * * *",
    enabled: true,
    priority: 20,
    notes: "Closing dates carry no time; we set the close to the end of that day, Eastern time.",
  }),
  where: (now) => `status='Active' OR closingdate > '${soqlTime(ago(now, 30))}'`,
  order: "number ASC",
  map: (row, now) => {
    const number = txt(row, "number");
    const title = cleanText(txt(row, "description"));
    if (!number || !title) return null;
    const department = cleanText(txt(row, "department")) || "Office of Procurement";
    const closeAt = endOfDay(txt(row, "closingdate"), MD_TZ);
    const status = txt(row, "status");
    const dept = localDepartment(MOCO, department, `${department} (Montgomery County, MD)`, "https://www.montgomerycountymd.gov/PRO/");
    const buyer = txt(row, "buyer").replace(/\s*\(inactive buyer\)\s*/i, "").trim();
    const type = txt(row, "type");
    const opportunity: OpportunityInput = {
      ...bidBase(montgomeryBids.source),
      sourceId: number,
      sourceUrl: `https://apps.montgomerycountymd.gov/prosolicitation/BidTabDetail.aspx?type=bidtab&solnumber=${encodeURIComponent(number)}`,
      opportunityNumber: number,
      noticeType: noticeTypeFrom(type === "Informal" ? "" : type, title),
      title,
      funderKey: dept.key,
      funderName: dept.name,
      status: bidStatus({ closeAt, cancelled: !!txt(row, "cancelledpostponed"), sourceSaysOpen: status === "Active", sourceSaysClosed: status === "Closed" }, now),
      postedAt: isoDate(txt(row, "issuancedate")),
      openAt: isoDate(txt(row, "issuancedate")),
      closeAt,
      closeText: txt(row, "cancelledpostponed") ? cleanText(txt(row, "cancelledpostponed")) : closeAt ? "Due date only; the notice gives the time" : null,
      categories: uniq([type, ...aecCategories({ text: title, construction: txt(row, "construction") === "Y" })].filter(Boolean)),
      setAside: setAsideFrom(title, txt(row, "lsbrpindicator") === "Y" ? ["Local Small Business Reserve Program"] : []),
      place: { state: "MD", country: "US", text: "Montgomery County, Maryland" },
      contact: buyer ? { name: buyer, title: "Buyer" } : null,
      extra: { departmentContact: txt(row, "deptcontact") || undefined, timeZone: MD_TZ },
    };
    return { opportunity, funder: dept, parentFunder: MOCO };
  },
};

// =====================================================================================================
// Illinois: Capital Development Board construction solicitations expected soon (a forecast list).
// =====================================================================================================

const IL_DATA = { domain: "data.illinois.gov", dataset: "6rb8-ntpm" };
const IL_CDB = stateAgency("IL", "Illinois Capital Development Board", "https://cdb.illinois.gov", { key: "state:IL:capital-development-board", website: "https://cdb.illinois.gov" });

/** "Lake Murphysboro State Park - Murphysboro, Jackson County - Jackson" to "Murphysboro". */
export function cdbCity(location: string): string | null {
  const m = location.match(/ - ([^,]+), [^,]+ County\b/);
  return m ? m[1].trim() : null;
}

export const ilCdbFuture: SocrataPortal = {
  kind: "socrata",
  ...IL_DATA,
  source: source({
    id: "state_il_cdb_future",
    name: "Illinois CDB upcoming construction bids",
    covers: "State construction projects the Illinois Capital Development Board expects to put out to bid soon, with estimated bid dates and cost ranges.",
    homepage: "https://cdb.illinois.gov",
    docsUrl: "https://data.illinois.gov/d/6rb8-ntpm",
    termsUrl: "https://data.illinois.gov/",
    license: "Public information (Illinois Open Data Portal)",
    attribution: "Source: Illinois Capital Development Board, via data.illinois.gov",
    region: "state",
    cadence: "Weekly",
    schedule: "0 13 * * 1",
    enabled: true,
    priority: 20,
    notes: "A forecast list: every row is forecasted until it leaves the list. The architect or engineer of record is not stored.",
  }),
  where: () => "project_number IS NOT NULL",
  order: "project_number ASC",
  map: (row, now) => {
    const number = txt(row, "project_number");
    const title = cleanText(txt(row, "description"));
    if (!number || !title) return null;
    const location = cleanText(txt(row, "location_name"));
    const est = isoDate(txt(row, "estimated_bid_date"));
    const cost = txt(row, "approximate_cost");
    const opportunity: OpportunityInput = {
      ...bidBase(ilCdbFuture.source),
      sourceId: number,
      sourceUrl: sodaRecordUrl(IL_DATA.domain, IL_DATA.dataset, "project_number", number),
      opportunityNumber: number,
      noticeType: "forecast",
      title,
      summary: [title, location, cost ? `Approximate cost: ${cost}.` : ""].filter(Boolean).join(". ").replace(/\.\./g, "."),
      funderKey: IL_CDB.key,
      funderName: IL_CDB.name,
      status: bidStatus({ closeAt: null, forecast: true }, now),
      openAt: est,
      keyDates: est ? [{ kind: "estimated_post", date: est, label: "Expected bid date" }] : [],
      amountMax: /less than|under|up to/i.test(cost) ? money(cost.replace(/^[^$\d]*/, "")) : null,
      categories: uniq([CONSTRUCTION, ...aecCategories({ text: title })]),
      place: { state: "IL", city: cdbCity(location), country: "US", text: location || null },
      contact: txt(row, "project_manager") ? { name: txt(row, "project_manager"), title: "CDB project manager" } : null,
      extra: { approximateCost: cost || undefined, datasetPage: sodaDatasetPage(IL_DATA.domain, IL_DATA.dataset) },
    };
    return { opportunity, funder: IL_CDB };
  },
};

// =====================================================================================================

/** Every portal config. Add a portal by adding one entry (see docs/adding-a-procurement-source.md). */
export const portals = [nycCityRecord, laRamp, sfCityPartner, txdotLettings, delawareBids, montgomeryBids, ilCdbFuture] as SocrataPortal<SodaRow>[];

export const connectors: Connector[] = portals.map((p) => socrataConnector(p));

export type { FunderInput, MappedBid };
