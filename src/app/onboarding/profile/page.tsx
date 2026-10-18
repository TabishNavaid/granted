import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ProfileStep } from "./profile-step";

export const metadata: Metadata = { title: "Confirm your profile" };

export default async function OnboardingProfilePage() {
  const [org, facts, documents, runtime] = await Promise.all([services.org.get(), services.knowledge.listFacts(), services.knowledge.listDocuments(), services.loop.runtime()]);
  const real = !(runtime.demo && !runtime.ai);
  // In the demo, the screen shows confirmed seed facts. For a real site it shows what we just read, waiting on the user.
  const pending = facts.filter((f) => f.status === "needs_review" && f.sourceLabel !== "You");
  const shown = real ? (pending.length ? pending : facts.filter((f) => f.status === "confirmed")) : facts.filter((f) => f.status === "confirmed").slice(0, 10);
  return <ProfileStep org={org} facts={shown} documents={documents} real={real} alreadyConfirmed={real && pending.length === 0} />;
}
