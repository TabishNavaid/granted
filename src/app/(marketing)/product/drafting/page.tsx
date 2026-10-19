import type { Metadata } from "next";
import { CapabilityPage } from "@/components/marketing/capability-page";
import { capability } from "@/content/product";

const c = capability("drafting");

export const metadata: Metadata = { title: c.name, description: c.metaDescription, alternates: { canonical: "/product/drafting" } };

export default function DraftingPage() {
  return <CapabilityPage capability={c} />;
}
