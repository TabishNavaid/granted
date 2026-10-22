import type { Document } from "@/lib/types";
import type { RfpPage } from "@/lib/bids/rfp";
import { inBrowserDemo } from "./flags";

/** A file the server read but did not keep: the browser demo keeps it in the visitor's saved state. */
export interface ParsedUpload {
  type: Document["type"];
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  text: string;
  /** Page by page, for a solicitation or résumé whose requirements cite their page. */
  pages: RfpPage[] | null;
}

type UploadBody = { ok: boolean; error?: string; document?: Document; parsed?: ParsedUpload; extraction?: { ok: boolean; factCount?: number; error?: string }; pages?: number };

/** Post a file to an upload route. In the browser demo the route only reads it, and the document is stored here. */
export async function postUpload(route: "/api/documents/upload" | "/api/segments/upload", form: FormData): Promise<{ httpOk: boolean; body: UploadBody | null }> {
  // The real product stores files straight from the browser in the workspace's private folder, then the route reads it there.
  const file = form.get("file");
  if (!inBrowserDemo() && file instanceof File) {
    const sign = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }) });
    const signed = (await sign.json().catch(() => null)) as { mode?: "direct" | "form"; path?: string; signedUrl?: string; apikey?: string; error?: string } | null;
    if (!sign.ok) return { httpOk: false, body: { ok: false, error: signed?.error ?? "We could not start the upload. Try again." } };
    if (signed?.mode === "direct" && signed.path && signed.signedUrl) {
      const put = await fetch(signed.signedUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false", ...(signed.apikey ? { apikey: signed.apikey } : {}) }, body: file });
      if (!put.ok) return { httpOk: false, body: { ok: false, error: "The file did not reach storage. Check your connection and try again." } };
      const res = await fetch(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storagePath: signed.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, type: String(form.get("type") ?? "") }) });
      return { httpOk: res.ok, body: (await res.json().catch(() => null)) as UploadBody | null };
    }
  }
  const res = await fetch(route, { method: "POST", body: form });
  // Vercel refuses request bodies over 4.5 MB before the route sees them.
  if (res.status === 413) return { httpOk: false, body: { ok: false, error: "That file is too large to upload here (the limit is 4.5 MB). Upload the main document on its own, or split it." } };
  const body = (await res.json().catch(() => null)) as UploadBody | null;
  if (res.ok && body?.ok && body.parsed && inBrowserDemo()) {
    const { storeUpload } = await import("./runtime");
    return { httpOk: true, body: { ...body, document: await storeUpload(body.parsed) } };
  }
  return { httpOk: res.ok, body };
}
