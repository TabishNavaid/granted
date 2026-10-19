import type { Metadata } from "next";
import { services } from "@/lib/services";
import { AnalyticsView } from "./analytics-view";

export const metadata: Metadata = { title: "Win analytics" };

export default async function AnalyticsPage() {
  const summary = await services.analytics.summary();
  return <AnalyticsView data={summary} />;
}
