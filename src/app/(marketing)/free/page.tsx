import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/marketing/page-intro";
import { EMAIL, PRODUCT_NAME } from "@/lib/brand";
import { USAGE_LIMITS } from "@/lib/usage/limits";

export const metadata: Metadata = {
  title: "Free while we learn",
  description: `${PRODUCT_NAME} is free during early access: no paid plan, no card, no trial that runs out.`,
  alternates: { canonical: "/free" },
};

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "Why it is free",
    body: [
      "We want to learn whether this is truly useful before we ask anyone to pay for it. Charging now would make it harder to hear what is wrong, and harder for a small nonprofit or a student to try it at all.",
    ],
  },
  {
    heading: "What you get",
    body: [
      "Everything: the opportunity database, matching, drafting from your own documents, the compliance matrix and SF 330 for bids, the deadline calendar, exports, and your whole team.",
    ],
  },
  {
    heading: "The one limit",
    body: [
      `Each workspace can run ${USAGE_LIMITS.draft} drafts and ${USAGE_LIMITS.assist} other AI steps a month. That covers what the AI model behind ${PRODUCT_NAME} costs us. Searching the opportunity database, the calendar, and exports never count. Settings shows what you have used, and the count starts again on the first of each month.`,
      `If you need more in a given month, write to ${EMAIL.support} and tell us what you are working on.`,
    ],
  },
  {
    heading: "If that ever changes",
    body: [
      "If we introduce paid plans, we will email every account holder at least 30 days before any charge applies. Nothing is charged without your agreement, and you can export your work at any time.",
    ],
  },
];

export default function FreePage() {
  return (
    <>
      <PageIntro title="Free while we learn." lead={`${PRODUCT_NAME} costs nothing during early access. There is no paid plan, no card on file, and no trial that runs out.`} />
      <section className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <div className="max-w-3xl border-t border-rule">
          {sections.map((s) => (
            <div key={s.heading} className="grid gap-3 border-b border-rule py-8 md:grid-cols-[14rem_1fr] md:gap-10">
              <h2 className="font-display text-2xl text-ink">{s.heading}</h2>
              <div className="flex flex-col gap-3">
                {s.body.map((p) => (
                  <p key={p} className="max-w-[60ch] text-base text-ink">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/sign-up">Create a free workspace</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/onboarding">Try the demo first</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
