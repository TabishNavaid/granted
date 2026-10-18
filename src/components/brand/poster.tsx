import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { plates } from "@/lib/images";
import { cn } from "@/lib/utils";
import { ImageCredit, Plate } from "./duotone";
import { InkStamp, stampDate } from "./stamp";

interface WonPosterProps {
  orgName: string;
  funderName: string;
  amount: number | null;
  onDismiss?: () => void;
  className?: string;
}

/**
 * The one place the brand shouts: a grant was won. A full-width poster in
 * the WPA manner, a duotone photograph beside a two-line headline, the
 * amount, and a Funded stamp that thumps in.
 */
export function WonPoster({ orgName, funderName, amount, onDismiss, className }: WonPosterProps) {
  const image = plates.won;
  return (
    <section aria-labelledby="won-title" className={cn("sheet-raised relative grid overflow-hidden md:grid-cols-[1fr_1.15fr]", className)}>
      <Plate image={image} inks="blue-yellow" aspect="4 / 3" credit={false} sizes="(min-width: 768px) 45vw, 100vw" className="[&>div]:border-0 [&>div]:border-b [&>div]:border-ink md:[&>div]:h-full md:[&>div]:border-b-0 md:[&>div]:border-r" />
      <div className="relative flex flex-col justify-end gap-8 p-6 sm:p-10">
        <div className="pointer-events-none absolute right-5 top-5 sm:right-10 sm:top-10">
          <InkStamp label="Funded" line={stampDate()} animate size="xl" rotate={-10} />
        </div>
        <div className="pt-24 sm:pt-28">
          <p className="text-lg font-semibold text-ink">{funderName} said yes.</p>
          <h2 id="won-title" className="mt-2 font-display text-display leading-[0.9] text-ink">
            Funded.
          </h2>
          {amount ? <p className="mt-5 font-display text-4xl text-ink tnum sm:text-5xl">{formatMoney(amount)}</p> : null}
          <p className="mt-3 max-w-[40ch] text-lg text-ink-muted">for {orgName}. Somebody read what you wrote and said yes.</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-5">
          <p className="max-w-[48ch] text-sm text-ink-muted">A thank-you note is being drafted for your Inbox, and the first report date is on your calendar.</p>
          {onDismiss ? <Button onClick={onDismiss}>Back to the board</Button> : null}
        </div>
        <p className="text-xs text-ink-muted">
          <ImageCredit image={image} />
        </p>
      </div>
    </section>
  );
}
