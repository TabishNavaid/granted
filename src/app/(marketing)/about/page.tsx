import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/marketing/page-intro";
import { SectionHeading } from "@/components/marketing/section-heading";
import { founderNote } from "@/content/site";
import { fullFaq } from "@/content/faq";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: `Why ${PRODUCT_NAME} exists, a note from the founders, and plain answers about data, accuracy, AI, sending, privacy, price, and who it is for.`,
  alternates: { canonical: "/about" },
};

const mission = [
  "Small nonprofits apply for the same grants as organizations with a development office. The process assumes someone has a free week to research funders and write. At a small nonprofit, that someone is usually the director, working after hours.",
  `${PRODUCT_NAME} is a funding team for organizations that cannot hire one. It reads what you have already written, finds grants you can apply for, drafts from your own facts, and keeps the dates. You make the calls. A person approves every draft, and every claim links to its source.`,
  "We are building it with a small group of early users and changing it when they tell us something is wrong.",
];

export default function AboutPage() {
  return (
    <>
      <PageIntro title="Grant work for the people doing the work." lead="For small nonprofits without a grant writer. It does the research and the first draft, and a person approves every step." />
      <section className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-20">
        <h2 className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">What we are for</h2>
        <div className="mt-6 max-w-[62ch] lg:mt-0">
          {mission.map((p) => (
            <p key={p} className="mt-4 text-lg text-ink first:mt-0">
              {p}
            </p>
          ))}
        </div>
      </section>
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-20">
          <div>
            <h2 className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">{founderNote.heading}</h2>
            <p className="mt-3 text-sm text-ink-muted">Draft. Square brackets mark details the founders fill in.</p>
          </div>
          <div className="mt-6 max-w-[62ch] lg:mt-0">
            {founderNote.paragraphs.map((p) => (
              <p key={p} className="mt-4 text-lg text-ink first:mt-0">
                {p}
              </p>
            ))}
            <p className="mt-6 text-lg text-ink">{founderNote.signoff}</p>
          </div>
        </div>
      </section>

      <section id="questions" className="scroll-mt-16 border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading plant="wind-poppy" className="max-w-[12ch] text-4xl sm:text-5xl">
              Questions, answered plainly.
            </SectionHeading>
            <p className="mt-5 max-w-[36ch] text-base text-ink-muted">
              Something missing? The{" "}
              <Link href="/security" className="font-semibold text-ink underline underline-offset-4">
                security page
              </Link>{" "}
              covers data handling in more detail, and you can{" "}
              <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">
                write to us
              </Link>
              .
            </p>
          </div>
          <div className="mt-10 lg:mt-0">
            {fullFaq.map((g) => (
              <div key={g.group} className="mt-12 first:mt-0">
                <h3 className="font-display text-2xl text-ink">{g.group}</h3>
                <div className="mt-4 border-t border-ink">
                  {g.items.map((f) => (
                    <details key={f.q} className="group border-b border-rule py-5">
                      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 rounded-sm font-display text-xl text-ink [&::-webkit-details-marker]:hidden">
                        {f.q}
                        <span className="font-body text-base text-ink-muted group-open:hidden" aria-hidden>
                          Show
                        </span>
                        <span className="hidden font-body text-base text-ink-muted group-open:inline" aria-hidden>
                          Hide
                        </span>
                      </summary>
                      <p className="mt-3 max-w-[60ch] text-base text-ink-muted">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6 lg:px-10">
          <p className="max-w-[40ch] text-lg text-ink">Questions, or an organization that should try it first?</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/contact">Write to us</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/onboarding">Try the demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
