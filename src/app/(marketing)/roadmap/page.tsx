import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { ClosingCta } from "@/components/marketing/demo-cta";
import { never, next, now, type RoadmapItem } from "@/content/roadmap";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Roadmap",
  description: `What ${PRODUCT_NAME} does today, what we are building next, and what we have decided never to build.`,
  alternates: { canonical: "/roadmap" },
};

function Items({ items, strong }: { items: RoadmapItem[]; strong?: boolean }) {
  return (
    <dl className={`border-t ${strong ? "border-ink" : "border-rule"}`}>
      {items.map((i) => (
        <div key={i.title} className="grid gap-1 border-b border-rule py-5 sm:grid-cols-[15rem_1fr] sm:gap-8">
          <dt className="font-semibold text-ink">{i.title}</dt>
          <dd className="max-w-[58ch] text-base text-ink-muted">{i.body}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function RoadmapPage() {
  return (
    <>
      <PageIntro title="What exists, what is next, and what we will not build." lead="No dates. We would rather tell you when something ships than promise a month and miss it." />

      <section className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-10 lg:py-20">
        <div>
          <h2 className="font-display text-4xl text-ink sm:text-5xl">Available now</h2>
          <p className="mt-4 max-w-[34ch] text-base text-ink-muted">
            Each of these works today, in the{" "}
            <Link href="/onboarding" className="font-semibold text-ink underline underline-offset-4">
              demo
            </Link>{" "}
            and in a real workspace. The{" "}
            <Link href="/product" className="font-semibold text-ink underline underline-offset-4">
              product pages
            </Link>{" "}
            have the details.
          </p>
        </div>
        <Items items={now} strong />
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-10 lg:py-20">
          <div>
            <h2 className="font-display text-4xl text-ink sm:text-5xl">Next</h2>
            <p className="mt-4 max-w-[34ch] text-base text-ink-muted">What we are working toward, in no fixed order. Early users decide much of the order by telling us what gets in their way.</p>
          </div>
          <Items items={next} strong />
        </div>
      </section>

      <section className="bg-ink text-on-ink">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-10 lg:py-20">
          <div>
            <h2 className="max-w-[12ch] font-display text-4xl leading-[1.05] text-on-ink sm:text-5xl">What we will not build</h2>
            <p className="mt-4 max-w-[34ch] text-base text-on-ink-muted">Decided on purpose. Some of these would be easy to add and would make the product worse for the people it is for.</p>
          </div>
          <dl className="border-t border-white/20">
            {never.map((i) => (
              <div key={i.title} className="grid gap-1 border-b border-white/20 py-5 sm:grid-cols-[15rem_1fr] sm:gap-8">
                <dt className="font-semibold text-on-ink">{i.title}</dt>
                <dd className="max-w-[58ch] text-base text-on-ink-muted">{i.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <ClosingCta title="Tell us what should come next." lead="If something on the list would change your month, or something missing would, write to us from the contact page. Or try what exists today." />
    </>
  );
}
