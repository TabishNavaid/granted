import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { services } from "@/lib/services";
import { ReadingStep } from "./reading-step";

export const metadata: Metadata = { title: "Reading your website" };

export default async function ReadingPage() {
  const org = await services.org.get();
  if (!org.websiteUrl) redirect("/onboarding");
  return <ReadingStep websiteUrl={org.websiteUrl} ein={org.ein || null} />;
}
