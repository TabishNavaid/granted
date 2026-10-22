import { services } from "@/lib/services";
import { OpportunitiesView } from "./opportunities-view";
import { FirmOpportunitiesView } from "./firm-view";
import { kindOf } from "@/lib/segments";

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, org, matches, runtime, savedSearches] = await Promise.all([searchParams, services.org.get(), services.opportunities.listMatches(), services.loop.runtime(), services.opportunities.listSavedSearches()]);
  const demo = runtime.demo && !runtime.ai;
  if (org.orgType === "firm") {
    const [apps, sam, firm] = await Promise.all([services.applications.list(), services.bids.searchSam(), services.firm.getProfile()]);
    const bids = await Promise.all(
      apps
        .filter((a) => kindOf(a.opportunity) === "contract")
        .map(async (a) => ({ ...a, goNoGo: (await services.bids.get(a.id))?.goNoGo?.score ?? null })),
    );
    return <FirmOpportunitiesView bids={bids} grants={matches.filter((m) => kindOf(m.opportunity) !== "contract")} sam={sam} demo={runtime.demo} initialTab={tab === "grants" ? "grants" : "bids"} savedSearches={savedSearches} profile={{ naics: firm?.naics.map((n) => n.code) ?? [], states: [...new Set([org.state, ...(firm?.states ?? [])].filter(Boolean))] }} />;
  }
  return <OpportunitiesView matches={matches} demo={demo} savedSearches={savedSearches} orgType={org.orgType} />;
}
