import type { Metadata } from "next";
import { DocumentsStep } from "./documents-step";

export const metadata: Metadata = { title: "Upload documents" };

export default function OnboardingDocumentsPage() {
  return <DocumentsStep />;
}
