"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { drawingOf, meadowFlowers } from "@/lib/drawings";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Drawing } from "./drawing";
import { Meadow } from "./meadow";

interface WonMeadowProps {
  orgName: string;
  funderName: string;
  amount: number | null;
  onDismiss: () => void;
}

/**
 * The one time the whole screen celebrates: a grant was won. White paper edge
 * to edge, a big crayon sun, and a full meadow growing up along the bottom,
 * flower after flower. It is a real dialog, so focus stays inside and Escape
 * closes it. With reduced motion everything is simply there.
 */
export function WonMeadow({ orgName, funderName, amount, onDismiss }: WonMeadowProps) {
  const sun = drawingOf("sun");
  const flowers = React.useMemo(() => meadowFlowers(12, funderName).map((f, i) => ({ key: `${f.slug}-${i}`, flower: f, grow: true, delayMs: 350 + ((i * 5) % 12) * 130 })), [funderName]);
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onDismiss()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto bg-paper text-ink animate-fade-in focus:outline-none" aria-describedby="won-desc">
          <div className="relative flex min-h-full flex-col">
            {sun ? <Drawing asset={sun} eager className="absolute right-[-2rem] top-[-1.5rem] h-48 w-auto animate-sun sm:right-6 sm:top-4 sm:h-72 lg:h-80" /> : null}

            <div className="relative mx-auto flex w-full max-w-[75rem] flex-1 flex-col justify-center px-4 pb-72 pt-40 sm:px-10 sm:pb-80 sm:pt-44">
              <p className="text-lg font-bold text-ink sm:text-xl">{funderName} said yes.</p>
              <DialogPrimitive.Title className="mt-2 font-display text-display text-ink">Funded.</DialogPrimitive.Title>
              {amount ? <p className="mt-4 font-display text-4xl text-ink tnum sm:text-6xl">{formatMoney(amount)}</p> : null}
              <DialogPrimitive.Description id="won-desc" className="mt-5 max-w-[46ch] text-lg text-ink-muted">
                for {orgName}. Somebody read what you wrote and said yes. A thank-you note is being drafted for your Inbox, and the first report date is on your calendar.
              </DialogPrimitive.Description>
              <div className="mt-8">
                <DialogPrimitive.Close asChild>
                  <Button size="lg">Back to the board</Button>
                </DialogPrimitive.Close>
              </div>
            </div>

            <Meadow seed={`won-${funderName}`} flowers={flowers} growGrass clumps={56} mobileMax={6} className="absolute inset-x-0 bottom-0 h-64 sm:h-80" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
