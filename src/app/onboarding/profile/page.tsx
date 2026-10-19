import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ProfileStep } from "./profile-step";

export const metadata: Metadata = { title: "Confirm your profile" };

export default async function OnboardingProfilePage() {
  const [org, facts, documents] = await Promise.all([services.org.get(), services.knowledge.listFacts(), services.knowledge.listDocuments()]);
  // What we just read, waiting on the director. The demo's recorded runs land here the same way.
  const pending = facts.filter((f) => f.status === "needs_review" && f.sourceLabel !== "You");
  const shown = pending.length ? pending : facts.filter((f) => f.status === "confirmed");
  return <ProfileStep org={org} facts={shown} documents={documents} real alreadyConfirmed={pending.length === 0} />;
}
