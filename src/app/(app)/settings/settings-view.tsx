"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AgentAutonomy, AgentName, Member, NotificationSettings, Organization, ReminderPreview } from "@/lib/types";
import type { UsageSummary } from "@/lib/usage/limits";
import { EMAIL } from "@/lib/brand";
import { services } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentsTab } from "./agents-tab";
import { ReminderOutbox } from "./reminder-outbox";
import { PreviewRole } from "./preview-role";

type Digest = { subject: string; body: string; to: string; canSend: boolean };

interface SettingsViewProps {
  org: Organization;
  members: Member[];
  usage: UsageSummary;
  notifications: NotificationSettings;
  initialTab?: string;
  icsUrl: string;
  currentUserId: string;
  currentRole: Member["role"];
  autonomy: Record<AgentName, AgentAutonomy>;
  outbox: { reminders: ReminderPreview[]; canSend: boolean };
  demo: boolean;
}

export function SettingsView({ org, members: initialMembers, usage, notifications: initialNotif, initialTab, icsUrl, currentUserId, currentRole, autonomy, outbox: initialOutbox, demo }: SettingsViewProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = React.useState(initialTab && ["workspace", "team", "agents", "notifications", "usage"].includes(initialTab) ? initialTab : "workspace");
  const [outbox, setOutbox] = React.useState(initialOutbox);
  const [digest, setDigest] = React.useState<Digest | null>(null);
  const [digestLoading, setDigestLoading] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<{ email: string; url: string } | null>(null);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [inviting, setInviting] = React.useState(false);
  const [members, setMembers] = React.useState(initialMembers);
  const [notif, setNotif] = React.useState(initialNotif);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Member["role"]>("reviewer");

  const updateNotif = async (patch: Partial<NotificationSettings>) => {
    setNotif((n) => ({ ...n, ...patch }));
    try {
      await services.account.updateNotificationSettings(patch);
      setOutbox(await services.calendar.reminderOutbox());
    } catch (err) {
      toast({ title: "Not saved", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    }
  };

  const openDigest = async () => {
    setDigestLoading(true);
    try {
      setDigest(await services.integrations.digestPreview());
    } catch (err) {
      toast({ title: "Could not build the digest", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setDigestLoading(false);
    }
  };

  const copyInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      toast({ title: "Could not copy", description: "Select the link and copy it by hand.", tone: "warning" });
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Workspace, team, agents, notifications, and usage." />
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList variant="line" aria-label="Settings sections">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
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
            <div>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
          <div className="mt-12 max-w-lg border-l-2 border-alert pl-5">
            <h2 className="font-display text-xl text-ink">Delete workspace</h2>
            <p className="mt-2 text-base text-ink-muted">This removes your profile, documents, and drafts for everyone on the team. It cannot be undone.</p>
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
                        try {
                          const next = await services.org.updateMemberRole(m.id, v as Member["role"]);
                          setMembers((l) => l.map((x) => (x.id === m.id ? { ...x, role: next.role } : x)));
                        } catch (err) {
                          toast({ title: "Role not changed", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
                        }
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
                          try {
                            await services.org.removeMember(m.id);
                            setMembers((l) => l.filter((x) => x.id !== m.id));
                            if (inviteLink?.email === m.email) setInviteLink(null);
                            toast({ title: "Removed", description: `${m.email} no longer has access.`, tone: "info" });
                          } catch (err) {
                            toast({ title: "Not removed", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
                          }
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
              setInviting(true);
              try {
                const m = await services.org.inviteMember(inviteEmail, inviteRole);
                setMembers((l) => [...l, m]);
                setInviteEmail("");
                if (demo) {
                  setInviteLink({ email: m.email, url: `${window.location.origin}/sign-up?invite=${encodeURIComponent(m.email)}` });
                  toast({ title: "Invite ready", description: `Share the sign-up link with ${m.email}.` });
                } else {
                  toast({ title: "Invitation sent", description: `${m.email} can join as ${inviteRole === "reviewer" ? "a board reviewer" : "an editor"}.` });
                }
              } catch (err) {
                toast({ title: "Could not invite", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
              } finally {
                setInviting(false);
              }
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
            <Button type="submit" variant="secondary" className="h-11" loading={inviting}>
              {demo ? "Create invite" : "Send invite"}
            </Button>
          </form>
          {inviteLink ? (
            <div className="mt-4 max-w-xl border-l-[6px] border-ink py-2 pl-4">
              <p className="text-base font-semibold text-ink">Sign-up link for {inviteLink.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate bg-paper-tint px-2 py-1 text-xs text-ink">{inviteLink.url}</code>
                <Button variant="secondary" size="sm" onClick={() => copyInvite(inviteLink.url)}>
                  {linkCopied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <p className="mt-2 text-sm text-ink-muted">Invite emails send once email is set up. Until then, send this link yourself.</p>
            </div>
          ) : null}
          <p className="mt-3 max-w-[60ch] text-sm text-ink-muted">Reviewers can approve things in the Inbox but cannot edit drafts. Board members usually want exactly this. Assign milestones to teammates from the Calendar.</p>
          {demo ? (
            <PreviewRole
              role={currentRole}
              onChanged={(m) => setMembers((l) => l.map((x) => (x.id === m.id ? { ...x, role: m.role } : x)))}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab initial={autonomy} isOwner={currentRole === "owner"} />
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
              The weekly digest goes out only once email delivery is connected on the{" "}
              <a href="/settings/integrations" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                Integrations page
              </a>
              .
            </p>
            <Button variant="secondary" size="sm" className="mt-3" loading={digestLoading} onClick={openDigest}>
              Preview this week&rsquo;s digest
            </Button>
          </div>
          <div className="max-w-lg border-t border-rule">
            {[
              { key: "weeklyDigest" as const, label: "Weekly match digest", desc: "A weekly email with new matches and the next two weeks of deadlines." },
              { key: "milestoneReminders" as const, label: "Milestone reminders", desc: "An email before each milestone. Not sending yet. Your choice is saved for when it does." },
              { key: "inboxAlerts" as const, label: "Inbox alerts", desc: "An email when a draft or plan is waiting for you. Not sending yet." },
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
          <section aria-labelledby="reminder-emails-title" className="mt-12 max-w-2xl">
            <h2 id="reminder-emails-title" className="font-display text-2xl text-ink">
              Reminder emails
            </h2>
            <p className="mt-1 text-sm text-ink-muted">What goes out before each milestone, and when. It follows the settings above.</p>
            <ReminderOutbox reminders={outbox.reminders} canSend={outbox.canSend} enabled={notif.milestoneReminders} className="mt-3" />
          </section>
        </TabsContent>

        <TabsContent value="usage">
          <section aria-labelledby="usage-title" className="max-w-2xl">
            <h2 id="usage-title" className="font-display text-2xl text-ink">
              This month
            </h2>
            <p className="mt-1 max-w-[60ch] text-base text-ink-muted">
              FundFellows is free. Each workspace has a monthly allowance of AI work, which covers what the model behind it costs us. The count starts again on {formatDate(usage.resetsOn)}.
            </p>
            <ul className="mt-6 border-t border-rule">
              {usage.lines.map((line) => (
                <li key={line.kind} className="border-b border-rule py-5">
                  <p className="text-base font-semibold text-ink tnum">{line.sentence}</p>
                  <Progress value={Math.min(100, (line.used / line.limit) * 100)} className="mt-3 max-w-md" aria-label={line.sentence} />
                  <p className="mt-2 text-sm text-ink-muted">{line.what}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-[60ch] text-sm text-ink-muted">Searching the opportunity database, the calendar, and exports never count. If you reach a limit and need more this month, write to {EMAIL.support}.</p>
          </section>
        </TabsContent>
      </Tabs>
      <Dialog open={!!digest} onOpenChange={(o) => !o && setDigest(null)}>
        <DialogContent size="lg">
          {digest ? (
            <>
              <DialogHeader>
                <DialogTitle>This week&rsquo;s digest</DialogTitle>
                <DialogDescription>
                  {digest.canSend ? "This is the email as it goes out this week." : "This is the email as it would read. Sending needs email set up first."}
                </DialogDescription>
              </DialogHeader>
              <div className="border-y border-rule">
                <dl className="flex flex-col gap-1 border-b border-rule py-2.5 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-ink-muted">To</dt>
                    <dd className="min-w-0 truncate font-semibold text-ink">{digest.to || "You"}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-ink-muted">Subject</dt>
                    <dd className="font-semibold text-ink">{digest.subject}</dd>
                  </div>
                </dl>
                <p className="whitespace-pre-line py-4 text-base leading-relaxed text-ink">{digest.body}</p>
              </div>
              <DialogFooter>
                {!digest.canSend ? (
                  <Button variant="secondary" asChild>
                    <a href="/settings/integrations">Set up email</a>
                  </Button>
                ) : null}
                <Button onClick={() => setDigest(null)}>Close</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
