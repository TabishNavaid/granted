import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/marketing/page-intro";
import { founderNote } from "@/content/site";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "About", description: `Why ${PRODUCT_NAME} exists, and a note from the founders.`, alternates: { canonical: "/about" } };

const mission = [
  "Small nonprofits do most of the community work in this country with the least administrative help. The grant money that would let them hire, feed, teach, and heal more people sits behind a process built for organizations with a development office.",
  `${PRODUCT_NAME} is a funding team for organizations that cannot hire one. It reads what you have already written, finds what you can apply for, drafts in your own facts, and keeps the dates. The judgment stays with you: every draft is approved by a person, and every claim links to its source.`,
  "We are building it in the open with early users and would rather be useful to fifty organizations than impressive to fifty thousand.",
];

export default function AboutPage() {
  return (
    <>
      <PageIntro title="Grant work for the people doing the work." lead="A done-for-you funding team for small nonprofits, with a person approving every step." />
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
      <section className="border-t-2 border-ink">
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
      <section className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6 lg:px-10">
          <p className="max-w-[40ch] text-lg text-ink">Questions, or an organization that should try it first?</p>
          <Button asChild variant="secondary">
            <Link href="/contact">Write to us</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
