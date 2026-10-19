"use server";

import { cookies } from "next/headers";
import { isDemoMode } from "@/lib/env";
import { mockServices } from "./mock";
import { DEMO_COOKIE, runInSession } from "./demo-session";
import type { Services } from "./contracts";

type Domain = keyof Services;

/**
 * Single server action that every client-side service call goes through.
 * DEMO_MODE (or no Supabase keys) means the in-memory mock adapter, which is
 * what the marketing demo runs on. Otherwise every call hits Supabase, scoped
 * to the signed-in user's organization.
 */
let real: Services | null = null;

async function current(): Promise<Services> {
  if (isDemoMode()) return mockServices;
  if (!real) {
    const [{ makeSupabaseServices }, { registerCacheBackend }, { supabaseCacheBackend }] = await Promise.all([import("./supabase"), import("@/lib/cache"), import("@/lib/supabase/cache-backend")]);
    registerCacheBackend(supabaseCacheBackend());
    real = makeSupabaseServices();
  }
  return real;
}

export async function invoke(domain: Domain, method: string, args: unknown[]): Promise<unknown> {
  if (isDemoMode()) {
    // Each demo visitor has their own copy of the sample workspaces.
    const sid = (await cookies()).get(DEMO_COOKIE)?.value;
    return runInSession(sid, () => call(mockServices, domain, method, args));
  }
  return call(await current(), domain, method, args);
}

function call(services: Services, domain: Domain, method: string, args: unknown[]): Promise<unknown> {
  const svc = services[domain] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const fn = svc[method];
  if (typeof fn !== "function") throw new Error(`Unknown service method ${domain}.${method}`);
  return fn.apply(svc, args);
}
