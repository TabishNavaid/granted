import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { Workspace } from "./workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const app = await services.applications.get(id);
  return { title: app ? `${app.opportunity.title} draft` : "Proposal" };
}

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workspace, members] = await Promise.all([services.applications.getWorkspace(id), services.org.listMembers()]);
  if (!workspace) notFound();
  return <Workspace initial={workspace} members={members} />;
}
