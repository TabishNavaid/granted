import type { Metadata } from "next";
import { Screenshot, type PanelTone } from "@/components/marketing/screenshot";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ClosingCta, DemoCta } from "@/components/marketing/demo-cta";
import { journey } from "@/content/journey";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "How it works",
  description: `One application from your website to a logged outcome, in eleven steps, and where you decide at each one. ${PRODUCT_NAME} drafts and plans. You approve, submit, and send.`,
  alternates: { canonical: "/how-it-works" },
};

const tones: PanelTone[] = ["sage", "mist", "cream"];

/** Panel colors alternate across the steps that have a screenshot. */
const toneFor = (() => {
  const map = new Map<number, PanelTone>();
  let n = 0;
  journey.forEach((s, i) => {
    if (s.shot) map.set(i, tones[n++ % tones.length]);
  });
  return map;
})();

export default function HowItWorksPage() {
  return (
    <div className="overflow-x-clip">
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 pb-14 pt-14 sm:px-6 lg:px-10 lg:pb-20 lg:pt-20">
          <SectionHeading as="h1" className="max-w-[15ch] text-[clamp(2.6rem,1.5rem+3.6vw,4.5rem)] leading-[1.02]">
            From your website to a funded grant.
          </SectionHeading>
          <p className="mt-6 max-w-[58ch] text-lg text-ink sm:text-xl">
            Eleven steps. {PRODUCT_NAME} does the reading, the first drafts, and the planning. At every step there is a point where you decide, and nothing goes further until you do.
          </p>
          <DemoCta className="mt-8" />
        </div>
      </section>

      <section>
        <ol className="mx-auto max-w-[75rem] px-4 sm:px-6 lg:px-10">
          {journey.map((step, i) => {
            const tone = toneFor.get(i);
            return (
              <li key={step.title} className="grid gap-x-10 gap-y-6 border-b border-rule py-12 last:border-b-0 sm:grid-cols-[4.5rem_1fr] lg:grid-cols-[5.5rem_1.2fr_1fr] lg:py-16">
                <span className="font-display text-6xl leading-[0.85] tracking-[-0.03em] text-fellow tnum lg:text-7xl" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h2 className="max-w-[20ch] font-display text-3xl text-ink lg:text-4xl">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h2>
                  <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">{step.does}</p>
                </div>
                <div className="border-l-2 border-fellow pl-5 sm:col-start-2 lg:col-start-3 lg:mt-2 lg:self-start">
                  <p className="font-semibold text-ink">You decide</p>
                  <p className="mt-1 max-w-[44ch] text-lg text-ink">{step.you}</p>
                </div>
                {step.shot && tone ? (
                  <div className="sm:col-[2/-1] lg:mt-4">
                    <Screenshot name={step.shot.name} alt={step.shot.alt} tone={tone} sizes="(min-width: 1200px) 1000px, 100vw" />
                    <p className="mt-4 text-sm text-ink-muted">{step.shot.caption}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <ClosingCta title="Walk through it on a sample organization." lead="The demo walks through these steps with a fictional youth program and recorded runs. Nothing you do there is sent anywhere." />
    </div>
  );
}
