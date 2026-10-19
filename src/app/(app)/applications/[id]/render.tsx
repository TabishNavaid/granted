import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { Workspace } from "./workspace";
import { BidHub } from "@/components/bids/bid-hub";

/** A bid opens on its hub (decision, matrix, team, fee, addenda, SF 330); everything else opens on the draft. */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await services.applications.get(id);
  if (!app) notFound();
  const [members, org, runtime, me] = await Promise.all([services.org.listMembers(), services.org.get(), services.loop.runtime(), services.org.currentUser()]);
  if (app.mode === "bid" || app.mode === "sf330") {
    const [bid, sf330, workspace, milestones] = await Promise.all([services.bids.get(id), services.bids.sf330(id), services.applications.getWorkspace(id), services.calendar.listMilestones(id)]);
    if (!bid) notFound();
    return <BidHub initial={bid} sf330={sf330} sections={workspace?.sections ?? []} milestones={milestones} demo={runtime.demo} role={me.role} />;
  }
  const [workspace, reviewer, budget] = await Promise.all([services.applications.getWorkspace(id), services.applications.getReviewerCheck(id), services.applications.getBudget(id)]);
  if (!workspace) notFound();
  return <Workspace initial={workspace} members={members} orgName={org.name} demo={runtime.demo && !runtime.ai} reviewer={reviewer} budget={budget} role={me.role} />;
}
