import type { Metadata } from "next";
import { services } from "@/lib/services";
import { PipelineView } from "./pipeline-view";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [apps, members] = await Promise.all([services.applications.list(), services.org.listMembers()]);
  return <PipelineView initial={apps} members={members} />;
}
