import type { Metadata } from "next";
import { services } from "@/lib/services";
import { GapsStep } from "./gaps-step";

export const metadata: Metadata = { title: "A few questions" };

/** Only what the site did not answer, plus one open question every director has an answer to. */
export default async function GapsPage() {
  const [org, facts] = await Promise.all([services.org.get(), services.knowledge.listFacts()]);
  const confirmed = facts.filter((f) => f.status === "confirmed");
  const ask = {
    budget: org.annualBudget == null && !confirmed.some((f) => f.category === "finance"),
    people: !confirmed.some((f) => f.category === "reach"),
    location: !org.city && !confirmed.some((f) => f.category === "geography"),
    result: !confirmed.some((f) => f.category === "outcomes"),
    staff: !confirmed.some((f) => f.category === "people"),
    programs: !confirmed.some((f) => f.label === "Program"),
    populations: !org.populations.length,
  };
  return <GapsStep ask={ask} orgName={org.name} />;
}
