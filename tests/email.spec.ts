import { expect, test } from "@playwright/test";
import { deadlineReminderEmail, draftReadyEmail, inviteEmail, signInEmail, weeklyDigestEmail, type OutgoingTemplate } from "@/lib/email/templates";
import { readUnsubscribeToken, unsubscribeLinks, unsubscribeToken } from "@/lib/email/unsubscribe";
import { AUTH_TEMPLATES } from "../scripts/email-templates";

process.env.EMAIL_SIGNING_SECRET = "test-signing-secret";
const unsub = "https://fundfellows.com/unsubscribe?t=x";

const all: [string, OutgoingTemplate][] = [
  ["sign in", signInEmail({ link: "https://fundfellows.com/auth/callback?token_hash=abc&type=email" })],
  ["invite", inviteEmail({ inviterName: "Dana Ortiz", workspaceName: "Cibolo Line Architects", role: "reviewer", link: "https://fundfellows.com/auth/callback?token_hash=abc&type=invite" })],
  ["reminder", deadlineReminderEmail({ workspaceName: "Riverbend Youth", items: [{ title: "Board review", application: "Meridian Family Foundation", date: "2026-11-03", url: "https://fundfellows.com/applications/a1" }], calendarUrl: "https://fundfellows.com/calendar", unsubscribeUrl: unsub })],
  ["digest", weeklyDigestEmail({ workspaceName: "Riverbend Youth", matches: [{ title: "Youth Mentoring Program", funder: "OJJDP", url: "https://fundfellows.com/inbox", deadline: "2026-12-01", source: "your matches", fit: 82 }], databaseNew: [{ title: "Rural Community Development Initiative", funder: "USDA", url: "https://www.grants.gov/search-results-detail/1", deadline: null, amount: "up to $250,000", source: "Grants.gov" }], deadlines: [], inboxUrl: "https://fundfellows.com/inbox", unsubscribeUrl: unsub })],
  ["draft ready", draftReadyEmail({ title: "Fire Station 9 renovation", kind: "bid response", url: "https://fundfellows.com/applications/a2", openQuestions: 2, workspaceName: "Cibolo Line", unsubscribeUrl: unsub })],
];

test.describe("emails", () => {
  for (const [name, t] of all) {
    test(`${name}: HTML and plain text, plain words, the links it needs`, () => {
      expect(t.subject.length).toBeGreaterThan(5);
      expect(t.subject.length).toBeLessThan(90);
      expect(t.html).toMatch(/^<!doctype html>/);
      expect(t.html).toContain("max-width:560px");
      expect(t.text).toContain("support@fundfellows.com");
      for (const s of [t.subject, t.html, t.text]) expect(s).not.toMatch(/[–—]/);
      expect(t.html).not.toMatch(/<script/i);
      const hrefs = [...t.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const h of hrefs) expect(h).toMatch(/^(https:\/\/|mailto:)/);
      if (t.essential) expect(t.html).not.toContain("Unsubscribe");
      else expect(t.html).toContain(unsub);
    });
  }

  test("text is escaped, so a funder name cannot inject markup", () => {
    const t = weeklyDigestEmail({ workspaceName: "A & B <Co>", matches: [{ title: '<img src=x onerror="1">', funder: "F", url: "https://x.test", deadline: null, source: "s" }], databaseNew: [], deadlines: [], inboxUrl: "https://fundfellows.com/inbox", unsubscribeUrl: null });
    expect(t.html).not.toContain("<img");
    expect(t.html).toContain("A &amp; B &lt;Co&gt;");
  });

  test("Supabase auth templates keep their variables and our look", () => {
    expect(Object.keys(AUTH_TEMPLATES).sort()).toEqual(["confirmation", "email_change", "invite", "magic_link", "recovery"]);
    expect(AUTH_TEMPLATES.magic_link.html).toContain("{{ .TokenHash }}");
    expect(AUTH_TEMPLATES.magic_link.html).toContain("{{ .Token }}");
    expect(AUTH_TEMPLATES.email_change.html).toContain("{{ .NewEmail }}");
    for (const t of Object.values(AUTH_TEMPLATES)) expect(t.html).toContain("FundFellows");
  });

  test("unsubscribe tokens round trip and cannot be forged or edited", () => {
    const tok = unsubscribeToken({ email: "Dana@Example.org", orgId: "org-1", category: "digest" })!;
    expect(readUnsubscribeToken(tok)).toEqual({ email: "dana@example.org", orgId: "org-1", category: "digest" });
    const [body] = tok.split(".");
    const other = Buffer.from(JSON.stringify(["victim@example.org", "org-1", "digest"])).toString("base64url");
    expect(readUnsubscribeToken(`${other}.${tok.split(".")[1]}`)).toBeNull();
    expect(readUnsubscribeToken(`${body}.AAAA`)).toBeNull();
    const links = unsubscribeLinks("https://fundfellows.com", { email: "a@b.org", orgId: "o", category: "reminders" })!;
    expect(links.page).toMatch(/^https:\/\/fundfellows\.com\/unsubscribe\?t=/);
    expect(links.oneClick).toMatch(/^https:\/\/fundfellows\.com\/api\/email\/unsubscribe\?t=/);
  });
});
