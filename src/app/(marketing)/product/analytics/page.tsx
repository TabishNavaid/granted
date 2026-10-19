import type { Metadata } from "next";
import { CapabilityPage } from "@/components/marketing/capability-page";
import { capability } from "@/content/product";

const c = capability("analytics");

export const metadata: Metadata = { title: c.name, description: c.metaDescription, alternates: { canonical: "/product/analytics" } };

export default function AnalyticsPage() {
  return <CapabilityPage capability={c} />;
}
