import type { Member, Organization } from "@/lib/types";
import { CURRENT_USER_ID, organization as riverbend, members as riverbendMembers } from "./data";
import { firmMembers, firmOrg } from "./firm";

/**
 * The sample organizations the demo runs on. All three are fictional; their
 * websites do not exist. Riverbend comes with six months of history. The
 * other two start empty, the way a new account does, and fill in as the
 * visitor runs setup.
 *
 * `recording` names the recorded run in src/lib/replay/recordings that the
 * demo replays when no model key is set.
 */
export interface SampleOrg {
  id: string;
  recording: import("@/lib/replay/types").RecordingId;
  label: string;
  /** What kind of organization, in a few words, for the switcher. */
  kind: string;
  host: string;
  /** Other spellings a visitor might paste. */
  aliases: string[];
  history: boolean;
  org: Organization;
  members: Member[];
}

const blankOrg = (o: Pick<Organization, "id" | "name" | "websiteUrl" | "city" | "state" | "calendarToken"> & { orgType?: Organization["orgType"] }): Organization => ({
  orgType: "nonprofit",
  ...o,
  ein: "",
  mission: "",
  annualBudget: null,
  fiscalYearEnd: "",
  foundedYear: null,
  serviceArea: "",
  causes: [],
  populations: [],
  staffCount: null,
  volunteerCount: null,
  onboardingStep: "start",
  createdAt: new Date().toISOString(),
});

export const samples: SampleOrg[] = [
  {
    id: riverbend.id,
    recording: "youth",
    label: "Riverbend Youth Collective",
    kind: "Youth program in Dayton, Ohio",
    host: "riverbendyouth.org",
    aliases: ["riverbend youth", "riverbend"],
    history: true,
    org: riverbend,
    members: riverbendMembers,
  },
  {
    id: "org_second_furrow",
    recording: "foodbank",
    label: "Second Furrow Food Network",
    kind: "Food bank in western North Carolina",
    host: "secondfurrow.org",
    aliases: ["second furrow", "secondfurrowfood.org"],
    history: false,
    org: blankOrg({ id: "org_second_furrow", name: "Second Furrow Food Network", websiteUrl: "https://secondfurrow.org", city: "", state: "", calendarToken: "demo-calendar-second-furrow" }),
    members: [{ id: CURRENT_USER_ID, orgId: "org_second_furrow", fullName: "Teresa Gaines", email: "teresa@secondfurrow.org", role: "owner", status: "active" }],
  },
  {
    id: "org_pine_hollow",
    recording: "clinic",
    label: "Pine Hollow Family Health",
    kind: "Rural clinic in eastern Kentucky",
    host: "pinehollowhealth.org",
    aliases: ["pine hollow", "pinehollowclinic.org"],
    history: false,
    org: blankOrg({ id: "org_pine_hollow", name: "Pine Hollow Family Health", websiteUrl: "https://pinehollowhealth.org", city: "", state: "", calendarToken: "demo-calendar-pine-hollow" }),
    members: [{ id: CURRENT_USER_ID, orgId: "org_pine_hollow", fullName: "Dr. Ruth Sizemore", email: "ruth@pinehollowhealth.org", role: "owner", status: "active" }],
  },
];

samples.push({
  id: firmOrg.id,
  recording: "firm",
  label: "Cibolo Line Architecture + Engineering",
  kind: "Architecture and engineering firm in San Antonio, Texas",
  host: "cibololine.com",
  aliases: ["cibolo line", "cibololine"],
  history: true,
  org: firmOrg,
  members: firmMembers,
});

samples.push(
  {
    id: "org_freshwater_lab",
    recording: "lab",
    label: "Lake Erie Freshwater Systems Lab",
    kind: "University research lab in Toledo, Ohio",
    host: "freshwaterlab.maumeebay.example.edu",
    aliases: ["freshwater lab", "lake erie lab", "maumee bay"],
    history: false,
    org: blankOrg({ id: "org_freshwater_lab", orgType: "research", name: "Lake Erie Freshwater Systems Lab", websiteUrl: "https://freshwaterlab.maumeebay.example.edu", city: "", state: "", calendarToken: "demo-calendar-freshwater-lab" }),
    members: [{ id: CURRENT_USER_ID, orgId: "org_freshwater_lab", fullName: "Dr. Anika Sorensen", email: "asorensen@maumeebay.example.edu", role: "owner", status: "active" }],
  },
  {
    id: "org_jordan_reyes",
    recording: "student",
    label: "Jordan Reyes",
    kind: "High school senior in Dayton, Ohio",
    host: "",
    aliases: ["jordan reyes", "jordan"],
    history: false,
    org: blankOrg({ id: "org_jordan_reyes", orgType: "individual", name: "Jordan Reyes", websiteUrl: "", city: "Dayton", state: "OH", calendarToken: "demo-calendar-jordan-reyes" }),
    members: [{ id: CURRENT_USER_ID, orgId: "org_jordan_reyes", fullName: "Jordan Reyes", email: "jordan.reyes@example.org", role: "owner", status: "active" }],
  },
);

export const sampleById = (id: string) => samples.find((s) => s.id === id) ?? null;

/** Which sample, if any, a pasted address or name refers to. Never guesses beyond these. */
export function sampleForInput(input: string): SampleOrg | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  let host = raw;
  try {
    host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    // not a URL; compare as text
  }
  return samples.find((s) => s.host === host || s.aliases.some((a) => a === host || a === raw)) ?? null;
}
