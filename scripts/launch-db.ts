/**
 * One command for launch day: `npm run launch:db`
 *
 * Reads .env.local (the founders' real keys) and, against the real Supabase project:
 *   1. applies every migration in supabase/migrations that has not run yet, recorded in
 *      supabase_migrations.schema_migrations the same way the Supabase CLI records them;
 *   2. when SUPABASE_ACCESS_TOKEN is set, configures Auth through the Management API: site URL and redirect
 *      URLs, the branded email templates, Resend as the SMTP server, and Google sign-in when its keys are set;
 *   3. runs the opportunity database backfill for every enabled source (SAM.gov uses its key when present);
 *   4. prints the database size against the free plan's 500 MB.
 *
 * Options: --skip-backfill, --only grantsgov,sam_opportunities, --dry-run (print the plan, change nothing),
 * --env FILE (default .env.local). Nothing secret is printed.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadConnectors } from "@/lib/catalog/connectors";
import { runIntoDatabase } from "@/lib/catalog/ingest/runner";
import { prune } from "@/lib/catalog/ingest/store";
import { embedMissing } from "@/lib/catalog/ingest/embed";
import { geminiEmbedder } from "@/lib/ai/embed";
import { CANONICAL_URL, PRODUCT_NAME, EMAIL } from "@/lib/brand";
import { AUTH_TEMPLATES } from "./email-templates";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const say = (s: string) => console.log(s);

async function main() {
  const envFile = arg("env") ?? ".env.local";
  if (!existsSync(envFile)) throw new Error(`No ${envFile}. Put the Supabase keys in it first (see LAUNCH.md).`);
  process.loadEnvFile(envFile);
  const dbUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!dbUrl) throw new Error("Set SUPABASE_DB_URL in .env.local: Supabase dashboard, Connect, Session pooler (port 5432) connection string with the database password.");
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl);
  if (local && !flag("allow-local")) throw new Error("SUPABASE_DB_URL points at this machine. Use the real project's connection string, or pass --allow-local.");
  const dry = flag("dry-run");
  const host = new URL(dbUrl.replace(/^postgres(ql)?:/, "http:")).hostname;
  say(`${PRODUCT_NAME} launch: database at ${host}${dry ? " (dry run)" : ""}`);

  const sql = postgres(dbUrl, { ssl: local ? false : "require", max: 2, onnotice: () => undefined, prepare: !/:6543\//.test(dbUrl) });
  try {
    await migrate(sql, dry);
    if (!dry) await configureAuth();
    if (!flag("skip-backfill") && !dry) await backfill(sql);
    await sizeReport(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function migrate(sql: postgres.Sql, dry: boolean) {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  await sql`create schema if not exists supabase_migrations`;
  await sql`create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`;
  const done = new Set((await sql<{ version: string }[]>`select version from supabase_migrations.schema_migrations`).map((r) => r.version));
  const todo = files.filter((f) => !done.has(f.split("_")[0]));
  say(`Migrations: ${files.length} in the repo, ${todo.length} to apply${todo.length ? `: ${todo.join(", ")}` : ""}.`);
  if (dry) return;
  for (const f of todo) {
    const body = readFileSync(path.join(dir, f), "utf8");
    // Simple query protocol: the whole file runs as one batch, as `supabase db push` runs it.
    await sql.unsafe(body);
    await sql`insert into supabase_migrations.schema_migrations (version, name, statements) values (${f.split("_")[0]}, ${f.replace(/^\d+_|\.sql$/g, "")}, ${[body]})`;
    say(`  applied ${f}`);
  }
}

async function configureAuth() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!token || !ref) {
    say("Auth settings: skipped (set SUPABASE_ACCESS_TOKEN to configure them from here; LAUNCH.md lists the same settings for the dashboard).");
    return;
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || CANONICAL_URL).replace(/\/$/, "");
  const body: Record<string, unknown> = {
    site_url: site,
    uri_allow_list: [`${site}/**`, `https://www.${new URL(site).host}/**`, "http://localhost:3000/**"].join(","),
    mailer_otp_exp: 3600,
    mailer_subjects_magic_link: AUTH_TEMPLATES.magic_link.subject,
    mailer_templates_magic_link_content: AUTH_TEMPLATES.magic_link.html,
    mailer_subjects_confirmation: AUTH_TEMPLATES.confirmation.subject,
    mailer_templates_confirmation_content: AUTH_TEMPLATES.confirmation.html,
    mailer_subjects_invite: AUTH_TEMPLATES.invite.subject,
    mailer_templates_invite_content: AUTH_TEMPLATES.invite.html,
    mailer_subjects_email_change: AUTH_TEMPLATES.email_change.subject,
    mailer_templates_email_change_content: AUTH_TEMPLATES.email_change.html,
    mailer_subjects_recovery: AUTH_TEMPLATES.recovery.subject,
    mailer_templates_recovery_content: AUTH_TEMPLATES.recovery.html,
  };
  const resend = process.env.RESEND_API_KEY?.trim();
  if (resend) Object.assign(body, { smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend", smtp_pass: resend, smtp_admin_email: EMAIL.noReply, smtp_sender_name: PRODUCT_NAME, smtp_max_frequency: 30 });
  const gid = process.env.GOOGLE_CLIENT_ID?.trim();
  const gsecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (gid && gsecret) Object.assign(body, { external_google_enabled: true, external_google_client_id: gid, external_google_secret: gsecret });
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Supabase rejected the auth settings (${res.status}): ${(await res.text()).slice(0, 300)}`);
  say(`Auth settings: site URL ${site}, redirect URLs, 5 email templates${resend ? ", Resend SMTP from " + EMAIL.noReply : " (no RESEND_API_KEY, so Supabase's own mailer for now)"}${gid ? ", Google sign-in on" : ""}.`);
}

async function backfill(sql: postgres.Sql) {
  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const connectors = (await loadConnectors(only)).filter((c) => c.source.enabled || only?.includes(c.source.id));
  say(`Backfill: ${connectors.length} sources. Large ones take a while; each run is logged in catalog_ingest_runs.`);
  for (const c of connectors) {
    const r = await runIntoDatabase(sql as never, c, { mode: "backfill", trigger: "launch", log: (m) => say(`  [${c.source.id}] ${m}`) });
    say(`  ${c.source.id}: ${r.status}, ${r.stats.added} added, ${r.stats.updated} updated${r.notes ? ` (${r.notes})` : ""}`);
  }
  await prune(sql as never);
  // With a model key, the first batch of embeddings for semantic matching; scheduled runs fill in the rest.
  if (process.env.GEMINI_API_KEY?.trim()) await embedMissing(sql as never, geminiEmbedder, { log: (m) => say(`  [embeddings] ${m}`) }).catch((e) => say(`  [embeddings] ${e instanceof Error ? e.message : e}`));
}

async function sizeReport(sql: postgres.Sql) {
  const [{ db }] = await sql<{ db: string }[]>`select pg_database_size(current_database())::text as db`;
  const [{ cat }] = await sql<{ cat: string }[]>`select coalesce(sum(pg_total_relation_size(c.oid)), 0)::text as cat from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'catalog_%'`;
  const mb = (b: string) => Math.round(Number(b) / 1048576);
  say(`Size: database ${mb(db)} MB of the free plan's 500 MB; the opportunity database is ${mb(cat)} MB of that.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
