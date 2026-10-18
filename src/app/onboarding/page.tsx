import type { Metadata } from "next";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Setup" };

export default function OnboardingStartPage() {
  return <StartForm />;
}
