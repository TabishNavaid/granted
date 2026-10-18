import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/marketing/page-intro";
import { legalNotice, termsSections } from "@/content/site";

export const metadata: Metadata = { title: "Terms of service", description: "The agreement between you and us when you use the service.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <>
      <PageIntro title="Terms of service." lead="The agreement between you and us, in plain language where we could manage it.">
        <p className="mt-6 inline-block border border-ink px-3 py-1.5 text-sm text-ink">{legalNotice}</p>
      </PageIntro>
      <Prose sections={termsSections} />
    </>
  );
}
