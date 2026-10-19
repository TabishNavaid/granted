import type { Application, Boilerplate, Certification, Fact, FirmProfile, Funder, Member, Milestone, Opportunity, Organization, Outcome, Personnel, PortfolioProject } from "@/lib/types";
import { CURRENT_USER_ID } from "./data";

/**
 * Cibolo Line Architecture + Engineering: a fictional service-disabled
 * veteran-owned A-E firm in San Antonio. Every person, client, and project
 * here is made up; no real firm or owner is described. Dates are relative to
 * the seed day (2026-10-18) and slide forward with the rest of the demo.
 */
export const FIRM_ORG_ID = "org_cibolo_line";
const at = "2026-10-18T09:00:00.000Z";

export const firmOrg: Organization = {
  id: FIRM_ORG_ID,
  orgType: "firm",
  name: "Cibolo Line Architecture + Engineering",
  ein: "",
  websiteUrl: "https://cibololine.com",
  mission: "Architecture and building engineering for public owners in Texas: clinics, public safety buildings, schools, and the systems that keep them running.",
  annualBudget: null,
  fiscalYearEnd: "December 31",
  foundedYear: 2011,
  city: "San Antonio",
  state: "TX",
  serviceArea: "Texas, Oklahoma, and New Mexico",
  causes: [],
  populations: [],
  staffCount: 12,
  volunteerCount: null,
  onboardingStep: "done",
  calendarToken: "demo-calendar-cibolo-line",
  createdAt: "2025-04-02T15:00:00.000Z",
};

export const firmMembers: Member[] = [
  { id: CURRENT_USER_ID, orgId: FIRM_ORG_ID, fullName: "Marisol Vega", email: "marisol@cibololine.com", role: "owner", status: "active" },
  { id: "user_okonkwo", orgId: FIRM_ORG_ID, fullName: "Daniel Okonkwo", email: "daniel@cibololine.com", role: "editor", status: "active" },
  { id: "user_raman", orgId: FIRM_ORG_ID, fullName: "Priya Raman", email: "priya@cibololine.com", role: "editor", status: "active" },
];

export const firmProfile: FirmProfile = {
  orgId: FIRM_ORG_ID,
  disciplines: ["architecture", "engineering"],
  naics: [
    { code: "541310", label: "Architectural Services", primary: true },
    { code: "541330", label: "Engineering Services", primary: false },
    { code: "541350", label: "Building Inspection Services", primary: false },
  ],
  sectors: ["Healthcare", "Federal", "Public safety", "K-12 education", "Historic preservation", "Energy and building systems"],
  states: ["TX", "OK", "NM"],
  uei: "CLN7Q2M4K9A1",
  cageCode: "8JK52",
  samRegistrationExpires: "2027-05-14",
  bonding: null,
  insurance: [
    { kind: "Professional liability", perOccurrence: 2_000_000, aggregate: 4_000_000, carrier: "Lonestar Mutual Design Professionals", expires: "2027-03-31" },
    { kind: "Commercial general liability", perOccurrence: 1_000_000, aggregate: 2_000_000, carrier: "Lonestar Mutual Design Professionals", expires: "2027-03-31" },
    { kind: "Workers' compensation", perOccurrence: null, aggregate: null, carrier: "Texas statutory coverage", expires: "2027-03-31" },
  ],
  safety: { emr: 0.78, emrYear: 2025, trir: 0, dart: 0, fatalitiesFiveYears: 0, programNote: "Construction-phase site visits follow the firm's written safety plan." },
  employeesByDiscipline: [
    { discipline: "Architects", code: "06", count: 3 },
    { discipline: "Mechanical engineers", code: "42", count: 2 },
    { discipline: "Electrical engineers", code: "21", count: 1 },
    { discipline: "Structural engineers", code: "57", count: 1 },
    { discipline: "CADD technicians", code: "08", count: 2 },
    { discipline: "Cost estimator", code: "16", count: 1 },
    { discipline: "Construction inspector", code: "15", count: 1 },
    { discipline: "Administrative", code: "02", count: 1 },
  ],
  averageAnnualRevenue: { federal: "3 ($250,000 to less than $500,000)", nonFederal: "5 ($1 million to less than $2 million)", total: "6 ($2 million to less than $5 million)" },
  rates: [
    { role: "Principal in charge", rate: 215 },
    { role: "Project manager", rate: 175 },
    { role: "Architect", rate: 150 },
    { role: "Structural engineer", rate: 165 },
    { role: "Mechanical engineer", rate: 160 },
    { role: "Electrical engineer", rate: 160 },
    { role: "Specifications writer", rate: 120 },
    { role: "Cost estimator", rate: 130 },
  ],
  activeBidCapacity: 3,
  updatedAt: at,
};

