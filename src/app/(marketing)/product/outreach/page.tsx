import type { Metadata } from "next";
import { CapabilityPage } from "@/components/marketing/capability-page";
import { capability } from "@/content/product";

const c = capability("outreach");

export const metadata: Metadata = { title: c.name, description: c.metaDescription, alternates: { canonical: "/product/outreach" } };

export default function OutreachPage() {
  return <CapabilityPage capability={c} />;
}
