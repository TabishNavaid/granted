"use client";

import * as React from "react";
import { Check, CreditCard, Download, UserPlus } from "lucide-react";
import type { Invoice, Member, NotificationSettings, Organization, PlanTier, Subscription } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  { tier: "growth", name: "Growth", price: "$79", who: "Orgs $250K to $1M", includes: ["Everything in Starter", "Unlimited proposals", "Connections and Social agents (coming)", "3 seats"] },
];

export function SettingsView({ org, members: initialMembers, subscription: initialSub, invoices, notifications: initialNotif, initialTab }: { org: Organization; members: Member[]; subscription: Subscription; invoices: Invoice[]; notifications: NotificationSettings; initialTab?: string }) {
  const { toast } = useToast();
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
    { key: "status", header: "Status", cell: (i) => <Badge variant={i.status === "paid" ? "success" : i.status === "open" ? "warning" : "danger"}>{i.status === "paid" ? "Paid" : i.status === "open" ? "Open" : "Failed"}</Badge> },
    { key: "pdf", header: <span className="sr-only">Download</span>, align: "right", cell: () => (
      <Button variant="ghost" size="sm" onClick={() => toast({ title: "Invoice PDFs come from Stripe", description: "Available once billing is connected.", tone: "info" })}>
        <Download aria-hidden /> PDF
      </Button>
    ) },
  ];

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Workspace, team, notifications, and billing." />
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
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
          <div className="mt-10 max-w-lg rounded-lg border border-danger/30 p-5">
            <h2 className="font-display text-lg text-fg">Delete workspace</h2>
            <p className="mt-1 text-sm text-fg-muted">Removes your profile, documents, and drafts for everyone on the team. We will ask you to confirm by email.</p>
            <Button variant="danger-ghost" className="mt-3" onClick={() => toast({ title: "Check your email", description: "We sent a confirmation link. Nothing is deleted until you click it.", tone: "warning" })}>
              Delete workspace
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.fullName || m.email} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{m.fullName || m.email}</p>
                  {m.fullName ? <p className="truncate text-xs text-fg-subtle">{m.email}</p> : null}
                </div>
                {m.status === "invited" ? <Badge variant="neutral">Invited</Badge> : null}
                <Badge variant="outline" className="capitalize">{m.role}</Badge>
              </li>
            ))}
          </ul>
          <form
            className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
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
            <Button type="submit" variant="secondary">
              <UserPlus aria-hidden /> Invite
            </Button>
          </form>
          <p className="mt-3 text-xs text-fg-subtle">Reviewers can approve items in the Inbox but cannot edit drafts. Board members usually want this role.</p>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="flex max-w-lg flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {[
              { key: "weeklyDigest" as const, label: "Weekly match digest", desc: "An email every Monday with new matches and what changed." },
              { key: "milestoneReminders" as const, label: "Milestone reminders", desc: "An email before each milestone on your calendar." },
              { key: "inboxAlerts" as const, label: "Inbox alerts", desc: "An email when a draft or plan is waiting for you." },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <Label htmlFor={`n-${row.key}`}>{row.label}</Label>
                  <p className="mt-0.5 text-sm text-fg-muted">{row.desc}</p>
                </div>
                <Switch id={`n-${row.key}`} checked={notif[row.key]} onCheckedChange={(c) => updateNotif({ [row.key]: c })} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <Label htmlFor="n-days">Remind me</Label>
                <p className="mt-0.5 text-sm text-fg-muted">How many days before each milestone.</p>
              </div>
              <Select value={String(notif.reminderDaysBefore)} onValueChange={(v) => updateNotif({ reminderDaysBefore: Number(v) })}>
                <SelectTrigger id="n-days" className="w-32">
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
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div>
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map((p) => {
                  const current = sub.plan === p.tier;
                  return (
                    <div key={p.tier} className={cn("flex flex-col rounded-lg border bg-surface p-5", current ? "border-accent ring-1 ring-accent" : "border-border")}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-xl text-fg">{p.name}</h3>
                        {current ? <Badge variant="accent">Current</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-fg-subtle">{p.who}</p>
                      <p className="mt-3 font-display text-3xl text-fg">
                        {p.price}
                        <span className="text-sm text-fg-subtle"> /month</span>
                      </p>
                      <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm text-fg-muted">
                        {p.includes.map((i) => (
                          <li key={i} className="flex gap-2">
                            <Check className="mt-1 size-3.5 shrink-0 text-success" aria-hidden /> {i}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={current ? "secondary" : "primary"}
                        className="mt-5"
                        disabled={current}
                        onClick={async () => {
                          const next = await services.billing.changePlan(p.tier);
                          setSub(next);
                          toast({ title: `Switched to ${p.name}`, description: "Stripe checkout opens here once billing is connected." });
                        }}
                      >
                        {current ? "Your plan" : p.tier === "free" ? "Downgrade" : "Choose " + p.name}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-fg-subtle">Prices are placeholders while we test with early users. Success-fee plans are on hold pending funder rules.</p>
              <h2 className="mt-10 font-display text-xl text-fg">Invoices</h2>
              <DataTable className="mt-3" columns={invoiceColumns} rows={invoices} rowKey={(i) => i.id} caption="Invoices" dense />
            </div>
            <aside className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">This month</p>
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-fg">Full proposals</span>
                    <span className="text-fg-muted tnum">
                      {sub.usage.proposalsThisMonth} of {sub.usage.proposalLimit ?? "unlimited"}
                    </span>
                  </div>
                  {sub.usage.proposalLimit ? <Progress value={(sub.usage.proposalsThisMonth / sub.usage.proposalLimit) * 100} className="mt-2" aria-label="Proposals used" /> : null}
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <span className="text-fg">Matches</span>
                  <span className="text-fg-muted tnum">
                    {sub.usage.matchesThisMonth} of {sub.usage.matchLimit ?? "unlimited"}
                  </span>
                </div>
                <p className="mt-4 text-xs text-fg-subtle">Renews {formatDate(sub.currentPeriodEnd)}.</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Payment method</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-fg">
                  <CreditCard className="size-4 text-fg-subtle" aria-hidden /> Visa ending 4242
                </p>
                <Button variant="link" size="sm" className="mt-1" onClick={() => toast({ title: "Managed in Stripe", description: "The billing portal opens here once connected.", tone: "info" })}>
                  Update card
                </Button>
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
