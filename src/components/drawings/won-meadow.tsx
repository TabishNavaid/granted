"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Meadow } from "./meadow";

interface WonMeadowProps {
  orgName: string;
  funderName: string;
  amount: number | null;
  onDismiss: () => void;
}

/**
 * The one screen that celebrates: a grant was won. A full white page, the
 * news set large, and a strip of watercolor wildflowers growing up along the
 * bottom edge, one plant after another. It is a real dialog, so focus stays
 * inside and Escape closes it. With reduced motion the flowers are simply there.
 */
export function WonMeadow({ orgName, funderName, amount, onDismiss }: WonMeadowProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onDismiss()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto bg-paper text-ink animate-fade-in focus:outline-none" aria-describedby="won-desc">
          <div className="relative flex min-h-full flex-col">
            <div className="relative mx-auto flex w-full max-w-[75rem] flex-1 flex-col justify-center px-4 pb-64 pt-24 sm:px-10 sm:pb-80 sm:pt-28">
              <p className="text-lg text-ink-muted sm:text-xl">{funderName} said yes.</p>
              <DialogPrimitive.Title className="mt-3 font-display text-display text-ink">Funded.</DialogPrimitive.Title>
              {amount ? <p className="mt-4 font-display text-4xl text-ink tnum sm:text-6xl">{formatMoney(amount)}</p> : null}
              <DialogPrimitive.Description id="won-desc" className="mt-6 max-w-[46ch] text-lg text-ink-muted">
                for {orgName}. Somebody read what you wrote and said yes. A thank-you note is being drafted for your Inbox, and the first report date is on your calendar.
              </DialogPrimitive.Description>
              <div className="mt-9">
                <DialogPrimitive.Close asChild>
                  <Button size="lg">Back to the board</Button>
                </DialogPrimitive.Close>
              </div>
            </div>

            <Meadow seed={`won-${funderName}`} count={15} grow mobileMax={6} className="absolute inset-x-0 bottom-0 h-60 sm:h-80" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
