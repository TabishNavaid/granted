import { registerIntegrationsServer } from "./mock";
import { registerCatalogBackend } from "@/lib/grantsgov";

/**
 * Server-only wiring, done once per process: integrations that use Node APIs, and the opportunity database
 * reader. Imported by the server action module and by the job runner, never by browser code.
 */
const g = globalThis as typeof globalThis & { __fundfellowsServerInit?: boolean };
if (!g.__fundfellowsServerInit) {
  g.__fundfellowsServerInit = true;
  registerIntegrationsServer(() => import("./mock-integrations-server"));
  registerCatalogBackend(() => import("@/lib/catalog/app"));
}
