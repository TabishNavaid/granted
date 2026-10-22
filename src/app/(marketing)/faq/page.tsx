import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { fullFaq } from "@/content/faq";
import { faq } from "@/content/site";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Questions",
  description: `Plain answers about where ${PRODUCT_NAME}'s data comes from, accuracy, AI, sending, privacy, cost, and who it is for.`,
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const groups = [{ group: "The questions people ask first", items: faq }, ...fullFaq];
  const seen = new Set<string>();
  return (
    <>
      <PageIntro title="Questions, answered plainly." lead="If yours is not here, write to us and we will answer it, then add it." />
      <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        {groups.map((g) => {
          const items = g.items.filter((i) => (seen.has(i.q) ? false : (seen.add(i.q), true)));
          if (!items.length) return null;
          return (
            <section key={g.group} className="mt-14 grid gap-6 first:mt-0 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
              <h2 className="max-w-[18ch] font-display text-2xl text-ink lg:text-3xl">{g.group}</h2>
              <div className="border-t border-ink">
                {items.map((f) => (
                  <details key={f.q} className="group border-b border-rule py-5">
                    <summary className="cursor-pointer list-none text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start justify-between gap-6">
                        {f.q}
                        <span aria-hidden className="font-mono text-ink-muted group-open:hidden">+</span>
                        <span aria-hidden className="hidden font-mono text-ink-muted group-open:inline">-</span>
                      </span>
                    </summary>
                    <p className="mt-3 max-w-[62ch] text-base text-ink-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
        <p className="mt-16 max-w-[60ch] text-base text-ink-muted">
          Still have a question?{" "}
          <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">
            Write to us
          </Link>
          .
        </p>
      </div>
    </>
  );
}