const src = { kind: "entered" as const, label: "Entered by the firm", url: null };

export const firmProjects: PortfolioProject[] = [
  { id: "proj_calaveras", orgId: FIRM_ORG_ID, name: "Calaveras Lake Outpatient Clinic Renovation", client: "Brazos Plains Health District", clientType: "healthcare", city: "Floresville", state: "TX", scope: "Full renovation of an occupied outpatient clinic in four phases: new exam suites, a nurse station, accessible restrooms, and a replacement rooftop HVAC system, with the clinic open to patients throughout", sector: "Healthcare", projectType: "Outpatient clinic renovation", sizeSqft: 18_400, contractValue: 612_000, constructionCost: 5_900_000, startDate: "2023-08-01", completionDate: "2025-04-30", status: "completed", role: "prime", deliveryMethod: "Design-bid-build", services: ["Architecture", "Mechanical engineering", "Electrical engineering", "Construction administration"], outcomes: ["Completed two weeks ahead of schedule", "Clinic stayed open to patients through all four phases"], reference: { name: "Alma Trevino", title: "Director of Facilities", organization: "Brazos Plains Health District", phone: "(830) 555-0142", email: "atrevino@brazosplainshd.example" }, photos: [], personnelIds: ["per_vega", "per_okonkwo", "per_lindqvist", "per_castaneda", "per_ortega"], profileCode: "H09", source: src },
  { id: "proj_calvert_hvac", orgId: FIRM_ORG_ID, name: "Fort Calvert Reserve Center HVAC Replacement", client: "Fort Calvert Installation Support Office", clientType: "federal", city: "San Antonio", state: "TX", scope: "Design of a replacement chilled-water plant and air handlers for a two-story training and administration building, with an energy model and phased cutover so the building stayed in use", sector: "Federal", projectType: "HVAC replacement", sizeSqft: 32_000, contractValue: 238_000, constructionCost: 2_400_000, startDate: "2022-10-01", completionDate: "2024-06-15", status: "completed", role: "prime", deliveryMethod: "Design-bid-build", services: ["Mechanical engineering", "Electrical engineering", "Energy modeling", "Construction administration"], outcomes: ["Measured HVAC energy use fell 31% in the first year", "Rated Exceptional for quality in the owner's performance evaluation"], reference: { name: "Maj. Corey Lindell", title: "Facilities Engineer", organization: "Fort Calvert Installation Support Office", phone: "(210) 555-0187", email: null }, photos: [], personnelIds: ["per_okonkwo", "per_castaneda", "per_ortega"], profileCode: "H04", source: src },
  { id: "proj_station7", orgId: FIRM_ORG_ID, name: "Seguin Street Fire Station No. 7", client: "City of Mesquite Hollow", clientType: "municipal", city: "Mesquite Hollow", state: "TX", scope: "A new three-bay fire station with living quarters, a decontamination corridor, and a training mezzanine, designed to the city's hardened-building standard", sector: "Public safety", projectType: "Fire station", sizeSqft: 14_200, contractValue: 596_000, constructionCost: 6_800_000, startDate: "2021-05-01", completionDate: "2023-09-30", status: "completed", role: "prime", deliveryMethod: "Construction manager at risk", services: ["Architecture", "Structural engineering", "Mechanical engineering", "Electrical engineering", "Construction administration"], outcomes: ["Delivered within the city's construction budget"], reference: { name: "Chief Ramon Ybarra", title: "Fire Chief", organization: "City of Mesquite Hollow", phone: "(830) 555-0119", email: null }, photos: [], personnelIds: ["per_vega", "per_lindqvist", "per_brightwater", "per_ortega"], profileCode: null, source: src },
  { id: "proj_llano", orgId: FIRM_ORG_ID, name: "Llano Ridge Behavioral Health Center Addition", client: "Llano Ridge Mental Health Authority", clientType: "healthcare", city: "Kerrville", state: "TX", scope: "A one-story addition with eight counseling rooms, a group room, and a secure intake area, designed to ligature-resistant standards, plus renovation of the existing waiting area", sector: "Healthcare", projectType: "Behavioral health clinic addition", sizeSqft: 9_800, contractValue: 344_000, constructionCost: 3_100_000, startDate: "2024-01-15", completionDate: "2025-08-29", status: "completed", role: "prime", deliveryMethod: "Design-bid-build", services: ["Architecture", "Mechanical engineering", "Electrical engineering", "Construction administration"], outcomes: ["No change orders for design errors"], reference: { name: "Dr. Celeste Whitfield", title: "Chief Operating Officer", organization: "Llano Ridge Mental Health Authority", phone: "(830) 555-0166", email: "cwhitfield@llanoridge.example" }, photos: [], personnelIds: ["per_vega", "per_lindqvist", "per_okonkwo"], profileCode: "H09", source: src },
  { id: "proj_courthouse", orgId: FIRM_ORG_ID, name: "Cuervo County Courthouse Annex Rehabilitation", client: "Cuervo County", clientType: "municipal", city: "Cuervo", state: "TX", scope: "Rehabilitation of a 1938 courthouse annex: new accessible entrance, restored windows, fire sprinklers, and new mechanical and electrical systems, reviewed with the state historical commission", sector: "Historic preservation", projectType: "Historic courthouse rehabilitation", sizeSqft: 22_000, contractValue: 418_000, constructionCost: 4_400_000, startDate: "2020-03-01", completionDate: "2022-11-18", status: "completed", role: "prime", deliveryMethod: "Design-bid-build", services: ["Architecture", "Historic preservation", "Mechanical engineering", "Electrical engineering"], outcomes: ["State historical commission approval on first submittal"], reference: { name: "Judge Patricia Olmos", title: "County Judge", organization: "Cuervo County", phone: "(325) 555-0108", email: null }, photos: [], personnelIds: ["per_vega", "per_lindqvist", "per_castaneda"], profileCode: "H08", source: src },
  { id: "proj_encino", orgId: FIRM_ORG_ID, name: "Encino Park Medical Office Roof and Envelope Repair", client: "Encino Park Medical Partners", clientType: "private", city: "San Antonio", state: "TX", scope: "Roof replacement and envelope repair on an occupied two-story medical office building, with infrared moisture survey and phased work around clinic hours", sector: "Healthcare", projectType: "Roof and envelope repair", sizeSqft: 41_000, contractValue: 96_000, constructionCost: 1_200_000, startDate: "2023-11-01", completionDate: "2024-07-31", status: "completed", role: "prime", deliveryMethod: "Design-bid-build", services: ["Architecture", "Construction administration"], outcomes: ["No clinic closures during construction"], reference: { name: "Grant Pfeiffer", title: "Practice Administrator", organization: "Encino Park Medical Partners", phone: "(210) 555-0173", email: "gpfeiffer@encinoparkmed.example" }, photos: [], personnelIds: ["per_lindqvist", "per_ortega"], profileCode: "H09", source: src },
  { id: "proj_solar", orgId: FIRM_ORG_ID, name: "Fort Calvert Solar Carport and Microgrid Study", client: "Fort Calvert Installation Support Office", clientType: "federal", city: "San Antonio", state: "TX", scope: "Feasibility study for a 1.1 megawatt solar carport with battery storage and a microgrid serving the reserve center's critical loads, including life-cycle cost analysis", sector: "Federal", projectType: "Energy study", sizeSqft: null, contractValue: 96_000, constructionCost: null, startDate: "2025-01-06", completionDate: "2025-09-12", status: "completed", role: "prime", deliveryMethod: null, services: ["Electrical engineering", "Energy analysis", "Life-cycle cost analysis"], outcomes: ["Recommended option funded for design in the owner's next budget year"], reference: { name: "Maj. Corey Lindell", title: "Facilities Engineer", organization: "Fort Calvert Installation Support Office", phone: "(210) 555-0187", email: null }, photos: [], personnelIds: ["per_castaneda", "per_okonkwo"], profileCode: "E07", source: src },
  { id: "proj_elevators", orgId: FIRM_ORG_ID, name: "Brazos Plains Health District Elevator Modernization", client: "Brazos Plains Health District", clientType: "healthcare", city: "Floresville", state: "TX", scope: "Modernization of two hydraulic passenger elevators in an occupied clinic building, with new controllers, cab finishes, and fire service recall", sector: "Healthcare", projectType: "Elevator modernization", sizeSqft: null, contractValue: 148_000, constructionCost: 1_600_000, startDate: "2026-04-01", completionDate: null, status: "in_progress", role: "prime", deliveryMethod: "Design-bid-build", services: ["Electrical engineering", "Architecture", "Construction administration"], outcomes: [], reference: null, photos: [], personnelIds: ["per_castaneda", "per_lindqvist", "per_ortega"], profileCode: "E05", source: src },
  { id: "proj_medina", orgId: FIRM_ORG_ID, name: "Medina Bend Middle School Classroom Wing", client: "Medina Bend Independent School District", clientType: "k12", city: "Medina Bend", state: "TX", scope: "A two-story classroom wing with 16 classrooms, two science labs, and a storm shelter designed to ICC 500", sector: "K-12 education", projectType: "School classroom addition", sizeSqft: 26_000, contractValue: 702_000, constructionCost: 9_200_000, startDate: "2019-06-01", completionDate: "2021-07-30", status: "completed", role: "prime", deliveryMethod: "Competitive sealed proposals", services: ["Architecture", "Structural engineering", "Mechanical engineering", "Electrical engineering", "Construction administration"], outcomes: ["Opened on time for the fall semester"], reference: { name: "Dr. Elena Rocha", title: "Assistant Superintendent for Operations", organization: "Medina Bend ISD", phone: "(830) 555-0151", email: "erocha@medinabendisd.example" }, photos: [], personnelIds: ["per_vega", "per_brightwater", "per_okonkwo"], profileCode: "E02", source: src },
  { id: "proj_pecos", orgId: FIRM_ORG_ID, name: "Pecos Freight Warehouse Conversion", client: "Pecos Freight Co.", clientType: "private", city: "San Antonio", state: "TX", scope: "Conversion of a 1970s warehouse into a dispatch office and training center with new restrooms, a mezzanine, and an energy-efficient envelope", sector: "Commercial", projectType: "Warehouse to office conversion", sizeSqft: 12_500, contractValue: 154_000, constructionCost: 2_000_000, startDate: "2018-02-01", completionDate: "2019-05-20", status: "completed", role: "prime", deliveryMethod: "Design-build", services: ["Architecture", "Mechanical engineering"], outcomes: [], reference: null, photos: [], personnelIds: ["per_vega"], profileCode: "O01", source: src },
];

