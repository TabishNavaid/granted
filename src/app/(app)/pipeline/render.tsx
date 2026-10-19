import { services } from "@/lib/services";
import { ORG_TYPES } from "@/lib/segments";
import { PipelineView } from "./pipeline-view";

export default async function PipelinePage() {
  const [apps, members, org] = await Promise.all([services.applications.list(), services.org.listMembers(), services.org.get()]);
  // The board uses the stages of the kind this applicant mostly pursues: bids for firms, research funding for labs.
  return <PipelineView initial={apps} members={members} orgName={org.name} kind={ORG_TYPES[org.orgType ?? "nonprofit"].kinds[0]} />;
}
