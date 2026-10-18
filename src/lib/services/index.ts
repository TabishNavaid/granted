import { invoke } from "./server";
import type { Services } from "./contracts";

/**
 * The data layer the UI talks to. Every call is forwarded to the server
 * (a direct function call during server rendering, a server action from the
 * browser). Swapping mocks for Supabase touches only ./server.ts.
 */
function domain<D extends keyof Services>(name: D): Services[D] {
  return new Proxy({} as Services[D], {
    get: (_target, method: string) => (...args: unknown[]) => invoke(name, method, args),
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
  billing: domain("billing"),
  auth: domain("auth"),
  loop: domain("loop"),
};

export type { Services } from "./contracts";