export const firmPersonnel: Personnel[] = [
  { id: "per_vega", orgId: FIRM_ORG_ID, name: "Marisol Vega, AIA", title: "Principal", role: "Principal in charge", discipline: "Architecture", yearsTotal: 22, yearsWithFirm: 15, education: ["Master of Architecture, Texas A&M University", "Bachelor of Science in Architectural Studies, Texas A&M University"], registrations: [{ license: "Registered Architect", state: "TX", number: "21874", expires: "2027-08-31" }, { license: "Registered Architect", state: "NM", number: "5528", expires: "2027-12-31" }], certifications: ["NCARB Certificate", "U.S. Army veteran"], summary: "Founded the firm in 2011 after eight years as a U.S. Army facilities officer; leads every healthcare and public safety project from programming through closeout", projectIds: ["proj_calaveras", "proj_station7", "proj_llano", "proj_courthouse", "proj_medina", "proj_pecos"], resumeDocumentId: null, office: "San Antonio, TX" },
  { id: "per_okonkwo", orgId: FIRM_ORG_ID, name: "Daniel Okonkwo, PE", title: "Director of Engineering", role: "Project manager", discipline: "Mechanical engineering", yearsTotal: 17, yearsWithFirm: 9, education: ["Bachelor of Science in Mechanical Engineering, University of Texas at San Antonio"], registrations: [{ license: "Professional Engineer", state: "TX", number: "118432", expires: "2027-06-30" }, { license: "Professional Engineer", state: "OK", number: "31907", expires: "2027-06-30" }], certifications: ["LEED AP BD+C", "ASHRAE Building Energy Modeling Professional"], summary: "Manages the firm's federal and healthcare projects and designs HVAC systems for occupied buildings that cannot close", projectIds: ["proj_calaveras", "proj_calvert_hvac", "proj_llano", "proj_solar", "proj_medina"], resumeDocumentId: null, office: "San Antonio, TX" },
  { id: "per_lindqvist", orgId: FIRM_ORG_ID, name: "Teresa Lindqvist, AIA", title: "Senior Project Architect", role: "Architect", discipline: "Architecture", yearsTotal: 11, yearsWithFirm: 7, education: ["Bachelor of Architecture, University of Texas at Austin"], registrations: [{ license: "Registered Architect", state: "TX", number: "27641", expires: "2027-03-31" }], certifications: ["LEED AP BD+C", "Certified Construction Contract Administrator (CCCA)"], summary: "Leads construction documents and quality control reviews, and specializes in phased renovations of occupied clinics", projectIds: ["proj_calaveras", "proj_station7", "proj_llano", "proj_courthouse", "proj_encino", "proj_elevators"], resumeDocumentId: null, office: "San Antonio, TX" },
  { id: "per_castaneda", orgId: FIRM_ORG_ID, name: "Ray Castañeda, PE", title: "Senior Electrical Engineer", role: "Electrical engineer", discipline: "Electrical engineering", yearsTotal: 14, yearsWithFirm: 6, education: ["Bachelor of Science in Electrical Engineering, Texas Tech University"], registrations: [{ license: "Professional Engineer", state: "TX", number: "124058", expires: "2027-09-30" }], certifications: ["NFPA Certified Fire Protection Specialist"], summary: "Designs power, lighting, fire alarm, and renewable energy systems, including the firm's elevator and microgrid work", projectIds: ["proj_calaveras", "proj_calvert_hvac", "proj_courthouse", "proj_solar", "proj_elevators"], resumeDocumentId: null, office: "San Antonio, TX" },
  { id: "per_brightwater", orgId: FIRM_ORG_ID, name: "Hannah Brightwater, PE", title: "Structural Engineer", role: "Structural engineer", discipline: "Structural engineering", yearsTotal: 9, yearsWithFirm: 4, education: ["Master of Science in Civil Engineering, University of Texas at San Antonio"], registrations: [{ license: "Professional Engineer", state: "TX", number: "139920", expires: "2027-11-30" }], certifications: [], summary: "Structural design for new buildings and additions, including storm shelters and hardened public safety buildings", projectIds: ["proj_station7", "proj_medina"], resumeDocumentId: null, office: "San Antonio, TX" },
  { id: "per_ortega", orgId: FIRM_ORG_ID, name: "Luis Ortega", title: "Construction Administrator", role: "Construction administrator", discipline: "Construction administration", yearsTotal: 19, yearsWithFirm: 8, education: ["Associate of Applied Science in Construction Management, San Antonio College"], registrations: [], certifications: ["ICC Commercial Building Inspector", "OSHA 30-Hour Construction"], summary: "Runs site observation, submittal review, and punch lists, and keeps contractors on schedule in occupied buildings", projectIds: ["proj_calaveras", "proj_calvert_hvac", "proj_station7", "proj_encino", "proj_elevators"], resumeDocumentId: null, office: "San Antonio, TX" },
  { id: "per_raman", orgId: FIRM_ORG_ID, name: "Priya Raman", title: "Cost Estimator and Specifications Writer", role: "Cost estimator", discipline: "Cost estimating", yearsTotal: 12, yearsWithFirm: 3, education: ["Bachelor of Science in Construction Science, Texas A&M University"], registrations: [], certifications: ["CSI Certified Construction Specifier (CCS)", "AACE Certified Cost Professional"], summary: "Prepares cost estimates at each design phase and writes the firm's specifications", projectIds: ["proj_llano", "proj_elevators"], resumeDocumentId: null, office: "San Antonio, TX" },
];

