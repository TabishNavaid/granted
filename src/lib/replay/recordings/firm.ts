import type { GrantsGovRecording, Recording } from "../types";
import grantsgov from "./firm.grantsgov.json";

/**
 * Cibolo Line Architecture + Engineering, a fictional A-E firm in San
 * Antonio. Its website below does not exist. The SAM.gov notices
 * (firm.samgov.json), the sample solicitation (firm-rfp.ts), and the
 * Grants.gov notices are real, fetched on the day in `recordedOn`.
 */
const HOME = "https://cibololine.com/";

export const recording: Recording = {
  id: "firm",
  recordedOn: "2026-10-18",
  site: {
    homepage: HOME,
    pages: [
      {
        url: HOME,
        title: "Cibolo Line Architecture + Engineering",
        kind: "html",
        text: `Cibolo Line Architecture + Engineering
Architecture and building engineering for public owners in Texas.
We design and renovate clinics, public safety buildings, schools, and federal facilities, most of them buildings that stay open while the work goes on.
Cibolo Line is a service-disabled veteran-owned small business, verified in VetCert, and a Texas Historically Underutilized Business.
Recent work: the Calaveras Lake Outpatient Clinic, Seguin Street Fire Station No. 7, and the Fort Calvert Reserve Center HVAC replacement.`,
      },
      {
        url: "https://cibololine.com/about",
        title: "About the firm",
        kind: "html",
        text: `About the firm
Cibolo Line was founded in San Antonio in 2011 by Marisol Vega, AIA.
Marisol served eight years as a U.S. Army facilities officer before starting the firm.
Our 12 architects, engineers, and technical staff work from one studio in San Antonio.
We are registered with the Texas Board of Architectural Examiners (BR 4417) and the Texas Board of Professional Engineers and Land Surveyors (F-20961).
We work across Texas, Oklahoma, and New Mexico.`,
      },
      {
        url: "https://cibololine.com/projects",
        title: "Projects",
        kind: "html",
        text: `Projects
Calaveras Lake Outpatient Clinic Renovation, Floresville, Texas. Brazos Plains Health District. An 18,400 square foot outpatient clinic renovated in four phases while it stayed open to patients. Construction cost $5.9 million. Completed in 2025, two weeks ahead of schedule.
Fort Calvert Reserve Center HVAC Replacement, San Antonio, Texas. A replacement chilled-water plant and air handlers for a 32,000 square foot training building. Measured HVAC energy use fell 31% in the first year. Completed in 2024.
Seguin Street Fire Station No. 7, Mesquite Hollow, Texas. A new three-bay, 14,200 square foot fire station built to the city's hardened-building standard. Construction cost $6.8 million. Completed in 2023.
Llano Ridge Behavioral Health Center Addition, Kerrville, Texas. A 9,800 square foot addition with eight counseling rooms, designed to ligature-resistant standards. Completed in 2025.
Cuervo County Courthouse Annex Rehabilitation, Cuervo, Texas. A 1938 courthouse annex rehabilitated with a new accessible entrance, restored windows, and fire sprinklers. Approved by the state historical commission on first submittal. Completed in 2022.
Fort Calvert Solar Carport and Microgrid Study, San Antonio, Texas. A feasibility study for a 1.1 megawatt solar carport with battery storage. Completed in 2025.`,
      },
      {
        url: "https://cibololine.com/team",
        title: "Our team",
        kind: "html",
        text: `Our team
Marisol Vega, AIA, Principal. Registered architect in Texas and New Mexico, 22 years of experience.
Daniel Okonkwo, PE, Director of Engineering. Professional engineer in Texas and Oklahoma, LEED AP BD+C, 17 years of experience.
Teresa Lindqvist, AIA, Senior Project Architect. Registered architect in Texas, LEED AP BD+C, 11 years of experience.
Ray Castañeda, PE, Senior Electrical Engineer. Professional engineer in Texas, 14 years of experience.
Hannah Brightwater, PE, Structural Engineer. Professional engineer in Texas, 9 years of experience.
Luis Ortega, Construction Administrator. ICC Commercial Building Inspector, 19 years of experience.
Priya Raman, Cost Estimator and Specifications Writer. CSI Certified Construction Specifier, 12 years of experience.`,
      },
    ],
    skipped: [{ url: "https://cibololine.com/careers", reason: "no new information for a proposal" }],
  },
  calls: [
    {
      label: "extract_profile",
      durationMs: 6900,
      data: {
        profile: {
          name: "Cibolo Line Architecture + Engineering",
          mission: "Architecture and building engineering for public owners in Texas.",
          programs: [],
          populations: [],
          causes: ["Healthcare facilities", "Public safety buildings", "Federal facilities", "Schools"],
          city: "San Antonio",
          state: "TX",
          serviceArea: "Texas, Oklahoma, and New Mexico",
          annualBudget: "",
          foundedYear: "2011",
          staffSize: "12",
        },
        facts: [
          { label: "Year founded", value: "2011", category: "organization", sourceUrl: "https://cibololine.com/about", excerpt: "Cibolo Line was founded in San Antonio in 2011 by Marisol Vega, AIA." },
          { label: "Staff", value: "12 architects, engineers, and technical staff", category: "people", sourceUrl: "https://cibololine.com/about", excerpt: "Our 12 architects, engineers, and technical staff work from one studio in San Antonio." },
          { label: "Ownership", value: "Service-disabled veteran-owned small business, verified in VetCert", category: "organization", sourceUrl: HOME, excerpt: "Cibolo Line is a service-disabled veteran-owned small business, verified in VetCert, and a Texas Historically Underutilized Business." },
          { label: "Where the firm works", value: "Texas, Oklahoma, and New Mexico", category: "geography", sourceUrl: "https://cibololine.com/about", excerpt: "We work across Texas, Oklahoma, and New Mexico." },
        ],
      },
    },
    {
      label: "extract_firm",
      durationMs: 6100,
      data: {
        projects: [
          { name: "Calaveras Lake Outpatient Clinic Renovation", client: "Brazos Plains Health District", city: "Floresville", state: "TX", projectType: "Outpatient clinic renovation", sector: "Healthcare", sizeSqft: 18400, constructionCost: 5900000, completionYear: 2025, scope: "An 18,400 square foot outpatient clinic renovated in four phases while it stayed open to patients.", outcomes: ["Completed two weeks ahead of schedule"], excerpt: "An 18,400 square foot outpatient clinic renovated in four phases while it stayed open to patients." },
          { name: "Fort Calvert Reserve Center HVAC Replacement", client: "", city: "San Antonio", state: "TX", projectType: "HVAC replacement", sector: "Federal", sizeSqft: 32000, constructionCost: null, completionYear: 2024, scope: "A replacement chilled-water plant and air handlers for a 32,000 square foot training building.", outcomes: ["Measured HVAC energy use fell 31% in the first year"], excerpt: "A replacement chilled-water plant and air handlers for a 32,000 square foot training building." },
          { name: "Seguin Street Fire Station No. 7", client: "", city: "Mesquite Hollow", state: "TX", projectType: "Fire station", sector: "Public safety", sizeSqft: 14200, constructionCost: 6800000, completionYear: 2023, scope: "A new three-bay, 14,200 square foot fire station built to the city's hardened-building standard.", outcomes: [], excerpt: "A new three-bay, 14,200 square foot fire station built to the city's hardened-building standard." },
          { name: "Llano Ridge Behavioral Health Center Addition", client: "", city: "Kerrville", state: "TX", projectType: "Behavioral health clinic addition", sector: "Healthcare", sizeSqft: 9800, constructionCost: null, completionYear: 2025, scope: "A 9,800 square foot addition with eight counseling rooms, designed to ligature-resistant standards.", outcomes: [], excerpt: "A 9,800 square foot addition with eight counseling rooms, designed to ligature-resistant standards." },
          { name: "Cuervo County Courthouse Annex Rehabilitation", client: "", city: "Cuervo", state: "TX", projectType: "Historic courthouse rehabilitation", sector: "Historic preservation", sizeSqft: null, constructionCost: null, completionYear: 2022, scope: "A 1938 courthouse annex rehabilitated with a new accessible entrance, restored windows, and fire sprinklers.", outcomes: ["Approved by the state historical commission on first submittal"], excerpt: "A 1938 courthouse annex rehabilitated with a new accessible entrance, restored windows, and fire sprinklers." },
          { name: "Fort Calvert Solar Carport and Microgrid Study", client: "", city: "San Antonio", state: "TX", projectType: "Energy study", sector: "Federal", sizeSqft: null, constructionCost: null, completionYear: 2025, scope: "A feasibility study for a 1.1 megawatt solar carport with battery storage.", outcomes: [], excerpt: "A feasibility study for a 1.1 megawatt solar carport with battery storage." },
        ],
        people: [
          { name: "Marisol Vega, AIA", title: "Principal", discipline: "Architecture", yearsTotal: 22, registrations: [{ license: "Registered Architect", state: "TX" }, { license: "Registered Architect", state: "NM" }], certifications: [], excerpt: "Marisol Vega, AIA, Principal. Registered architect in Texas and New Mexico, 22 years of experience." },
          { name: "Daniel Okonkwo, PE", title: "Director of Engineering", discipline: "Mechanical engineering", yearsTotal: 17, registrations: [{ license: "Professional Engineer", state: "TX" }, { license: "Professional Engineer", state: "OK" }], certifications: ["LEED AP BD+C"], excerpt: "Daniel Okonkwo, PE, Director of Engineering. Professional engineer in Texas and Oklahoma, LEED AP BD+C, 17 years of experience." },
          { name: "Teresa Lindqvist, AIA", title: "Senior Project Architect", discipline: "Architecture", yearsTotal: 11, registrations: [{ license: "Registered Architect", state: "TX" }], certifications: ["LEED AP BD+C"], excerpt: "Teresa Lindqvist, AIA, Senior Project Architect. Registered architect in Texas, LEED AP BD+C, 11 years of experience." },
          { name: "Ray Castañeda, PE", title: "Senior Electrical Engineer", discipline: "Electrical engineering", yearsTotal: 14, registrations: [{ license: "Professional Engineer", state: "TX" }], certifications: [], excerpt: "Ray Castañeda, PE, Senior Electrical Engineer. Professional engineer in Texas, 14 years of experience." },
          { name: "Hannah Brightwater, PE", title: "Structural Engineer", discipline: "Structural engineering", yearsTotal: 9, registrations: [{ license: "Professional Engineer", state: "TX" }], certifications: [], excerpt: "Hannah Brightwater, PE, Structural Engineer. Professional engineer in Texas, 9 years of experience." },
          { name: "Luis Ortega", title: "Construction Administrator", discipline: "Construction administration", yearsTotal: 19, registrations: [], certifications: ["ICC Commercial Building Inspector"], excerpt: "Luis Ortega, Construction Administrator. ICC Commercial Building Inspector, 19 years of experience." },
          { name: "Priya Raman", title: "Cost Estimator and Specifications Writer", discipline: "Cost estimating", yearsTotal: 12, registrations: [], certifications: ["CSI Certified Construction Specifier"], excerpt: "Priya Raman, Cost Estimator and Specifications Writer. CSI Certified Construction Specifier, 12 years of experience." },
        ],
        certifications: [
          { kind: "sdvosb", label: "Service-disabled veteran-owned small business (SDVOSB), verified in VetCert", issuer: "U.S. Small Business Administration", state: null, number: null, excerpt: "Cibolo Line is a service-disabled veteran-owned small business, verified in VetCert, and a Texas Historically Underutilized Business." },
          { kind: "registration", label: "Architectural firm registration", issuer: "Texas Board of Architectural Examiners", state: "TX", number: "BR 4417", excerpt: "We are registered with the Texas Board of Architectural Examiners (BR 4417) and the Texas Board of Professional Engineers and Land Surveyors (F-20961)." },
          { kind: "registration", label: "Engineering firm registration", issuer: "Texas Board of Professional Engineers and Land Surveyors", state: "TX", number: "F-20961", excerpt: "We are registered with the Texas Board of Architectural Examiners (BR 4417) and the Texas Board of Professional Engineers and Land Surveyors (F-20961)." },
        ],
        sectors: ["Healthcare", "Public safety", "Federal", "K-12 education", "Historic preservation"],
      },
    },
    {
      label: "read_rfp",
      match: "Solicitation: NCO 17 AE Short Selection Database",
      durationMs: 5200,
      data: {
        titles: [
          { key: "r1", title: "Licensed professionals and local knowledge screen first" },
          { key: "r2", title: "SDVOSB set-aside under VAAR 819.7004" },
          { key: "r3", title: "Submit one PDF by email, 10 MB or less" },
          { key: "r4", title: "Only the first 20 pages are kept" },
          { key: "r5", title: "Cover letter comes first" },
          { key: "r6", title: "Cover letter: specialties and capabilities" },
          { key: "r7", title: "SAM registration printout" },
          { key: "r8", title: "SAM registration, electronic payment, VetCert" },
          { key: "r9", title: "SF 330 Part II and current registrations" },
          { key: "r10", title: "Examples of completed projects" },
          { key: "r11", title: "Only the first 20 pages are evaluated" },
          { key: "r12", title: "Everything in a single PDF" },
          { key: "r13", title: "Questions go to the contracting office" },
          { key: "r14", title: "FAR 36.602-1 selection criteria" },
          { key: "r15", title: "Criterion 1: professional qualifications" },
          { key: "r16", title: "Criterion 2: specialized experience" },
          { key: "r17", title: "Criterion 3: capacity" },
          { key: "r18", title: "Criterion 4: past performance" },
          { key: "r19", title: "Criterion 5: location and knowledge of the locality" },
        ],
        added: [
          { title: "VetCert verification as an SDVOSB", quote: "Only Firms that have been Verified as an SDVOSB in VetCert will be included in the Short Selection Database.", kind: "eligibility", sectionKey: "forms", mandatory: true },
          { title: "Update SF 330 Part II each year", quote: "Firms are encouraged to update their SF 330, Part II data annually by responding to this announcement", kind: "submission", sectionKey: "forms", mandatory: false },
        ],
      },
    },
    {
      label: "draft_bid",
      match: "Solicitation: NCO 17 AE Short Selection Database",
      durationMs: 12800,
      data: {
        sections: [
          {
            key: "cover_letter",
            text: "Cibolo Line Architecture + Engineering asks to be included in the VISN 17 AE Short Selection Database. We are a service-disabled veteran-owned small business, verified in VetCert [[fact:rec_cert_sdvosb]], registered in SAM.gov [[fact:rec_uei]], with registered architect and engineering firm registrations in Texas [[fact:rec_cert_tbae]] [[fact:rec_cert_tbpels]].\n\nOur work matches the project types in your notice: renovations of occupied clinics [[fact:rec_proj_calaveras]], HVAC system replacement with energy modeling [[fact:rec_proj_calvert_hvac]], photovoltaic and microgrid studies [[fact:rec_proj_solar]], elevator modernization [[fact:rec_proj_elevators]], historic preservation [[fact:rec_proj_courthouse]], and construction period services on every project we design [[fact:rec_bp_firm_approach]].\n\nMarisol Vega, AIA, Principal, is the point of contact for this submission and is authorized to bind the firm. [[gap:cover_contact]]",
          },
          {
            key: "qualifications",
            text: "[[fact:rec_bp_firm_history]]\n\nOur staff: [[fact:rec_staff]] Our principal and our senior project architect are registered architects in Texas, and our engineers hold Professional Engineer licenses in Texas [[fact:rec_per_vega]] [[fact:rec_per_okonkwo]] [[fact:rec_per_castaneda]].\n\nEvery set of drawings is produced in computer-assisted design and checked in a documented quality review before it is issued [[fact:rec_bp_firm_qc]].",
          },
          {
            key: "approach",
            text: "Professional qualifications. Two registered architects and three Professional Engineers in mechanical, electrical, and structural disciplines, all licensed in Texas, the state where VISN 17's facilities are [[fact:rec_per_vega]] [[fact:rec_per_lindqvist]] [[fact:rec_per_okonkwo]] [[fact:rec_per_castaneda]] [[fact:rec_per_brightwater]].\n\nSpecialized experience. Healthcare renovation in buildings that stay open [[fact:rec_proj_calaveras]] [[fact:rec_proj_llano]], HVAC and energy work for a federal owner, where measured HVAC energy use fell 31% in the first year [[fact:rec_proj_calvert_hvac]], and a 1.1 megawatt solar carport and microgrid study [[fact:rec_proj_solar]].\n\nCapacity. Projects under the simplified acquisition threshold of $250,000 fit our size: our recent federal design fee was within that range [[fact:rec_proj_calvert_hvac]]. [[gap:capacity_now]]\n\nPast performance. [[gap:past_performance]]\n\nLocation and knowledge of the locality. Our studio is in San Antonio, and most of our completed work is in South and Central Texas [[fact:rec_proj_calaveras]] [[fact:rec_proj_station7]] [[fact:rec_proj_courthouse]].",
          },
        ],
        gaps: [
          { key: "cover_contact", sectionKey: "cover_letter", question: "What phone number and email should the contracting office use for this submission?", whyItMatters: "Owners need one point of contact, and the cover letter is where they look.", suggestedLabel: "Submission point of contact" },
          { key: "capacity_now", sectionKey: "approach", question: "How many staff hours a week could the firm give a new VA task order in the next three months?", whyItMatters: "Capacity to accomplish the work in the required time is a FAR 36.602-1 criterion, and only you know your current load.", suggestedLabel: "Available capacity for VA work" },
          { key: "past_performance", sectionKey: "approach", question: "Which owner evaluations or CPARS ratings can you cite for cost control, quality, and schedule?", whyItMatters: "Past performance on cost, quality, and schedule is a FAR 36.602-1 criterion. Use ratings the owners gave you.", suggestedLabel: "Past performance ratings" },
        ],
      },
    },
  ],
  grantsgov: grantsgov as unknown as GrantsGovRecording,
};
