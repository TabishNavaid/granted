import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const DEMO_HREF = "/onboarding";
export const DEMO_LABEL = "Try the demo with a sample organization";
export const DEMO_NOTE = "The demo runs on a fictional organization and recorded runs. No sign-up.";

/**
 * The two calls to action on marketing pages: start for real, or try the
 * public demo. The demo button can wrap on a phone, so it never overflows.
 * `note` is an extra line shown before the demo line, such as "Free to start."
 * An audience page can name its own sign-up and demo labels and demo line.
 */
export function DemoCta({
  primary = true,
  note,
  className,
  signUpLabel = "Start free",
  demoLabel = DEMO_LABEL,
  demoNote = DEMO_NOTE,
}: {
  primary?: boolean;
  note?: string;
  className?: string;
  signUpLabel?: string;
  demoLabel?: string;
  demoNote?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        {primary ? (
          <Button asChild size="lg">
            <Link href="/sign-up">{signUpLabel}</Link>
          </Button>
        ) : null}
        <Button asChild size="lg" variant="secondary" className="h-auto min-h-12 max-w-full whitespace-normal py-2.5 text-center">
          <Link href={DEMO_HREF}>{demoLabel}</Link>
        </Button>
      </div>
      {note ? <p className="mt-3 text-sm text-ink-muted">{note}</p> : null}
      <p className={cn("text-sm text-ink-muted", note ? "mt-1" : "mt-3")}>{demoNote}</p>
    </div>
  );
}

/** The closing block on every marketing subpage: one headline and the two calls to action. */
export function ClosingCta({
  title = "See it on a sample organization.",
  lead,
  note = "Free to start, with no card.",
  ...labels
}: {
  title?: string;
  lead?: string;
  /** The line above the demo line; null leaves it out. */
  note?: string | null;
  signUpLabel?: string;
  demoLabel?: string;
  demoNote?: string;
}) {
  return (
    <section className="border-t border-rule">
      <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <h2 className="max-w-[18ch] font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{title}</h2>
        {lead ? <p className="mt-5 max-w-[52ch] text-lg text-ink-muted">{lead}</p> : null}
        <DemoCta className="mt-8" note={note ?? undefined} {...labels} />
      </div>
    </section>
  );
}
