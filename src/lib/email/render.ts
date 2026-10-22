import { CANONICAL_URL, EMAIL, PRODUCT_NAME } from "@/lib/brand";
import { EMAIL_THEME as T } from "./theme";

/**
 * One layout for every email we send: HTML that renders in every major client (tables, inline styles, no
 * images required) and a plain-text twin built from the same blocks.
 */
export type Block =
  | { kind: "p"; text: string }
  | { kind: "button"; label: string; url: string }
  | { kind: "list"; heading?: string; items: { title: string; url?: string; meta?: string }[] }
  | { kind: "note"; text: string }
  | { kind: "code"; text: string };

export interface EmailParts {
  /** Shown in the inbox list after the subject. */
  preheader: string;
  heading: string;
  blocks: Block[];
  /** Why this person got it, in one sentence. */
  reason: string;
  /** One-click unsubscribe link for non-essential mail; absent for sign-in, invites, and security mail. */
  unsubscribeUrl?: string | null;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Template variables (Supabase's {{ .X }}) must survive escaping untouched. */
function esc(s: string): string {
  return s
    .split(/(\{\{[^}]*\}\})/)
    .map((part) => (part.startsWith("{{") ? part : escapeHtml(part)))
    .join("");
}

const p = (inner: string, extra = "") => `<p style="margin:0 0 16px;font-family:${T.font};font-size:16px;line-height:1.55;color:${T.ink};${extra}">${inner}</p>`;

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "p":
      return p(esc(b.text));
    case "note":
      return p(esc(b.text), `font-size:14px;color:${T.muted};`);
    case "code":
      return `<p style="margin:0 0 16px;font-family:Menlo,Consolas,monospace;font-size:22px;letter-spacing:4px;color:${T.ink};">${esc(b.text)}</p>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="background:${T.accent};border-radius:6px;">
<a href="${esc(b.url)}" style="display:inline-block;padding:13px 22px;font-family:${T.font};font-size:16px;font-weight:600;color:${T.accentInk};text-decoration:none;">${esc(b.label)}</a>
</td></tr></table>`;
    case "list":
      return `${b.heading ? `<p style="margin:24px 0 8px;font-family:${T.font};font-size:13px;font-weight:600;color:${T.muted};">${esc(b.heading)}</p>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${T.rule};margin:0 0 16px;">${b.items
        .map(
          (i) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${T.rule};font-family:${T.font};">
<div style="font-size:16px;line-height:1.4;color:${T.ink};font-weight:600;">${i.url ? `<a href="${esc(i.url)}" style="color:${T.ink};text-decoration:underline;">${esc(i.title)}</a>` : esc(i.title)}</div>
${i.meta ? `<div style="margin-top:3px;font-size:14px;line-height:1.45;color:${T.muted};">${esc(i.meta)}</div>` : ""}
</td></tr>`,
        )
        .join("")}</table>`;
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "p":
    case "note":
      return b.text;
    case "code":
      return b.text;
    case "button":
      return `${b.label}: ${b.url}`;
    case "list":
      return [b.heading ?? "", ...b.items.map((i) => `- ${i.title}${i.meta ? ` (${i.meta})` : ""}${i.url ? `\n  ${i.url}` : ""}`)].filter(Boolean).join("\n");
  }
}

export function renderEmail(e: EmailParts): RenderedEmail {
  const footer = [e.reason, e.unsubscribeUrl ? `Unsubscribe: ${e.unsubscribeUrl}` : "", `${PRODUCT_NAME}, ${CANONICAL_URL.replace("https://", "")}. Questions: ${EMAIL.support}`].filter(Boolean);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(e.heading)}</title></head>
<body style="margin:0;padding:0;background:${T.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.canvas};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 16px;font-family:${T.serif};font-size:20px;font-weight:700;letter-spacing:-0.3px;color:${T.ink};">${esc(PRODUCT_NAME)}</td></tr>
<tr><td style="background:${T.paper};border:1px solid ${T.rule};border-radius:8px;padding:32px 28px;">
<h1 style="margin:0 0 20px;font-family:${T.serif};font-size:26px;line-height:1.2;font-weight:600;color:${T.ink};">${esc(e.heading)}</h1>
${e.blocks.map(blockHtml).join("\n")}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${T.font};font-size:13px;line-height:1.5;color:${T.muted};">
${esc(e.reason)}${e.unsubscribeUrl ? ` <a href="${esc(e.unsubscribeUrl)}" style="color:${T.muted};text-decoration:underline;">Unsubscribe</a>.` : ""}<br>
${esc(PRODUCT_NAME)}, <a href="${CANONICAL_URL}" style="color:${T.muted};">${CANONICAL_URL.replace("https://", "")}</a>. Questions go to <a href="mailto:${EMAIL.support}" style="color:${T.muted};">${EMAIL.support}</a>.
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = [e.heading, "", ...e.blocks.map(blockText).flatMap((t) => [t, ""]), "--", ...footer].join("\n");
  return { html, text };
}
