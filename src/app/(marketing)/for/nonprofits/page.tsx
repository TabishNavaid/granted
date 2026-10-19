import type { Metadata } from "next";
import { AudiencePageView } from "@/components/marketing/audience-page";
import { audiencePage } from "@/content/audience-pages";

const a = audiencePage("nonprofits");

export const metadata: Metadata = { title: a.metaTitle, description: a.metaDescription, alternates: { canonical: "/for/nonprofits" } };

export default function NonprofitsPage() {
  return <AudiencePageView page={a} />;
}
