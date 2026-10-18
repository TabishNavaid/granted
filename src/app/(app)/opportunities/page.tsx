import type { Metadata } from "next";
import { services } from "@/lib/services";
import { OpportunitiesView } from "./opportunities-view";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const matches = await services.opportunities.listMatches();
  return <OpportunitiesView matches={matches} />;
}
