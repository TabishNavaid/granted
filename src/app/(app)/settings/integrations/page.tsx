import type { Metadata } from "next";
import { services } from "@/lib/services";
import { IntegrationsView } from "./integrations-view";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; provider?: string }> }) {
  const [params, status, connections, runtime] = await Promise.all([searchParams, services.integrations.status(), services.integrations.connections(), services.loop.runtime()]);
  return <IntegrationsView status={status} connections={connections} demo={runtime.demo} notice={params.connected ? { kind: "connected", provider: params.connected } : params.error ? { kind: "error", code: params.error, provider: params.provider ?? "" } : null} />;
}
