import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { services } from "@/lib/services";
import { WebsiteStep } from "./website-step";

export const metadata: Metadata = { title: "Setup" };

const resume: Record<string, string> = { ein: "/onboarding/ein", reading: "/onboarding/reading", profile: "/onboarding/profile", gaps: "/onboarding/gaps", matches: "/onboarding/matches" };

/** The first question. A returning user is sent to the step they left on. */
export default async function OnboardingStartPage({ searchParams }: { searchParams: Promise<{ restart?: string }> }) {
  const [{ restart }, org, demo] = await Promise.all([searchParams, services.org.get(), services.demo.status()]);
  if (!restart && org.onboardingStep !== "start" && org.onboardingStep !== "done" && resume[org.onboardingStep]) redirect(resume[org.onboardingStep]);
  return <WebsiteStep initialUrl={org.onboardingStep === "done" || demo.active ? "" : org.websiteUrl} demo={demo.active ? { samples: demo.samples } : null} />;
}
