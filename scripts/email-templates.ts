/**
 * Writes the Supabase Auth email templates (supabase/templates/*.html) from the same code that renders every
 * other FundFellows email, so sign-in mail looks like the rest. Supabase fills the {{ .X }} variables.
 * The local stack reads them through supabase/config.toml; `npm run launch:db` uploads them to the hosted
 * project when SUPABASE_ACCESS_TOKEN is set (otherwise LAUNCH.md says where to paste them).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/email-templates.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { signInEmail } from "@/lib/email/templates";
import { renderEmail } from "@/lib/email/render";

export const AUTH_TEMPLATES = authTemplates();

function authTemplates() {
  // Magic link and signup confirmation land on our callback, which verifies the token server side.
  const link = (type: string) => `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${type}`;
  const magic = signInEmail({ link: link("email"), code: "{{ .Token }}" });
  const confirm = signInEmail({ link: link("email"), code: "{{ .Token }}", firstTime: true });
  const invite = { subject: "You have been invited to FundFellows", ...renderEmail({ preheader: "One click to join.", heading: "You are invited", blocks: [{ kind: "p", text: "Someone invited you to a FundFellows workspace. Use this link to accept and sign in." }, { kind: "button", label: "Accept the invitation", url: "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/inbox" }], reason: "You get this because someone invited this address." }) };
  const change = { subject: "Confirm your new email for FundFellows", ...renderEmail({ preheader: "Confirm the change.", heading: "Confirm your new email", blocks: [{ kind: "p", text: "Confirm that {{ .NewEmail }} should be the address for your FundFellows account." }, { kind: "button", label: "Confirm the change", url: "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/settings" }, { kind: "note", text: "If you did not ask for this, ignore this email and write to support@fundfellows.com." }], reason: "You get this because someone asked to change the email on a FundFellows account." }) };
  const recovery = { ...signInEmail({ link: "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/inbox", code: "{{ .Token }}" }) };
  return {
    magic_link: { subject: magic.subject, html: magic.html },
    confirmation: { subject: confirm.subject, html: confirm.html },
    invite: { subject: invite.subject, html: invite.html },
    email_change: { subject: change.subject, html: change.html },
    recovery: { subject: "Sign in to FundFellows", html: recovery.html },
  };
}

if (process.argv[1]?.endsWith("email-templates.ts")) {
  const dir = path.join(process.cwd(), "supabase", "templates");
  mkdirSync(dir, { recursive: true });
  for (const [name, t] of Object.entries(AUTH_TEMPLATES)) writeFileSync(path.join(dir, `${name}.html`), t.html);
  console.log(`Wrote ${Object.keys(AUTH_TEMPLATES).length} templates to ${dir}`);
}
