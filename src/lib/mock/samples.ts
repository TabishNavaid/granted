import type { Member, Organization } from "@/lib/types";
import { CURRENT_USER_ID, organization as riverbend, members as riverbendMembers } from "./data";

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
  recording: "youth" | "foodbank" | "clinic";
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

const blankOrg = (o: Pick<Organization, "id" | "name" | "websiteUrl" | "city" | "state" | "calendarToken">): Organization => ({
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
