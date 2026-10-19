import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { Workspace } from "../workspace";

/** The draft editor for any application. Bids reach it from their hub. */
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workspace, members, org, runtime, reviewer, budget, me] = await Promise.all([services.applications.getWorkspace(id), services.org.listMembers(), services.org.get(), services.loop.runtime(), services.applications.getReviewerCheck(id), services.applications.getBudget(id), services.org.currentUser()]);
  if (!workspace) notFound();
  return <Workspace initial={workspace} members={members} orgName={org.name} demo={runtime.demo && !runtime.ai} reviewer={reviewer} budget={budget} role={me.role} />;
}
