import type { Metadata } from "next";
import { services } from "@/lib/services";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Setup" };

export default async function OnboardingStartPage() {
  const runtime = await services.loop.runtime();
  return <StartForm demo={runtime.demo && !runtime.ai} />;
}
