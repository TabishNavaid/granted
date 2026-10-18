import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { OpportunityDetail } from "./opportunity-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await services.opportunities.getOpportunity(id);
  return { title: data ? data.opportunity.title : "Opportunity" };
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, match, applications] = await Promise.all([
    services.opportunities.getOpportunity(id),
    services.opportunities.getMatchByOpportunity(id),
    services.applications.list(),
  ]);
  if (!data) notFound();
  const application = applications.find((a) => a.opportunityId === id) ?? null;
  return <OpportunityDetail opportunity={data.opportunity} funder={data.funder} contacts={data.contacts} match={match} application={application} />;
}
