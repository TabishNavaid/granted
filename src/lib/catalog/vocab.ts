/**
 * The fixed vocabularies every connector maps into, so one filter works
 * across every source. Codes are stable strings stored in the database;
 * labels are what people read.
 */

export const OPPORTUNITY_TYPES = ["grant", "contract", "research", "scholarship"] as const;
export type CatalogType = (typeof OPPORTUNITY_TYPES)[number];

export const TYPE_LABELS: Record<CatalogType, string> = {
  grant: "Grants",
  contract: "Contracts and bids",
  research: "Research funding",
  scholarship: "Scholarships and fellowships",
};

export const STATUSES = ["forecasted", "open", "closed", "archived", "cancelled", "awarded"] as const;
export type CatalogStatus = (typeof STATUSES)[number];

/** Who may apply. */
export const ELIGIBILITY = {
  nonprofit: "Nonprofits with 501(c)(3) status",
  nonprofit_other: "Nonprofits without 501(c)(3) status",
  small_business: "Small businesses",
  for_profit: "For-profit organizations",
  university: "Colleges and universities",
  state_government: "State governments",
  local_government: "Counties, cities, and special districts",
  school_district: "School districts",
  tribal: "Tribal governments and organizations",
  housing_authority: "Public housing authorities",
  individual: "Individuals",
  international: "Organizations outside the United States",
  unrestricted: "Anyone",
  other: "Others named in the notice",
} as const;
export type EligibilityCode = keyof typeof ELIGIBILITY;

/** Grants.gov applicant type codes to ours. Same list the search2 and extract use. */
export const GRANTSGOV_ELIGIBILITY: Record<string, EligibilityCode[]> = {
  "00": ["state_government"],
  "01": ["local_government"],
  "02": ["local_government"],
  "04": ["local_government"],
  "05": ["school_district"],
  "06": ["university"],
  "07": ["tribal"],
  "08": ["housing_authority"],
  "11": ["tribal"],
  "12": ["nonprofit"],
  "13": ["nonprofit_other"],
  "20": ["university"],
  "21": ["individual"],
  "22": ["for_profit"],
  "23": ["small_business"],
  "25": ["other"],
  "99": ["unrestricted"],
};

/** Grants.gov funding activity categories. */
export const GRANTSGOV_CATEGORIES: Record<string, string> = {
  ACA: "Affordable Care Act",
  AG: "Agriculture",
  AR: "Arts",
  BC: "Business and commerce",
  CD: "Community development",
  CP: "Consumer protection",
  DPR: "Disaster prevention and relief",
  ED: "Education",
  ELT: "Employment, labor, and training",
  EN: "Energy",
  ENV: "Environment",
  FN: "Food and nutrition",
  HL: "Health",
  HO: "Housing",
  HU: "Humanities",
  IIJ: "Infrastructure Investment and Jobs Act",
  IS: "Information and statistics",
  ISS: "Income security and social services",
  LJL: "Law, justice, and legal services",
  NR: "Natural resources",
  O: "Other",
  OZ: "Opportunity zone benefits",
  RA: "Recovery Act",
  RD: "Regional development",
  ST: "Science and technology",
  T: "Transportation",
};

/** Causes nonprofits search by. Connectors map categories and keywords into these. */
export const CAUSES = {
  arts: "Arts and culture",
  education: "Education",
  youth: "Youth development",
  health: "Health",
  mental_health: "Mental health",
  food: "Food and nutrition",
  housing: "Housing and homelessness",
  environment: "Environment and conservation",
  community: "Community and economic development",
  workforce: "Jobs and workforce",
  justice: "Justice and legal services",
  human_services: "Human services",
  agriculture: "Agriculture and rural life",
  animals: "Animals",
  disaster: "Disaster relief",
  veterans: "Veterans",
  seniors: "Older adults",
  disability: "Disability",
  international: "International development",
  religion: "Religion",
  science: "Science and technology",
  energy: "Energy",
  transportation: "Transportation",
  infrastructure: "Infrastructure",
} as const;
export type CauseCode = keyof typeof CAUSES;

/** Research areas, roughly the directorates and institutes funders organize by. */
export const RESEARCH_AREAS = {
  biomedical: "Biomedical and health",
  life_sciences: "Biology and life sciences",
  physical_sciences: "Physics, chemistry, and materials",
  math: "Mathematics and statistics",
  computing: "Computing and information",
  engineering: "Engineering",
  geosciences: "Earth, ocean, and atmosphere",
  environment: "Environment and ecology",
  energy: "Energy",
  social_sciences: "Social and behavioral sciences",
  education_research: "Education research",
  agriculture: "Agriculture and food",
  space: "Space and aeronautics",
  defense: "Defense and security",
  humanities: "Humanities",
} as const;
export type ResearchAreaCode = keyof typeof RESEARCH_AREAS;

const GRANTSGOV_CATEGORY_CAUSES: Record<string, CauseCode[]> = {
  AG: ["agriculture"],
  AR: ["arts"],
  CD: ["community"],
  DPR: ["disaster"],
  ED: ["education"],
  ELT: ["workforce"],
  EN: ["energy"],
  ENV: ["environment"],
  FN: ["food"],
  HL: ["health"],
  HO: ["housing"],
  HU: ["arts"],
  ISS: ["human_services"],
  LJL: ["justice"],
  NR: ["environment"],
  RD: ["community"],
  ST: ["science"],
  T: ["transportation"],
  IIJ: ["infrastructure"],
};

