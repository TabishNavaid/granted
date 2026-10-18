import { NextResponse, type NextRequest } from "next/server";
import { contactAddress, emailConnected, sendEmail } from "@/lib/integrations/email";

/** The contact form. Sends through the email provider when keyed; otherwise tells the client to show the address. */
export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; message?: string; website?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "We could not read that. Try again." }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().slice(0, 200);
  const message = (body.message ?? "").trim().slice(0, 4000);
  if (body.website) return NextResponse.json({ ok: true, sent: true }); // honeypot
  if (!email.includes("@") || message.length < 5) return NextResponse.json({ ok: false, error: "Add your email and a message so we can answer." }, { status: 400 });
  const to = contactAddress();
  if (!emailConnected() || !to) return NextResponse.json({ ok: true, sent: false, address: to });
  const r = await sendEmail({ to, replyTo: email, subject: `Contact form: ${name || email}`, text: `From: ${name} <${email}>\n\n${message}` });
  if (!r.ok) return NextResponse.json({ ok: true, sent: false, address: to });
  return NextResponse.json({ ok: true, sent: true });
}
