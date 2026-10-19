import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { ClosingCta } from "@/components/marketing/demo-cta";
import { audiences } from "@/content/audiences";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Who it's for",
  description: `${PRODUCT_NAME} for small nonprofits, grant consultants, fiscal sponsors, architecture and construction firms, research teams, and scholarship seekers: the problem each one has, how it helps, and what is limited today.`,
  alternates: { canonical: "/who-its-for" },
};

export default function WhoItsForPage() {
  return (
    <>
      <PageIntro title="Who it is for, and what it cannot do yet." lead="Six kinds of applicants use it. For each, the problem in their own terms, how it helps, and honestly what is limited today.">
        <nav aria-label="On this page" className="mt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-base">
            {audiences.map((a) => (
              <li key={a.id}>
                <a href={`#${a.id}`} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                  {a.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageIntro>

      {audiences.map((a, i) => (
        <section key={a.id} id={a.id} className="scroll-mt-20 border-b border-rule last:border-b-0">
          <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
              <div>
                <p className="font-display text-6xl leading-[0.85] tracking-[-0.03em] text-meadow tnum" aria-hidden>
                  {i + 1}
                </p>
                <h2 className="mt-5 font-display text-4xl text-ink sm:text-5xl">{a.name}</h2>
                <Link href={a.page.href} className="mt-5 inline-block max-w-[34ch] text-base font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                  {a.page.label}
                </Link>
              </div>
              <div>
                <p className="max-w-[30ch] font-display text-2xl leading-snug text-ink sm:text-3xl">{a.heading}</p>
                {a.problem.map((p) => (
                  <p key={p} className="mt-5 max-w-[60ch] text-lg text-ink-muted">
                    {p}
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-12 lg:gap-20 lg:mt-16">
              <div>
                <h3 className="font-display text-2xl text-ink">How it helps</h3>
                <ul className="mt-4 border-t border-ink">
                  {a.helps.map((h) => (
                    <li key={h} className="border-b border-rule py-3.5 text-base text-ink">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-display text-2xl text-ink">What is limited today</h3>
                <ul className="mt-4 border-t border-ink">
                  {a.limits.map((l) => (
                    <li key={l} className="border-b border-rule py-3.5 text-base text-ink">
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      ))}

      <ClosingCta title="Try it on a sample organization first." />
    </>
  );
}
