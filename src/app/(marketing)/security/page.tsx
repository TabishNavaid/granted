import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/marketing/page-intro";
import { securitySections } from "@/content/site";

export const metadata: Metadata = { title: "Security and privacy", description: "Where your data lives, who can see it, how AI providers are used, and why a person approves everything.", alternates: { canonical: "/security" } };

export default function SecurityPage() {
  return (
    <>
      <PageIntro title="How we handle your data." lead="Plain answers to the questions a board asks before letting a new tool near the organization's documents." />
      <Prose sections={securitySections} />
    </>
  );
}
