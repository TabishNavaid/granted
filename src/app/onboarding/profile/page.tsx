import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ProfileStep } from "./profile-step";

export const metadata: Metadata = { title: "Confirm your profile" };

export default async function OnboardingProfilePage() {
  const [org, facts, documents] = await Promise.all([services.org.get(), services.knowledge.listFacts(), services.knowledge.listDocuments()]);
  return <ProfileStep org={org} facts={facts.filter((f) => f.status === "confirmed").slice(0, 10)} documents={documents} />;
}
