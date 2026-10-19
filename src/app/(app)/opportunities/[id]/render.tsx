import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { OpportunityDetail } from "./opportunity-detail";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, match, applications] = await Promise.all([
    services.opportunities.getOpportunity(id),
    services.opportunities.getMatchByOpportunity(id),
    services.applications.list(),
  ]);
  if (!data) notFound();
  const application = applications.find((a) => a.opportunityId === id) ?? null;
  // The suggested ask: from the application when there is one (it knows the budget and past wins), else from the funder's typical grants.
  const recommendedAsk = application
    ? await services.applications.recommendAsk(application.id).catch(() => null)
    : await services.funders
        .get(data.funder.id)
        .then((p) => p?.recommendedAsk ?? null)
        .catch(() => null);
  return <OpportunityDetail opportunity={data.opportunity} funder={data.funder} contacts={data.contacts} match={match} application={application} recommendedAsk={recommendedAsk} />;
}
