import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * The real product end to end, against the local Supabase: sign up with an email link, the branded email that
 * Supabase sends (caught by the local mail catcher), landing in setup, signing out and back in, and a file uploaded
 * straight to private storage. Runs only when REAL_BASE_URL points at a server started with `npm run dev:localdb`.
 */
if (existsSync(".env.localdb")) process.loadEnvFile(".env.localdb");
const BASE = process.env.REAL_BASE_URL ?? "";
const MAIL = process.env.MAILPIT_URL ?? "http://127.0.0.1:55424";
const email = `auth-${randomUUID().slice(0, 8)}@example.test`;

test.describe.configure({ mode: "serial" });
test.skip(!BASE, "Set REAL_BASE_URL to a server running against the local database (npm run dev:localdb).");

async function latestEmail(to: string, after: number): Promise<{ subject: string; html: string }> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const list = (await r.json()) as { messages: { ID: string; Subject: string; Created: string }[] };
    const m = list.messages?.find((x) => new Date(x.Created).getTime() >= after - 2000);
    if (m) {
      const full = (await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()) as { HTML: string; Subject: string };
      return { subject: full.Subject, html: full.HTML };
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`No email to ${to}`);
}

function linkIn(html: string): string {
  const m = html.match(/href="([^"]*token_hash=[^"]+)"/);
  if (!m) throw new Error("No sign-in link in the email");
  return m[1].replace(/&amp;/g, "&");
}

async function signInByEmail(page: Page, path: "/sign-up" | "/sign-in") {
  const started = Date.now();
  await page.goto(`${BASE}${path}`);
  if (path === "/sign-up") {
    await page.getByLabel("Your name").fill("Avery Test");
    await page.getByLabel("Organization").fill("Test Builders LLC");
    await page.getByLabel("Work email").fill(email);
  } else await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  const mail = await latestEmail(email, started);
  return mail;
}

test("sign up with an email link: a branded email, then setup", async ({ page }) => {
  const mail = await signInByEmail(page, "/sign-up");
  expect(mail.subject).toMatch(/FundFellows/);
  expect(mail.html).toContain("FundFellows");
  expect(mail.html).not.toMatch(/Supabase/);
  await page.goto(linkIn(mail.html));
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("signed out, the app sends you to sign in; signing in again lands in the Inbox", async ({ page }) => {
  await page.goto(`${BASE}/inbox`);
  await page.waitForURL(/\/sign-in/);
  const mail = await signInByEmail(page, "/sign-in");
  expect(mail.subject).toMatch(/sign-in link/i);
  await page.goto(linkIn(mail.html));
  await page.waitForURL(/\/(inbox|onboarding)/);
});

test("a file goes straight to private storage and its text is read", async ({ page }) => {
  const mail = await signInByEmail(page, "/sign-in");
  await page.goto(linkIn(mail.html));
  await page.waitForURL(/\/(inbox|onboarding)/);
  const result = await page.evaluate(async () => {
    const text = "Annual report 2025. We served 412 young people in after-school programs across three counties. ".repeat(20);
    const file = new File([text], "annual-report.txt", { type: "text/plain" });
    const sign = await (await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }) })).json();
    if (sign.mode !== "direct") return { sign };
    const put = await fetch(sign.signedUrl, { method: "PUT", headers: { "content-type": "text/plain", "x-upsert": "false", apikey: sign.apikey }, body: file });
    const done = await (await fetch("/api/documents/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storagePath: sign.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, type: "annual_report" }) })).json();
    const outside = await (await fetch("/api/documents/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ storagePath: "00000000-0000-0000-0000-000000000000/x.txt", fileName: "x.txt", mimeType: "text/plain", sizeBytes: 10, type: "other" }) })).json();
    return { mode: sign.mode, path: sign.path, put: put.status, ok: done.ok, title: done.document?.title, outside };
  });
  expect(result.mode).toBe("direct");
  expect(result.put).toBeLessThan(300);
  expect(result.ok).toBe(true);
  expect(result.title).toBe("annual-report");
  expect(result.outside.ok).toBe(false);
});
