import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { OpportunityCard } from "@/components/app/opportunity-card";

export const metadata: Metadata = { title: "Your first matches" };

export default async function OnboardingMatchesPage() {
  const matches = (await services.opportunities.listMatches()).slice(0, 3);
  return (
    <div>
      <h1 className="font-display text-h1 text-ink">Three places to start.</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">
        We looked at 412 opportunities and kept only the ones you can actually apply for. These three are the strongest fits. The rest are waiting in Opportunities, and new ones arrive every Monday.
      </p>
      <ul className="mt-8 border-b border-rule">
        {matches.map((m) => (
          <li key={m.id}>
            <OpportunityCard match={m} />
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button asChild size="lg">
          <Link href="/inbox">Go to your Inbox</Link>
        </Button>
        <p className="text-base text-ink-muted">Your October plan is already waiting there.</p>
      </div>
    </div>
  );
}