export function causesFromGrantsGovCategories(codes: string[]): CauseCode[] {
  return uniq(codes.flatMap((c) => GRANTSGOV_CATEGORY_CAUSES[c] ?? []));
}

/** Keyword rules for causes and research areas, applied to a title and summary. Conservative on purpose. */
const CAUSE_RULES: [CauseCode, RegExp][] = [
  ["youth", /\b(youth|juvenile|adolescen|after[- ]school|mentoring|children)\b/i],
  ["mental_health", /\b(mental health|behavioral health|suicide|substance use|opioid)\b/i],
  ["food", /\b(food (bank|security|insecurity|pantr)|nutrition|hunger|meals)\b/i],
  ["housing", /\b(housing|homeless|shelter|tenant)\b/i],
  ["veterans", /\bveteran/i],
  ["seniors", /\b(older adults?|seniors?|aging|elderly)\b/i],
  ["disability", /\b(disabilit|deaf|blind|autism)\b/i],
  ["animals", /\b(animal welfare|wildlife rescue|humane society|shelter animals)\b/i],
  ["arts", /\b(arts?|museum|humanities|theat(er|re)|music|dance|librar(y|ies))\b/i],
  ["environment", /\b(conservation|environment|climate|watershed|habitat|ecosystem)\b/i],
  ["workforce", /\b(workforce|job training|apprentice|employment)\b/i],
  ["justice", /\b(justice|legal aid|reentry|victims?|policing)\b/i],
  ["education", /\b(education|school|literacy|stem|teacher|students?)\b/i],
  ["health", /\b(health|clinic|medical|hospital|disease)\b/i],
  ["agriculture", /\b(agricultur|farm|rural|ranch)\b/i],
  ["infrastructure", /\b(infrastructure|bridge|broadband|water system|wastewater)\b/i],
  ["international", /\b(international development|global health|overseas|foreign assistance)\b/i],
];

const AREA_RULES: [ResearchAreaCode, RegExp][] = [
  ["biomedical", /\b(clinical|biomedical|cancer|disease|patients?|therapeut|neuro|immun|genom|nih)\b/i],
  ["life_sciences", /\b(biolog|ecolog|evolution|organism|plant|microb|cell)\b/i],
  ["physical_sciences", /\b(physic|chemi|materials?|quantum|optic|nanotech)\b/i],
  ["math", /\b(mathemat|statistic)\b/i],
  ["computing", /\b(comput|software|artificial intelligence|machine learning|data science|cyber|algorithm)\b/i],
  ["engineering", /\b(engineering|manufactur|robotic|structural|civil)\b/i],
  ["geosciences", /\b(geoscien|ocean|atmospher|earth science|hydrolog|seismic|climate)\b/i],
  ["environment", /\b(environment|ecosystem|biodivers|conservation|watershed|freshwater)\b/i],
  ["energy", /\b(energy|solar|wind power|battery|fusion|grid)\b/i],
  ["social_sciences", /\b(social science|behavioral|economic|psycholog|sociolog|survey research)\b/i],
  ["education_research", /\b(education research|learning sciences|stem education)\b/i],
  ["agriculture", /\b(agricultur|crop|soil|livestock|food system)\b/i],
  ["space", /\b(space|aeronaut|nasa|planetary|astro)\b/i],
  ["defense", /\b(defense|darpa|army|navy|air force|homeland security)\b/i],
  ["humanities", /\b(humanities|history|archaeolog|linguistic|philosoph)\b/i],
];

export function causesFromText(text: string): CauseCode[] {
  return CAUSE_RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
}

export function researchAreasFromText(text: string): ResearchAreaCode[] {
  return AREA_RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
}

/** Small business set-aside codes as SAM.gov publishes them, to the plain label we show. */
export const SET_ASIDES: Record<string, string> = {
  SBA: "Total small business",
  SBP: "Partial small business",
  "8A": "8(a)",
  "8AN": "8(a) sole source",
  HZC: "HUBZone",
  HZS: "HUBZone sole source",
  SDVOSBC: "Service-disabled veteran-owned small business",
  SDVOSBS: "Service-disabled veteran-owned sole source",
  WOSB: "Women-owned small business",
  WOSBSS: "Women-owned small business sole source",
  EDWOSB: "Economically disadvantaged women-owned small business",
  EDWOSBSS: "Economically disadvantaged women-owned sole source",
  VSA: "Veteran-owned small business",
  VSS: "Veteran-owned sole source",
  ISBEE: "Indian small business economic enterprise",
  IEE: "Indian economic enterprise",
  BICiv: "Buy Indian",
  LAS: "Local area set-aside",
  ESB: "Emerging small business",
};

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
};

const STATE_BY_NAME = new Map(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));

/** "Ohio", "OH", "oh" to "OH"; anything else to null. */
export function stateCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v) && US_STATES[v.toUpperCase()]) return v.toUpperCase();
  return STATE_BY_NAME.get(v.toLowerCase()) ?? null;
}

export function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)];
}
