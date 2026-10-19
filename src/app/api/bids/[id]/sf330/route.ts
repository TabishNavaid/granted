import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { currentOrg } from "@/lib/integrations/current-org";

export const runtime = "nodejs";

/** The SF 330 for one bid as a Word file, built from the firm's records. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDemoMode()) return handle(id);
  const { DEMO_COOKIE, runInSession } = await import("@/lib/services/demo-session");
  return runInSession(request.cookies.get(DEMO_COOKIE)?.value, () => handle(id));
}

async function handle(id: string) {
  const who = await currentOrg();
  if (!who) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const { mockServices } = await import("@/lib/services/mock");
  const services = isDemoMode() ? mockServices : (await import("@/lib/services/supabase")).makeSupabaseServices();
  const sf = await services.bids.sf330(id);
  if (!sf) return NextResponse.json({ ok: false, error: "We could not find that bid." }, { status: 404 });
  const { sf330Docx, sf330FileName } = await import("@/lib/bids/sf330-docx");
  const buf = await sf330Docx(sf);
  const name = sf330FileName(sf);
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${name}"` } });
}
