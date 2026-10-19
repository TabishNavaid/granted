import type { Metadata } from "next";
import { AudiencePageView } from "@/components/marketing/audience-page";
import { audiencePage } from "@/content/audience-pages";

const a = audiencePage("architecture-and-construction");

export const metadata: Metadata = { title: a.metaTitle, description: a.metaDescription, alternates: { canonical: "/for/architecture-and-construction" } };

export default function ArchitectureAndConstructionPage() {
  return <AudiencePageView page={a} />;
}
