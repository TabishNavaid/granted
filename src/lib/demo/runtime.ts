import { mockServices } from "@/lib/services/mock";
import { saveDemoSession, setDemoBusy } from "@/lib/services/demo-session";
import type { Services } from "@/lib/services/contracts";

/**
 * The browser demo's service calls. Runs the same in-memory adapter the
 * server used to run, in this tab, and saves the visitor's workspaces after
 * every call. Arguments and results are copied, as a server call would, so a
 * screen can never change the saved state by holding on to an object.
 */
let inFlight = 0;

export async function call(domain: keyof Services, method: string, args: unknown[]): Promise<unknown> {
  const svc = mockServices[domain] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const fn = svc[method];
  if (typeof fn !== "function") throw new Error(`Unknown service method ${domain}.${method}`);
  inFlight++;
  setDemoBusy(true);
  try {
    const out = await fn.apply(svc, structuredClone(args));
    return out === undefined ? out : structuredClone(out);
  } finally {
    // Saved only when nothing is running, so a reload never lands halfway through a run.
    if (--inFlight === 0) {
      setDemoBusy(false);
      saveDemoSession();
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (inFlight === 0) saveDemoSession();
  });
}

/** Keep a file the server read (see ./upload.ts) as a document in this browser's workspace. */
export async function storeUpload(p: import("./upload").ParsedUpload): Promise<import("@/lib/types").Document> {
  const [{ state, newId, now }, { rememberDocumentPages }] = await Promise.all([import("@/lib/services/mock"), import("@/lib/services/mock-segments")]);
  const doc = { id: newId("doc"), orgId: state.org.id, type: p.type, title: p.title, fileName: p.fileName, mimeType: p.mimeType, sizeBytes: p.sizeBytes, status: "ready" as const, pageCount: p.pageCount, factCount: 0, uploadedAt: now() };
  state.documents.unshift(doc);
  state.documentTexts[doc.id] = p.text;
  if (p.pages) rememberDocumentPages(doc.id, p.fileName, p.pages);
  if (inFlight === 0) saveDemoSession();
  return structuredClone(doc);
}
