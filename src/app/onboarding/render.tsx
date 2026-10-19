import { redirect } from "next/navigation";
import { services } from "@/lib/services";
import { WebsiteStep } from "./website-step";
import { TypeStep } from "./type-step";
import { ResumeStep } from "./resume-step";

const resume: Record<string, string> = { ein: "/onboarding/ein", reading: "/onboarding/reading", profile: "/onboarding/profile", gaps: "/onboarding/gaps", matches: "/onboarding/matches" };

/** The first question is who is applying; then a website, or a résumé for one person. A returning user is sent to the step they left on. */
export default async function OnboardingStartPage({ searchParams }: { searchParams: Promise<{ restart?: string; type?: string }> }) {
  const [{ restart, type }, org, demo] = await Promise.all([searchParams, services.org.get(), services.demo.status()]);
  if (!restart && org.onboardingStep !== "start" && org.onboardingStep !== "type" && org.onboardingStep !== "done" && resume[org.onboardingStep]) redirect(resume[org.onboardingStep]);
  if (demo.active && type === "nonprofit") return <WebsiteStep initialUrl="" demo={{ samples: demo.samples.filter((s) => s.orgType === "nonprofit") }} orgType="nonprofit" />;
  if (restart || org.onboardingStep === "start" || org.onboardingStep === "done") return <TypeStep initial={org.orgType ?? "nonprofit"} samples={demo.active ? demo.samples : null} />;
  if (org.orgType === "individual") return <ResumeStep demo={demo.active} />;
  const samples = demo.samples.filter((s) => s.orgType === (org.orgType ?? "nonprofit"));
  return <WebsiteStep initialUrl={demo.active ? "" : org.websiteUrl} demo={demo.active ? { samples } : null} orgType={org.orgType ?? "nonprofit"} />;
}
