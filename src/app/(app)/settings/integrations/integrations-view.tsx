"use client";

import * as React from "react";
import Link from "next/link";
import type { IntegrationConnection } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

type Status = { id: string; name: string; required: boolean; present: boolean; unlocks: string; envVars: string[]; howTo: string; docsUrl: string };
type Notice = { kind: "connected"; provider: string } | { kind: "error"; code: string; provider: string } | null;

const errorCopy: Record<string, string> = {
  not_connected: "That provider's keys are not on this server yet, so there is nothing to connect to.",
  denied: "The provider did not complete the sign-in. Nothing was connected.",
  failed: "The provider answered, but we could not finish connecting. Try again in a minute.",
};

/** Every outside service, whether its key is present, what it unlocks, and how to connect it. */
export function IntegrationsView({ status, connections: initial, demo, notice }: { status: Status[]; connections: IntegrationConnection[]; demo: boolean; notice: Notice }) {
  const { toast } = useToast();
  const [connections, setConnections] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const google = connections.find((c) => c.provider === "google");
  const microsoft = connections.find((c) => c.provider === "microsoft");
  const required = status.filter((s) => s.required);
  const optional = status.filter((s) => !s.required);

  const connect = async (provider: "google" | "microsoft", purpose: "gmail" | "calendar" | "outlook") => {
    setBusy(`${provider}-${purpose}`);
    const r = await services.integrations.connectUrl(provider, purpose);
    setBusy(null);
    if (!r.ok) return toast({ title: "Not set up yet", description: r.error, tone: "warning" });
    window.location.assign(r.data.url);
  };
  const disconnect = async (provider: "google" | "microsoft") => {
    await services.integrations.disconnect(provider);
    setConnections((l) => l.filter((c) => c.provider !== provider));
    toast({ title: "Disconnected", description: "We no longer hold a token for that account.", tone: "info" });
  };
  const sync = async () => {
    setBusy("sync");
    const r = await services.integrations.syncCalendar();
    setBusy(null);
    if (!r.ok) return toast({ title: "Could not sync", description: r.error, tone: "warning" });
    toast({ title: "Calendar updated", description: `${r.data.pushed} milestone${r.data.pushed === 1 ? "" : "s"} pushed to Google Calendar.` });
  };

  const accountFor = (id: string) => (id === "gmail" || id === "google_calendar" ? google : id === "outlook" ? microsoft : null);
  const scopeOk = (id: string, c: IntegrationConnection | null | undefined) => {
    if (!c) return false;
    if (id === "gmail") return c.scopes.some((s) => s.includes("gmail.send"));
    if (id === "google_calendar") return c.scopes.some((s) => s.includes("calendar"));
    if (id === "outlook") return c.scopes.some((s) => s.includes("Mail.Send"));
    return false;
  };

  const Row = ({ s }: { s: Status }) => {
    const account = accountFor(s.id);
    const connected = scopeOk(s.id, account);
    return (
      <li className="grid gap-4 border-b border-rule py-5 lg:grid-cols-[14rem_1fr_auto] lg:gap-8">
        <div>
          <h3 className="font-display text-xl text-ink">{s.name}</h3>
          <p className="mt-1 text-sm font-semibold text-ink">{s.present ? (account !== null && account !== undefined ? (connected ? "Connected" : "Key present, account not connected") : s.id === "gmail" || s.id === "outlook" || s.id === "google_calendar" ? "Key present, not connected yet" : "Connected") : s.required ? <span className="count">Missing</span> : "Not connected"}</p>
          {account && (s.id === "gmail" || s.id === "google_calendar" || s.id === "outlook") ? (
            <p className="mt-1 text-sm text-ink-muted">
              {account.accountEmail || "Account"}, since {formatDate(account.connectedAt)}
            </p>
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-base text-ink">{s.unlocks}</p>
          <p className="mt-2 text-sm text-ink-muted">{s.howTo}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">
            {s.envVars.map((v) => (
              <code key={v} className="bg-paper-tint px-1 py-0.5">
                {v}
              </code>
            ))}
            <a href={s.docsUrl} target="_blank" rel="noreferrer" className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
              Where to get it
            </a>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          {s.id === "gmail" ? (
            connected ? (
              <Button variant="ghost" size="sm" onClick={() => disconnect("google")}>
                Disconnect Google
              </Button>
            ) : (
              <Button variant="secondary" size="sm" loading={busy === "google-gmail"} disabled={!s.present} onClick={() => connect("google", "gmail")}>
                Connect Gmail
              </Button>
            )
          ) : null}
          {s.id === "google_calendar" ? (
            connected ? (
              <>
                <Button variant="secondary" size="sm" loading={busy === "sync"} onClick={sync}>
                  Push milestones now
                </Button>
                <Button variant="ghost" size="sm" onClick={() => disconnect("google")}>
                  Disconnect Google
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" loading={busy === "google-calendar"} disabled={!s.present} onClick={() => connect("google", "calendar")}>
                Connect Google Calendar
              </Button>
            )
          ) : null}
          {s.id === "outlook" ? (
            connected ? (
              <Button variant="ghost" size="sm" onClick={() => disconnect("microsoft")}>
                Disconnect Outlook
              </Button>
            ) : (
              <Button variant="secondary" size="sm" loading={busy === "microsoft-outlook"} disabled={!s.present} onClick={() => connect("microsoft", "outlook")}>
                Connect Outlook
              </Button>
            )
          ) : null}
          {s.id === "stripe" && s.present ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings?tab=billing">Open billing</Link>
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <PageContainer width="wide">
      <Link href="/settings" className="text-sm text-ink underline decoration-[1px] underline-offset-4 hover:decoration-ink">
        Settings
      </Link>
      <PageHeader className="mt-4" title="Integrations" description="Each outside service, whether its key is on this server, what it turns on, and how to connect it. Keys live in .env.local on the server and never in the browser." />
      {notice ? (
        <p role="status" className={`mt-6 max-w-[65ch] border-l-[6px] py-1 pl-4 text-base text-ink ${notice.kind === "error" ? "border-alert" : "border-ink"}`}>
          {notice.kind === "connected" ? `${notice.provider === "google" ? "Google" : "Microsoft"} is connected.` : errorCopy[notice.code] ?? "Something did not work."}
        </p>
      ) : null}
      {demo ? <p className="mt-6 max-w-[65ch] text-base text-ink-muted">This server runs in demo mode on sample data. Add the required keys to leave the demo.</p> : null}
      <section className="mt-10" aria-labelledby="req">
        <h2 id="req" className="font-display text-2xl text-ink">
          Required
        </h2>
        <ul className="mt-3 border-t border-rule">
          {required.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </ul>
      </section>
      <section className="mt-12" aria-labelledby="opt">
        <h2 id="opt" className="font-display text-2xl text-ink">
          Optional
        </h2>
        <p className="mt-1 text-base text-ink-muted">Everything here is off until its key is present, and the product works without it.</p>
        <ul className="mt-3 border-t border-rule">
          {optional.map((s) => (
            <Row key={s.id} s={s} />
          ))}
        </ul>
      </section>
      <p className="mt-8 max-w-[65ch] text-sm text-ink-muted">Step-by-step instructions for every key are in KEYS.md in the repository.</p>
    </PageContainer>
  );
}
