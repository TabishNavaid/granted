import type { Metadata } from "next";
import { CapabilityPage } from "@/components/marketing/capability-page";
import { capability } from "@/content/product";

const c = capability("matching");

export const metadata: Metadata = { title: c.name, description: c.metaDescription, alternates: { canonical: "/product/matching" } };

export default function MatchingPage() {
  return <CapabilityPage capability={c} />;
}
