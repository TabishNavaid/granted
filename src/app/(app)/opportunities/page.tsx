import type { Metadata } from "next";
import { services } from "@/lib/services";
import { OpportunitiesView } from "./opportunities-view";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const [matches, runtime, savedSearches] = await Promise.all([services.opportunities.listMatches(), services.loop.runtime(), services.opportunities.listSavedSearches()]);
  return <OpportunitiesView matches={matches} demo={runtime.demo && !runtime.ai} savedSearches={savedSearches} />;
}
