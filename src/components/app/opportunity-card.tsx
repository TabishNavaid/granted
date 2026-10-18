import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import type { MatchView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FitScore } from "./fit-score";
import { VerifiedSource } from "./citation-chip";
import { deadlineLabel, formatRange, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const funderTypeLabel = {
  private_foundation: "Private foundation",
  community_foundation: "Community foundation",
  corporate: "Corporate giving",
  federal: "Federal",
  state: "State",
  family_fund: "Family fund",
};

export function OpportunityCard({ match, className }: { match: MatchView; className?: string }) {
  const { opportunity, funder } = match;
  const dl = deadlineLabel(opportunity.deadline);
  const failed = match.eligibilityChecks.filter((c) => !c.passed);
  return (
    <article
      aria-labelledby={`opp-${match.id}`}
      className={cn("flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-sm sm:flex-row sm:gap-6", className)}
    >
      <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-center sm:gap-1.5">
        <FitScore score={match.fitScore} size="md" showLabel={false} />
        <span className="text-xs font-medium text-fg-muted sm:text-center">{match.fitScore >= 80 ? "Strong fit" : match.fitScore >= 65 ? "Good fit" : "Possible fit"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {match.isNew ? <Badge variant="accent">New</Badge> : null}
          {match.status === "applying" ? <Badge variant="info">In pipeline</Badge> : null}
          {match.status === "saved" ? <Badge variant="neutral">Saved</Badge> : null}
          <Badge variant="outline">{funderTypeLabel[funder.type]}</Badge>
        </div>
        <h3 id={`opp-${match.id}`} className="mt-2 font-display text-xl leading-snug text-fg">
          <Link href={`/opportunities/${opportunity.id}`} className="hover:underline">
            {opportunity.title}
          </Link>
        </h3>
        <p className="text-sm text-fg-muted">{funder.name}</p>

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-fg-subtle">Amount</dt>
            <dd className="font-medium text-fg tnum">{formatRange(opportunity.amountMin, opportunity.amountMax)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Deadline</dt>
            <dd className="font-medium text-fg">
              {opportunity.deadline ? formatDate(opportunity.deadline) : "Rolling"}
              {opportunity.deadline ? (
                <span className={cn("ml-1.5 text-xs font-normal", dl.tone === "danger" ? "text-danger" : dl.tone === "warning" ? "text-warning" : "text-fg-subtle")}>{dl.text}</span>
              ) : null}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-fg-subtle">Eligibility</dt>
            <dd className={cn("flex items-center gap-1 font-medium", failed.length ? "text-warning" : "text-success")}>
              {failed.length ? <X className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
              {failed.length ? `${failed.length} check${failed.length === 1 ? "" : "s"} to confirm` : "You qualify"}
            </dd>
          </div>
        </dl>

        <ul className="mt-3 flex flex-col gap-1 text-sm text-fg-muted">
          {match.reasons.slice(0, 2).map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-accent" />
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <VerifiedSource url={opportunity.sourceUrl} verifiedAt={opportunity.lastVerifiedAt} />
          <Button asChild variant="secondary" size="sm">
            <Link href={`/opportunities/${opportunity.id}`}>
              Details <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
