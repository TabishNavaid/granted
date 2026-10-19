import type { Metadata } from "next";
import { demoPage } from "@/lib/demo/page";
import render from "./render";
import { services } from "@/lib/services";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await services.opportunities.getOpportunity(id).catch(() => null);
  return { title: data ? data.opportunity.title : "Opportunity" };
}

export default demoPage("opportunity", render);
