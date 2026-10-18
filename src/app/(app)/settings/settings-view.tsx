"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Invoice, Member, NotificationSettings, Organization, PlanTier, Subscription } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/app/theme-toggle";

const plans: { tier: PlanTier; name: string; price: string; who: string; includes: string[] }[] = [
  { tier: "free", name: "Free", price: "$0", who: "Try it out", includes: ["Profile and knowledge base", "5 matches a month", "1 drafted letter of inquiry"] },
  { tier: "starter", name: "Starter", price: "$29", who: "Orgs under $250K", includes: ["Unlimited matches", "3 full proposals a month", "Calendar and reminders", "Outreach drafts"] },
  { tier: "growth", name: "Growth", price: "$79", who: "Orgs $250K to $1M", includes: ["Everything in Starter", "Unlimited proposals", "Connections and Social (coming)", "3 seats"] },
];

export function SettingsView({ org, members: initialMembers, subscription: initialSub, invoices, notifications: initialNotif, initialTab, stripe, icsUrl, currentUserId }: { org: Organization; members: Member[]; subscription: Subscription; invoices: Invoice[]; notifications: NotificationSettings; initialTab?: string; stripe: boolean; icsUrl: string; currentUserId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = React.useState(initialTab && ["workspace", "team", "notifications", "billing"].includes(initialTab) ? initialTab : "workspace");
  const [members, setMembers] = React.useState(initialMembers);
  const [sub, setSub] = React.useState(initialSub);
  const [notif, setNotif] = React.useState(initialNotif);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Member["role"]>("reviewer");

  const updateNotif = async (patch: Partial<NotificationSettings>) => {
    setNotif((n) => ({ ...n, ...patch }));
    await services.billing.updateNotificationSettings(patch);
  };

  const invoiceColumns: Column<Invoice>[] = [
    { key: "date", header: "Date", cell: (i) => formatDate(i.date) },
    { key: "amount", header: "Amount", align: "right", cell: (i) => formatMoney(i.amount) },
    { key: "status", header: "Status", cell: (i) => (
      i.status === "paid" ? <span className="text-ink-muted">Paid</span>
      : i.status === "open" ? <span className="font-semibold text-ink">Open</span>
      : <span className="font-semibold text-burgundy">Failed</span>
    ) },
    { key: "pdf", header: <span className="sr-only">Download</span>, align: "right", cell: () => (
      <Button variant="ghost" size="sm" onClick={() => toast({ title: "Invoices come from Stripe", description: "They'll be here once billing is hooked up.", tone: "info" })}>
        Download PDF
      </Button>
    ) },
  ];

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Workspace, team, notifications, and billing." />
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList variant="line" aria-label="Settings sections">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="integrations" asChild>
            <a href="/settings/integrations">Integrations</a>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <form
            className="flex max-w-lg flex-col gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await services.org.update({ name: String(fd.get("name")), ein: String(fd.get("ein")), websiteUrl: String(fd.get("website")) });
              toast({ title: "Workspace saved" });
            }}
          >
            <Field id="ws-name" label="Organization name">
              <Input name="name" defaultValue={org.name} />
            </Field>
            <Field id="ws-ein" label="EIN" hint="Used to check 501(c)(3) status and pull your 990 data.">
              <Input name="ein" defaultValue={org.ein} inputMode="numeric" />
            </Field>
            <Field id="ws-web" label="Website">
              <Input name="website" type="url" defaultValue={org.websiteUrl} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label>Appearance</Label>
              <ThemeToggle className="w-fit" />
            </div>
            <div>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
          <div className="mt-12 max-w-lg border-l-2 border-burgundy pl-5">
            <h2 className="font-display text-xl text-ink">Delete workspace</h2>
            <p className="mt-2 text-base text-ink-muted">This removes your profile, documents, and drafts for everyone on the team. We will ask you to confirm by email first.</p>
            <Button
              variant="danger-ghost"
              className="mt-3 -ml-4"
              onClick={async () => {
                if (!window.confirm(`Delete ${org.name} and everything in it? This cannot be undone.`)) return;
                await services.org.deleteWorkspace();
                await services.auth.signOut();
                router.push("/");
              }}
            >
              Delete workspace
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <ul className="border-t border-rule">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule py-3">
                <Avatar name={m.fullName || m.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-ink">{m.fullName || m.email}</p>
                  <p className="truncate text-sm text-ink-muted">
                    {m.email}
                    {m.status === "invited" ? ", invited" : ""}
                  </p>
                </div>
                {m.role === "owner" ? (
                  <span className="text-sm text-ink">Owner</span>
                ) : (
                  <>
                    <Label htmlFor={`role-${m.id}`} className="sr-only">
                      Role for {m.email}
                    </Label>
                    <Select
                      value={m.role}
                      onValueChange={async (v) => {
                        const next = await services.org.updateMemberRole(m.id, v as Member["role"]);
                        setMembers((l) => l.map((x) => (x.id === m.id ? { ...x, role: next.role } : x)));
                      }}
                    >
                      <SelectTrigger id={`role-${m.id}`} className="h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                      </SelectContent>
                    </Select>
                    {m.id !== currentUserId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await services.org.removeMember(m.id);
                          setMembers((l) => l.filter((x) => x.id !== m.id));
                          toast({ title: "Removed", description: `${m.email} no longer has access.`, tone: "info" });
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
          <form
            className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!inviteEmail.includes("@")) return;
              const m = await services.org.inviteMember(inviteEmail, inviteRole);
              setMembers((l) => [...l, m]);
              setInviteEmail("");
              toast({ title: "Invitation sent", description: `${m.email} can join as ${inviteRole}.` });
            }}
          >
            <Field id="invite-email" label="Invite a teammate" className="flex-1">
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@example.org" />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Member["role"])}>
                <SelectTrigger id="invite-role" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="secondary" className="h-11">
              Send invite
            </Button>
          </form>
          <p className="mt-3 max-w-[60ch] text-sm text-ink-muted">Reviewers can approve things in the Inbox but cannot edit drafts. Board members usually want exactly this. Assign milestones to teammates from the Calendar.</p>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="mb-8 max-w-lg border-l-[6px] border-ink py-2 pl-4">
            <p className="text-base font-semibold text-ink">Your calendar feed</p>
            <p className="mt-1 text-sm text-ink-muted">Subscribe from Google Calendar, Apple Calendar, or Outlook and every deadline and milestone shows up there. Anyone with this address can read your deadlines, so keep it private.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate bg-paper-tint px-2 py-1 text-xs text-ink">{icsUrl}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(icsUrl);
                    toast({ title: "Copied", description: "Paste it into your calendar app under subscribe or add by URL." });
                  } catch {
                    toast({ title: "Could not copy", description: "Select the address and copy it by hand.", tone: "warning" });
                  }
                }}
              >
                Copy address
              </Button>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Email reminders and the weekly digest go out only once email delivery is connected on the{" "}
              <a href="/settings/integrations" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink">
                Integrations page
              </a>
              .
            </p>
          </div>
          <div className="max-w-lg border-t border-rule">
            {[
              { key: "weeklyDigest" as const, label: "Weekly match digest", desc: "An email every Monday with new matches and what changed." },
              { key: "milestoneReminders" as const, label: "Milestone reminders", desc: "An email before each milestone on your calendar." },
              { key: "inboxAlerts" as const, label: "Inbox alerts", desc: "An email when a draft or plan is waiting for you." },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 border-b border-rule py-4">
                <div>
                  <Label htmlFor={`n-${row.key}`}>{row.label}</Label>
                  <p className="mt-0.5 text-sm text-ink-muted">{row.desc}</p>
                </div>
                <Switch id={`n-${row.key}`} checked={notif[row.key]} onCheckedChange={(c) => updateNotif({ [row.key]: c })} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 border-b border-rule py-4">
              <div>
                <Label htmlFor="n-days">Remind me</Label>
                <p className="mt-0.5 text-sm text-ink-muted">How many days before each milestone.</p>
              </div>
              <Select value={String(notif.reminderDaysBefore)} onValueChange={(v) => updateNotif({ reminderDaysBefore: Number(v) })}>
                <SelectTrigger id="n-days" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} day{d === 1 ? "" : "s"} before
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
            <div className="min-w-0">
              <ul className="border-t-2 border-ink">
                {plans.map((p) => {
                  const current = sub.plan === p.tier;
                  return (
                    <li key={p.tier} className="grid gap-4 border-b border-rule py-5 sm:grid-cols-[8rem_1fr_auto]">
                      <div>
                        <h3 className="font-display text-2xl text-ink">{p.name}</h3>
                        <p className="mt-1 font-display text-3xl text-ink tnum">
                          {p.price}
                          <span className="ml-1 font-body text-sm font-normal text-ink-muted">/month</span>
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-ink-muted">{p.who}</p>
                        <p className="mt-1 max-w-[50ch] text-base text-ink">{p.includes.join(", ")}.</p>
                      </div>
                      <div className="sm:justify-self-end sm:pt-1">
                        {current ? (
                          <span className="font-semibold text-ink">Your plan</span>
                        ) : (
                          <Button
                            variant={p.tier === "free" ? "secondary" : "primary"}
                            size="sm"
                            onClick={async () => {
                              if (stripe && p.tier !== "free") {
                                const r = await services.billing.checkoutUrl(p.tier);
                                if (!r.ok) return toast({ title: "Could not open checkout", description: r.error, tone: "warning" });
                                window.location.assign(r.data.url);
                                return;
                              }
                              const next = await services.billing.changePlan(p.tier);
                              setSub(next);
                              toast({ title: `Switched to ${p.name}`, description: stripe ? "Your subscription is updated." : "Stripe is not connected on this server, so the plan switched in place." });
                            }}
                          >
                            {p.tier === "free" ? "Downgrade" : "Choose " + p.name}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 max-w-[65ch] text-sm text-ink-muted">Prices are placeholders while we test with early users. Success-fee plans are on hold until we are sure funders allow them.</p>
              <h2 className="mt-12 font-display text-2xl text-ink">Invoices</h2>
              <DataTable className="mt-4" columns={invoiceColumns} rows={invoices} rowKey={(i) => i.id} caption="Invoices" dense />
            </div>
            <aside className="flex flex-col gap-10">
              <div className="border-t-2 border-ink pt-4">
                <h2 className="font-display text-xl text-ink">This month</h2>
                <div className="mt-4">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-ink">Full proposals</span>
                    <span className="text-ink-muted tnum">
                      {sub.usage.proposalsThisMonth} of {sub.usage.proposalLimit ?? "unlimited"}
                    </span>
                  </div>
                  {sub.usage.proposalLimit ? <Progress value={Math.min(100, (sub.usage.proposalsThisMonth / sub.usage.proposalLimit) * 100)} className="mt-2" aria-label="Proposals used" /> : null}
                </div>
                <div className="mt-4 flex justify-between gap-4 text-sm">
                  <span className="text-ink">Matches</span>
                  <span className="text-ink-muted tnum">
                    {sub.usage.matchesThisMonth} of {sub.usage.matchLimit ?? "unlimited"}
                  </span>
                </div>
                <p className="mt-4 text-sm text-ink-muted">Renews {formatDate(sub.currentPeriodEnd)}.</p>
              </div>
              <div className="border-t-2 border-ink pt-4">
                <h2 className="font-display text-xl text-ink">Payment and invoices</h2>
                <p className="mt-3 text-base text-ink-muted">{stripe ? "Cards, invoices, and cancellation are handled in the Stripe billing portal." : "Stripe is not connected on this server. The Free plan works without it."}</p>
                <Button
                  variant="link"
                  size="sm"
                  className={cn("mt-2")}
                  onClick={async () => {
                    const r = await services.billing.portalUrl();
                    if (!r.ok) return toast({ title: "Billing portal", description: r.error, tone: "info" });
                    window.location.assign(r.data.url);
                  }}
                >
                  Open the billing portal
                </Button>
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
