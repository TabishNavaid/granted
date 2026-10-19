import type { Metadata } from "next";
import { AudiencePageView } from "@/components/marketing/audience-page";
import { audiencePage } from "@/content/audience-pages";

const a = audiencePage("students");

export const metadata: Metadata = { title: a.metaTitle, description: a.metaDescription, alternates: { canonical: "/for/students" } };

export default function StudentsPage() {
  return <AudiencePageView page={a} />;
}
