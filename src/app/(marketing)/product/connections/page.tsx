import type { Metadata } from "next";
import { CapabilityPage } from "@/components/marketing/capability-page";
import { capability } from "@/content/product";

const c = capability("connections");

export const metadata: Metadata = { title: c.name, description: c.metaDescription, alternates: { canonical: "/product/connections" } };

export default function ConnectionsPage() {
  return <CapabilityPage capability={c} />;
}
