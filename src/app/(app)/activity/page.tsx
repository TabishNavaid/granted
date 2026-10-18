import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ActivityView } from "./activity-view";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const [runs, documents] = await Promise.all([services.activity.listRuns(), services.knowledge.listDocuments()]);
  return <ActivityView runs={runs} documents={documents} />;
}
