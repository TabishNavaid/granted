import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/marketing/page-intro";
import { legalNotice, privacySections } from "@/content/site";

export const metadata: Metadata = { title: "Privacy policy", description: "What we collect, how we use it, and your rights.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageIntro title="Privacy policy." lead="What we collect, why, who sees it, and how to get it deleted.">
        <p className="mt-6 inline-block border border-ink px-3 py-1.5 text-sm text-ink">{legalNotice}</p>
      </PageIntro>
      <Prose sections={privacySections} />
    </>
  );
}
