import type { Metadata } from "next";
import { InterviewStep } from "./interview-step";

export const metadata: Metadata = { title: "Short interview" };

export default function OnboardingInterviewPage() {
  return <InterviewStep />;
}