export const firmCertifications: Certification[] = [
  { id: "cert_sdvosb", orgId: FIRM_ORG_ID, kind: "sdvosb", label: "Service-disabled veteran-owned small business (SDVOSB), verified in VetCert", issuer: "U.S. Small Business Administration", state: null, number: null, expires: "2028-02-28", documentId: null },
  { id: "cert_sb", orgId: FIRM_ORG_ID, kind: "small_business", label: "Small business under NAICS 541310", issuer: "Self-certified in SAM.gov", state: null, number: null, expires: "2027-05-14", documentId: null },
  { id: "cert_hub", orgId: FIRM_ORG_ID, kind: "other", label: "Texas Historically Underutilized Business (HUB)", issuer: "Texas Comptroller of Public Accounts", state: "TX", number: null, expires: "2028-06-30", documentId: null },
  { id: "cert_tbae", orgId: FIRM_ORG_ID, kind: "registration", label: "Architectural firm registration", issuer: "Texas Board of Architectural Examiners", state: "TX", number: "BR 4417", expires: "2027-12-31", documentId: null },
  { id: "cert_tbpels", orgId: FIRM_ORG_ID, kind: "registration", label: "Engineering firm registration", issuer: "Texas Board of Professional Engineers and Land Surveyors", state: "TX", number: "F-20961", expires: "2027-09-30", documentId: null },
];

