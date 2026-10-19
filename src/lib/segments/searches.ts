import { ELIGIBILITY } from "@/lib/grantsgov";

/**
 * The Grants.gov searches each kind of applicant runs. Plain lists, so the
 * live product and the recorded demo ask Grants.gov exactly the same thing.
 */
export const SEGMENT_SEARCHES = {
  firm: {
    eligibilities: [ELIGIBILITY.smallBusiness, ELIGIBILITY.forProfit, ELIGIBILITY.unrestricted].join("|"),
    searches: [
      { keyword: "energy efficiency", fundingCategories: [] as string[] },
      { keyword: "workforce training", fundingCategories: [] as string[] },
      { keyword: "small business innovation research", fundingCategories: [] as string[] },
      { keyword: "building", fundingCategories: ["EN"] },
    ],
    detailsPerSearch: 4,
  },
  lab: {
    eligibilities: [ELIGIBILITY.publicHigherEd, ELIGIBILITY.privateHigherEd, ELIGIBILITY.unrestricted, ELIGIBILITY.others].join("|"),
    searches: [
      { keyword: "harmful algal bloom", fundingCategories: ["ST", "ENV", "NR"] },
      { keyword: "freshwater", fundingCategories: ["ST", "ENV", "NR"] },
      { keyword: "water quality sensor", fundingCategories: ["ST", "ENV", "NR"] },
      { keyword: "Great Lakes", fundingCategories: ["ST", "ENV", "NR"] },
    ],
    detailsPerSearch: 25,
  },
} as const;
