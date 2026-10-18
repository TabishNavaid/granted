import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/marketing/page-intro";
import { pricingFaq, pricingTiers } from "@/content/site";

export const metadata: Metadata = { title: "Pricing", description: "Free to start. Starter and Growth plans priced for small nonprofits. A success-fee plan is being evaluated.", alternates: { canonical: "/pricing" } };

export default function PricingPage() {
  return (
    <>
      <PageIntro title="Simple plans, priced for small organizations." lead="Start free with your real profile. Pay only when the matches and drafts are earning their keep." />
      <section className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <div className="border-t-2 border-ink">
          {pricingTiers.map((t) => (
            <div key={t.name} className="grid gap-5 border-b border-rule py-8 lg:grid-cols-[12rem_1fr_auto] lg:items-start lg:gap-10">
              <div>
                <h2 className="font-display text-2xl text-ink">{t.name}</h2>
                <p className="mt-1 font-display text-3xl text-ink tnum">
                  {t.price}
                  {t.period ? <span className="font-body text-sm font-normal text-ink-muted"> {t.period}</span> : null}
                </p>
                <p className="mt-2 text-sm text-ink-muted">{t.who}</p>
              </div>
              <div>
                <ul className="border-t border-rule">
                  {t.includes.map((i) => (
                    <li key={i} className="border-b border-rule py-2 text-base text-ink">
                      {i}
                    </li>
                  ))}
                </ul>
                {t.note ? <p className="mt-3 max-w-[60ch] text-sm text-ink-muted">{t.note}</p> : null}
              </div>
              {t.cta ? (
                <Button asChild variant={t.name === "Starter" ? "primary" : "secondary"}>
                  <Link href="/sign-up">{t.cta}</Link>
                </Button>
              ) : (
                <span className="text-sm text-ink-muted">Coming later</span>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="border-t-2 border-ink">
        <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-20">
          <h2 className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">Plan questions</h2>
          <div className="mt-8 border-t border-rule lg:mt-0">
            {pricingFaq.map((f) => (
              <div key={f.q} className="border-b border-rule py-5">
                <h3 className="font-display text-xl text-ink">{f.q}</h3>
                <p className="mt-2 max-w-[60ch] text-base text-ink-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