export const firmBoilerplates: Boilerplate[] = [
  { id: "bp_firm_history", orgId: FIRM_ORG_ID, type: "history", title: "Firm history", body: "Cibolo Line Architecture + Engineering was founded in San Antonio in 2011 by Marisol Vega, AIA, a service-disabled U.S. Army veteran. The firm's 12 architects, engineers, and technical staff design and renovate clinics, public safety buildings, schools, and federal facilities across Texas, and most of its work is in buildings that stay open while it is under way", version: 2, wordCount: 66, updatedAt: at, sourceDocumentIds: [] },
  { id: "bp_firm_approach", orgId: FIRM_ORG_ID, type: "approach", title: "How we work", body: "Every project starts with a site walk with the people who use the building, before any drawing. One project manager stays with the owner from the first meeting to the end of the warranty period, and the architect and engineers who design the project also observe its construction", version: 1, wordCount: 53, updatedAt: at, sourceDocumentIds: [] },
  { id: "bp_firm_qc", orgId: FIRM_ORG_ID, type: "quality_control", title: "Quality control", body: "Each submittal gets a documented quality review by a licensed professional who did not work on it: a discipline coordination check at 50% and 95% construction documents, a constructability and code review, and a specifications review against the drawings. Review comments are logged, answered, and closed before anything is issued", version: 1, wordCount: 58, updatedAt: at, sourceDocumentIds: [] },
  { id: "bp_firm_safety", orgId: FIRM_ORG_ID, type: "safety_plan", title: "Safety", body: "Field staff hold OSHA 30-hour training, follow the firm's written site safety plan on every construction visit, and check in with the contractor's superintendent before entering an active work area", version: 1, wordCount: 34, updatedAt: at, sourceDocumentIds: [] },
];

