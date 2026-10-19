import type { Metadata } from "next";
import { CapabilityPage } from "@/components/marketing/capability-page";
import { capability } from "@/content/product";

const c = capability("deadlines");

export const metadata: Metadata = { title: c.name, description: c.metaDescription, alternates: { canonical: "/product/deadlines" } };

export default function DeadlinesPage() {
  return <CapabilityPage capability={c} />;
}
