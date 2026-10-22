import { NextResponse, type NextRequest } from "next/server";

/**
 * An upload arrives either as a form with the file (the demo, and small files) or, in the real product, as the
 * path of a file the browser already put in the workspace's folder in storage. Either way: the bytes and names.
 */
export type IncomingFile = { buffer: Buffer; fileName: string; mimeType: string; sizeBytes: number; type: string; storagePath: string | null };

export async function incomingFile(request: NextRequest, maxBytes: number, orgId: string | null): Promise<IncomingFile | { error: NextResponse }> {
  const fail = (error: string, status = 400) => ({ error: NextResponse.json({ ok: false, error }, { status }) });
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { storagePath?: string; fileName?: string; mimeType?: string; sizeBytes?: number; type?: string } | null;
    const path = String(body?.storagePath ?? "");
    if (!orgId || !path.startsWith(`${orgId}/`) || path.includes("..")) return fail("That file is not in your workspace.", 403);
    const { adminClient } = await import("@/lib/supabase/clients");
    const { data, error } = await adminClient().storage.from("documents").download(path);
    if (error || !data) return fail("We could not find the uploaded file. Try again.", 404);
    if (data.size > maxBytes) return fail(`That file is over ${Math.round(maxBytes / 1048576)} MB.`);
    return { buffer: Buffer.from(await data.arrayBuffer()), fileName: String(body?.fileName ?? path.split("/").pop()), mimeType: String(body?.mimeType || data.type || "application/octet-stream"), sizeBytes: data.size, type: String(body?.type ?? ""), storagePath: path };
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Choose a file first.");
  if (file.size > maxBytes) return fail(`That file is over ${Math.round(maxBytes / 1048576)} MB. Try a smaller one.`);
  return { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, type: String(form?.get("type") ?? ""), storagePath: null };
}
