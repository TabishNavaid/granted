import { services } from "@/lib/services";
import { AnalyticsView } from "./analytics-view";

export default async function AnalyticsPage() {
  const summary = await services.analytics.summary();
  return <AnalyticsView data={summary} />;
}
