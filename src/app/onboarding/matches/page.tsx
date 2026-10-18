import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OpportunityCard } from "@/components/app/opportunity-card";

export const metadata: Metadata = { title: "Your first matches" };

export default async function OnboardingMatchesPage() {
  const [all, runs, runtime] = await Promise.all([services.opportunities.listMatches(), services.activity.listRuns(), services.loop.runtime()]);
  const matches = all.slice(0, 3);
  const demo = runtime.demo && !runtime.ai;
  const lastSearch = runs.find((r) => r.agent === "discovery" && r.status === "succeeded");
  const intro = demo
    ? "We looked at 412 opportunities and kept only the ones you can actually apply for. These three are the strongest fits. The rest are waiting in Opportunities, and new ones arrive every Monday."
    : lastSearch
      ? `${lastSearch.outputSummary} ${all.length > 3 ? `The rest are waiting in Opportunities.` : ""}`
      : "We have not searched yet.";
  return (
    <div>
      <h1 className="font-display text-h1 text-ink">{matches.length ? (matches.length === 1 ? "One place to start." : `${matches.length === 2 ? "Two" : "Three"} places to start.`) : "Nothing strong enough yet."}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">{intro}</p>
      {matches.length ? (
        <ul className="mt-8 border-b border-rule">
          {matches.map((m) => (
            <li key={m.id}>
              <OpportunityCard match={m} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8" title="No open federal notice fit well enough" description="Grants.gov only lists federal funding, and most small organizations win foundation and local money first. We will keep looking, and you can search again any time from Opportunities." />
      )}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button asChild size="lg">
          <Link href={matches.length ? "/opportunities" : "/inbox"}>{matches.length ? "See every match" : "Go to your Inbox"}</Link>
        </Button>
        {demo ? <p className="text-base text-ink-muted">Your October plan is already waiting there.</p> : <p className="text-base text-ink-muted">Open one and start a letter of inquiry from your confirmed facts.</p>}
      </div>
    </div>
  );
}
