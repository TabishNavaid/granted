import Link from "next/link";
import type { MatchView } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FitScore, fitLabel } from "./fit-score";
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
  local_government: "Local government",
  university: "University",
  private_owner: "Private owner",
};

/**
 * Checks that are notes rather than verdicts: the agency's own eligibility text to read, a notice that is not open
 * yet, or a filing that does not say whether the foundation takes applications. Failing one does not rule you out.
 */
const INFORMATIONAL_CHECK = /^(Agency's own eligibility note|Not open yet|Applications not ruled out)/;

/** Eligibility checks that failed and would rule the organization out, as opposed to notes to read. */
export function hardEligibilityFails(match: Pick<MatchView, "eligibilityChecks">) {
  return match.eligibilityChecks.filter((c) => !c.passed && !INFORMATIONAL_CHECK.test(c.label));
}

/** One funder, as a row on a list. Hairlines between rows, no card. */
export function OpportunityCard({ match, className }: { match: MatchView; className?: string }) {
  const { opportunity, funder } = match;
  const dl = deadlineLabel(opportunity.deadline);
  const failed = hardEligibilityFails(match);
  const toRead = match.eligibilityChecks.filter((c) => !c.passed && INFORMATIONAL_CHECK.test(c.label));
  const privateFoundation = funder.type === "private_foundation" || opportunity.id.startsWith("pf_");
  return (
    <article aria-labelledby={`opp-${match.id}`} className={cn("grid gap-5 border-t border-rule py-6 sm:grid-cols-[6.5rem_1fr] sm:gap-8", className)}>
      <div className="flex items-start gap-4 sm:block">
        <FitScore score={match.fitScore} size="md" showLabel={false} />
        <p className="pt-1 text-sm font-semibold text-ink sm:pt-2">{fitLabel(match.fitScore).label}</p>
      </div>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {match.isNew ? <span className="font-semibold text-ink">New this week</span> : null}
          {match.status === "applying" ? <span className="font-semibold text-ink">In your pipeline</span> : null}
          {match.status === "saved" ? <span className="font-semibold text-ink">Saved</span> : null}
          <span>{privateFoundation ? "Private foundation" : funderTypeLabel[funder.type]}</span>
          {opportunity.forecasted ? <span>Forecasted, not open yet</span> : null}
        </p>
        <h3 id={`opp-${match.id}`} className="mt-1.5 font-display text-xl leading-tight text-ink sm:text-[1.375rem]">
          <Link href={`/opportunities/${opportunity.id}`} className="hover:underline hover:decoration-ink hover:decoration-2 hover:underline-offset-4">
            {opportunity.title}
          </Link>
        </h3>
        <p className="text-base text-ink-muted">{funder.name}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-muted">Award</dt>
            <dd className="font-semibold text-ink tnum">{formatRange(opportunity.amountMin, opportunity.amountMax)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Deadline</dt>
            <dd className="font-semibold text-ink">
              {opportunity.deadline ? formatDate(opportunity.deadline) : opportunity.forecasted ? "Not announced" : "Rolling"}
              {opportunity.deadline ? <span className={cn("ml-1.5 font-normal", dl.tone === "danger" ? "text-alert" : "text-ink-muted")}>{dl.text}</span> : null}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-ink-muted">Eligibility</dt>
            <dd className={cn("font-semibold", failed.length ? "text-alert" : "text-ink")}>{failed.length ? `${failed.length} check${failed.length === 1 ? "" : "s"} to confirm` : toRead.length ? `${toRead.length} note${toRead.length === 1 ? "" : "s"} to read` : "Looks eligible"}</dd>
          </div>
        </dl>

        <ul className="mt-4 flex max-w-[65ch] flex-col gap-1 text-base text-ink">
          {match.reasons.slice(0, 2).map((r) => (
            <li key={r} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.7rem] h-px w-3 shrink-0 bg-ink" />
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <VerifiedSource url={opportunity.sourceUrl} verifiedAt={opportunity.lastVerifiedAt} note={opportunity.sourceNote} label={opportunity.sourceNote ? "IRS filing" : undefined} />
          <Button asChild variant="secondary" size="sm">
            <Link href={`/opportunities/${opportunity.id}`}>Read the details</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
