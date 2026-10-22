import type { SocialCampaign } from "@/lib/types";
import { siteUrl } from "@/lib/site-url";

/** Pure helpers both adapters share. */

export function exportCampaign(c: SocialCampaign, format: "text" | "csv"): string {
  const posts = c.posts.filter((p) => p.status !== "skipped");
  if (format === "csv") {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return ["date,platform,text,about", ...posts.map((p) => [p.date, p.platform, esc(p.text), esc(p.tiedTo.label)].join(","))].join("\n");
  }
  return [`${c.month}: ${c.theme}`, "", ...posts.map((p) => `${p.date} (${p.platform})\n${p.text}\n`)].join("\n");
}

export function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export function icsUrlFor(token: string) {
  const base = siteUrl();
  return `${base}/api/calendar/${token}.ics`;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** Map common CSV headers (LinkedIn export, a board list) onto our contact fields. */
export function rowToContact(r: Record<string, string>): { name: string; organization?: string; role?: string; email?: string; phone?: string; relationship?: string } | null {
  const pick = (...keys: string[]) => keys.map((k) => r[k]).find((v) => v && v.trim()) ?? "";
  const first = pick("first name", "first", "firstname");
  const last = pick("last name", "last", "lastname");
  const name = pick("name", "full name", "contact") || `${first} ${last}`.trim();
  if (!name) return null;
  return { name, organization: pick("organization", "company", "org", "employer"), role: pick("role", "title", "position", "job title"), email: pick("email", "email address", "e-mail"), phone: pick("phone", "mobile", "telephone"), relationship: pick("relationship", "notes", "how we know them", "connection") };
}
