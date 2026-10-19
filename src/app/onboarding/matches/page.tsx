import type { Metadata } from "next";
import { services } from "@/lib/services";
import { MatchesStep } from "./matches-step";
import { newestFirst } from "@/lib/matches";

export const metadata: Metadata = { title: "Your first matches" };

export default async function OnboardingMatchesPage() {
  const [matches, org, runtime] = await Promise.all([services.opportunities.listMatches(), services.org.get(), services.loop.runtime()]);
  const demo = runtime.demo && !runtime.ai;
  // A returning user who already searched sees their matches at once; everyone else watches the search run.
  const searched = org.onboardingStep === "matches" || org.onboardingStep === "done";
  return <MatchesStep initial={searched ? newestFirst(matches).slice(0, 3) : null} total={matches.length} demo={demo} />;
}
