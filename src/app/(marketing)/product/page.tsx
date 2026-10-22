import type { Metadata } from "next";
import Link from "next/link";
import { Screenshot } from "@/components/marketing/screenshot";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ClosingCta, DemoCta } from "@/components/marketing/demo-cta";
import { NeverBand } from "@/components/marketing/capability-page";
import { alsoIncluded, capabilities } from "@/content/product";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Product",
  description: `What ${PRODUCT_NAME} does: matching against Grants.gov and private foundation filings, drafts with sources, deadlines, outreach, connections, and win analytics. Every step waits for your approval.`,
  alternates: { canonical: "/product" },
};

const never = [
  "Submit an application. You click submit on the funder's portal.",
  "Send an email or publish a post on its own. Every send is your click.",
  "Name a funder that is not in Grants.gov or the IRS filings.",
  "Invent a number. A missing fact becomes a question for you.",
  "Sell your data or buy anyone else's.",
];

export default function ProductPage() {
  return (
    <div className="overflow-x-clip">
      <section>
        <div className="mx-auto max-w-[75rem] px-4 pt-14 sm:px-6 lg:px-10 lg:pt-20">
          <h1 className="max-w-[17ch] font-display text-[clamp(2.6rem,1.5rem+3.6vw,4.5rem)] leading-[1.02] text-ink">Everything between your website and a submitted application.</h1>
          <p className="mt-6 max-w-[58ch] text-lg text-ink sm:text-xl">
            {PRODUCT_NAME} is a set of agents that find grants, draft from your own facts, plan the deadlines, and prepare the emails. Each one hands its work to the Inbox, and a person approves it before anything happens.
          </p>
          <DemoCta className="mt-8" />
        </div>
        <div className="mx-auto max-w-[75rem] px-4 pt-12 sm:px-6 lg:px-10 lg:pt-16">
          <Screenshot name="inbox" tone="cream" bleed="bottom" priority sizes="(min-width: 1200px) 1120px, 100vw" alt="The Inbox: this month's plan, and the drafts, emails, and questions waiting for approval." />
          <p className="mt-4 text-sm text-ink-muted">The Inbox, on demo data. Every part of the product below sends its work here.</p>
        </div>
      </section>

      <section className="mt-16 border-t border-rule lg:mt-24">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <SectionHeading className="max-w-[16ch] text-4xl sm:text-5xl lg:text-6xl">
            Six parts, one Inbox.
          </SectionHeading>
          <ol className="mt-12 border-t border-ink lg:mt-16">
            {capabilities.map((c, i) => (
              <li key={c.slug} className="border-b border-rule">
                <Link href={`/product/${c.slug}`} className="group grid gap-3 py-8 sm:grid-cols-[3.5rem_1fr] lg:grid-cols-[3.5rem_1fr_1.3fr] lg:items-baseline lg:gap-10">
                  <span className="font-display text-4xl leading-none text-fellow tnum" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-display text-3xl text-ink underline-offset-[6px] group-hover:underline">{c.name}</span>
                    <span className="mt-2 block text-base font-semibold text-ink">More on {c.name.toLowerCase()}</span>
                  </span>
                  <span className="max-w-[56ch] text-lg text-ink-muted sm:col-start-2 lg:col-start-3">{c.summary}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
          <div>
            <h2 className="max-w-[14ch] font-display text-4xl text-ink sm:text-5xl">Also in the product</h2>
            <p className="mt-5 max-w-[36ch] text-lg text-ink-muted">The parts that hold the work together.</p>
          </div>
          <dl className="border-t border-ink">
            {alsoIncluded.map((s) => (
              <div key={s.label} className="grid gap-1 border-b border-rule py-5 sm:grid-cols-[11rem_1fr] sm:gap-8">
                <dt className="font-semibold text-ink">{s.label}</dt>
                <dd className="max-w-[58ch] text-base text-ink-muted">{s.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <NeverBand items={never} title="What it will never do" lead="These hold across every part of the product, on every plan." />

      <section className="border-b border-rule">
        <div className="mx-auto flex max-w-[75rem] flex-col gap-4 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <p className="max-w-[48ch] text-lg text-ink">Want to see one application go from a website to a logged outcome?</p>
          <Link href="/how-it-works" className="text-lg font-semibold text-ink underline decoration-[1.5px] underline-offset-4">
            Read how it works
          </Link>
        </div>
      </section>

      <ClosingCta />
    </div>
  );
}
