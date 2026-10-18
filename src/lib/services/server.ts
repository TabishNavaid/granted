"use server";

import { mockServices } from "./mock";
import type { Services } from "./contracts";

type Domain = keyof Services;

/**
 * Single server action that every client-side service call goes through.
 * This keeps one copy of mock state (in the server process) so that a change
 * made in a client component shows up on the next server render.
 * The Supabase adapter replaces `mockServices` here and nowhere else.
 */
export async function invoke(domain: Domain, method: string, args: unknown[]): Promise<unknown> {
  const svc = mockServices[domain] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const fn = svc[method];
  if (typeof fn !== "function") throw new Error(`Unknown service method ${domain}.${method}`);
  return fn.apply(svc, args);
}
