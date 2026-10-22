import { invoke } from "./server";
import { inBrowserDemo } from "@/lib/demo/flags";
import type { Services } from "./contracts";

/**
 * The data layer the UI talks to. Every call is forwarded to the server
 * (a direct function call during server rendering, a server action from the
 * browser), except in the demo with no keys, where it runs in the browser on
 * the visitor's saved state (src/lib/demo). Swapping mocks for Supabase
 * touches only ./server.ts.
 */
function domain<D extends keyof Services>(name: D): Services[D] {
  return new Proxy({} as Services[D], {
    get: (_target, method: string) =>
      (...args: unknown[]) =>
        inBrowserDemo() ? import("@/lib/demo/runtime").then((rt) => rt.call(name, method, args)) : invoke(name, method, args),
  });
}

export const services: Services = {
  org: domain("org"),
  knowledge: domain("knowledge"),
  opportunities: domain("opportunities"),
  applications: domain("applications"),
  inbox: domain("inbox"),
  calendar: domain("calendar"),
  activity: domain("activity"),
  account: domain("account"),
  jobs: domain("jobs"),
  auth: domain("auth"),
  loop: domain("loop"),
  demo: domain("demo"),
  analytics: domain("analytics"),
  funders: domain("funders"),
  copilot: domain("copilot"),
  scholarships: domain("scholarships"),
  outreach: domain("outreach"),
  contacts: domain("contacts"),
  social: domain("social"),
  integrations: domain("integrations"),
  firm: domain("firm"),
  bids: domain("bids"),
  research: domain("research"),
  person: domain("person"),
};

export type { Services, WorkspaceSummary, SampleInfo } from "./contracts";