/** Facts from the firm's website, as a confirmed reading would leave them. */
export const firmFacts: Fact[] = [
  { id: "fact_firm_founded", orgId: FIRM_ORG_ID, label: "Year founded", value: "2011", category: "organization", sourceDocumentId: null, sourceUrl: "https://cibololine.com/about", sourceLabel: "cibololine.com/about", sourceExcerpt: "Cibolo Line was founded in San Antonio in 2011 by Marisol Vega, AIA.", sourcePage: null, confidence: 0.95, status: "confirmed", lastConfirmedAt: at },
  { id: "fact_firm_staff", orgId: FIRM_ORG_ID, label: "Staff", value: "12 architects, engineers, and technical staff", category: "people", sourceDocumentId: null, sourceUrl: "https://cibololine.com/about", sourceLabel: "cibololine.com/about", sourceExcerpt: "Our 12 architects, engineers, and technical staff work from one studio in San Antonio.", sourcePage: null, confidence: 0.95, status: "confirmed", lastConfirmedAt: at },
];

// ---------- A year of bids, for the pipeline and win analytics ----------

const owner = (id: string, name: string, type: Funder["type"], geography: string): Funder => ({ id, name, ein: null, type, description: type === "federal" ? "Federal agency" : "Project owner", focusAreas: [], geography, givingMin: null, givingMax: null, websiteUrl: "", sourceUrl: "", aiPolicy: null, lastVerifiedAt: at, recentGrantees: [] });

