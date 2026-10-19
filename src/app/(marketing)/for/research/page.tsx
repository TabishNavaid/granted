import type { Metadata } from "next";
import { AudiencePageView } from "@/components/marketing/audience-page";
import { audiencePage } from "@/content/audience-pages";

const a = audiencePage("research");

export const metadata: Metadata = { title: a.metaTitle, description: a.metaDescription, alternates: { canonical: "/for/research" } };

export default function ResearchPage() {
  return <AudiencePageView page={a} />;
}