export const firmFunders: Funder[] = [
  owner("own_brazos", "Brazos Plains Health District", "local_government", "Wilson County, TX"),
  owner("own_mesquite", "City of Mesquite Hollow", "local_government", "Mesquite Hollow, TX"),
  owner("own_calvert", "Fort Calvert Installation Support Office", "federal", "San Antonio, TX"),
  owner("own_llano", "Llano Ridge Mental Health Authority", "local_government", "Kerr County, TX"),
  owner("own_medina", "Medina Bend Independent School District", "local_government", "Medina Bend, TX"),
  owner("own_cuervo", "Cuervo County", "local_government", "Cuervo County, TX"),
  owner("own_encino", "Encino Park Medical Partners", "private_owner", "San Antonio, TX"),
  owner("own_border", "Rio Paloma Port Authority", "local_government", "Rio Paloma, TX"),
];

const bidOpp = (id: string, funderId: string, title: string, deadline: string, value: number, sector: string, type: "RFQ" | "RFP" | "SF330" = "RFQ", setAside: string | null = null): Opportunity => ({
  id,
  kind: "contract",
  funderId,
  title,
  summary: `${type === "RFQ" ? "Request for qualifications" : type === "SF330" ? "Architect-engineer qualifications (SF 330)" : "Request for proposals"} for ${sector.toLowerCase()} design services.`,
  sector,
  deadline,
  deadlineType: "fixed",
  amountMin: null,
  amountMax: value,
  eligibility: setAside ? [{ label: setAside, required: true }] : [],
  guidelinesUrl: "",
  sourceUrl: "",
  lastVerifiedAt: at,
  effort: "high",
  forecasted: false,
  sourceNote: "Entered by the firm",
  solicitation: { type, number: null, naics: ["541310"], setAside, placeOfPerformance: "Texas", estimatedValue: { min: null, max: value, note: "Estimated construction cost" }, dates: [], source: "upload", documentId: null, bonding: null, requiredCredentials: [], forms: type === "SF330" ? ["SF 330"] : [], pageLimits: [], evaluation: [], competitionSignals: [], contact: null },
});

export const firmOpportunities: Opportunity[] = [
  bidOpp("bid_seed_elev", "own_brazos", "Elevator Modernization, Building 2 (RFQ)", "2026-02-27", 1_600_000, "Healthcare"),
  bidOpp("bid_seed_police", "own_mesquite", "North Police Substation Design Services (RFQ)", "2026-01-30", 4_200_000, "Public safety"),
  bidOpp("bid_seed_solar", "own_calvert", "Solar Carport and Microgrid Feasibility Study", "2024-11-15", 900_000, "Energy", "SF330", "Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)"),
  bidOpp("bid_seed_csu", "own_llano", "Crisis Stabilization Unit A/E Services (RFQ)", "2026-04-10", 7_500_000, "Healthcare"),
  bidOpp("bid_seed_cte", "own_medina", "Career and Technical Education Center A/E Services (RFQ)", "2026-10-02", 14_000_000, "K-12 education"),
  bidOpp("bid_seed_jail", "own_cuervo", "Jail Medical Unit Renovation (RFP)", "2026-08-21", 2_800_000, "Justice", "RFP"),
  bidOpp("bid_seed_fitout", "own_encino", "Second Floor Clinic Fit-Out (RFP)", "2025-10-17", 900_000, "Healthcare", "RFP"),
  bidOpp("bid_seed_port", "own_border", "Cargo Inspection Facility Expansion (RFQ)", "2026-06-12", 22_000_000, "Transportation"),
];

const app = (id: string, oppId: string, stage: Application["stage"], createdAt: string, submittedAt: string | null): Application => ({ id, orgId: FIRM_ORG_ID, opportunityId: oppId, matchId: null, stage, mode: oppId === "bid_seed_solar" ? "sf330" : "bid", askAmount: null, ownerId: CURRENT_USER_ID, submittedAt, createdAt, updatedAt: createdAt });

export const firmApplications: Application[] = [
  app("app_seed_elev", "bid_seed_elev", "won", "2026-01-20T15:00:00.000Z", "2026-02-26T20:00:00.000Z"),
  app("app_seed_police", "bid_seed_police", "lost", "2025-12-15T15:00:00.000Z", "2026-01-29T20:00:00.000Z"),
  app("app_seed_solar", "bid_seed_solar", "won", "2024-10-21T15:00:00.000Z", "2024-11-14T20:00:00.000Z"),
  app("app_seed_csu", "bid_seed_csu", "lost", "2026-03-02T15:00:00.000Z", "2026-04-09T20:00:00.000Z"),
  app("app_seed_cte", "bid_seed_cte", "submitted", "2026-08-31T15:00:00.000Z", "2026-10-01T20:00:00.000Z"),
  app("app_seed_jail", "bid_seed_jail", "interview", "2026-07-20T15:00:00.000Z", "2026-08-20T20:00:00.000Z"),
  app("app_seed_fitout", "bid_seed_fitout", "won", "2025-09-15T15:00:00.000Z", "2025-10-16T20:00:00.000Z"),
  app("app_seed_port", "bid_seed_port", "lost", "2026-05-11T15:00:00.000Z", null),
];

export const firmOutcomes: Outcome[] = [
  { id: "out_seed_elev", applicationId: "app_seed_elev", result: "won", awardAmount: 148_000, feedback: "Ranked first of five on qualifications; the panel cited the Calaveras clinic phasing.", decidedAt: "2026-03-24T15:00:00.000Z", lossReasons: [], lessons: null },
  { id: "out_seed_police", applicationId: "app_seed_police", result: "lost", awardAmount: null, feedback: "Ranked third of seven. The selected firm had designed two police facilities for the city.", decidedAt: "2026-03-02T15:00:00.000Z", lossReasons: ["relationship", "fit"], lessons: "Lead with the fire station's hardened design next time, and ask for a debrief on law enforcement experience." },
  { id: "out_seed_solar", applicationId: "app_seed_solar", result: "won", awardAmount: 96_000, feedback: null, decidedAt: "2024-12-18T15:00:00.000Z", lossReasons: [], lessons: null },
  { id: "out_seed_csu", applicationId: "app_seed_csu", result: "lost", awardAmount: null, feedback: "Shortlisted, not selected. The panel wanted 24-hour residential behavioral health experience.", decidedAt: "2026-05-28T15:00:00.000Z", lossReasons: ["fit"], lessons: "Team with a behavioral health specialist consultant for residential work." },
  { id: "out_seed_fitout", applicationId: "app_seed_fitout", result: "won", awardAmount: 64_000, feedback: null, decidedAt: "2025-11-10T15:00:00.000Z", lossReasons: [], lessons: null },
  { id: "out_seed_port", applicationId: "app_seed_port", result: "withdrawn", awardAmount: null, feedback: "No-go: bonding and staffing for a project this size were beyond the firm today.", decidedAt: "2026-05-20T15:00:00.000Z", lossReasons: ["budget_size"], lessons: null },
];

export const firmMilestones: Milestone[] = [
  { id: "ms_seed_jail_int", orgId: FIRM_ORG_ID, applicationId: "app_seed_jail", title: "Interview with the selection panel", dueDate: "2026-10-28", kind: "interview", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_seed_jail_mock", orgId: FIRM_ORG_ID, applicationId: "app_seed_jail", title: "Practice run of the interview", dueDate: "2026-10-26", kind: "draft_due", assigneeId: CURRENT_USER_ID, done: false },
  { id: "ms_seed_cte_follow", orgId: FIRM_ORG_ID, applicationId: "app_seed_cte", title: "Check on the shortlist", dueDate: "2026-10-30", kind: "follow_up", assigneeId: CURRENT_USER_ID, done: false },
];
