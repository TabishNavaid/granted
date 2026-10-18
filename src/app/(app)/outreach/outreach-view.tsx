"use client";

import * as React from "react";
import type { ApplicationView, EmailDraft, EmailKind, IntegrationConnection, OrgContact } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Scope = "all" | "drafts" | "sent";
type Via = "gmail" | "outlook";

const kindLabel: Record<EmailKind, string> = {
  intro: "Introduction",
  question: "Question to a program officer",
  loi_cover: "Cover note",
  thank_you: "Thank-you",
  follow_up: "Follow-up",
};

const kindOrder: EmailKind[] = ["intro", "question", "loi_cover", "thank_you", "follow_up"];

const followUpOptions: { value: string; label: string }[] = [
  { value: "none", label: "No reminder" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

function followUpDays(value: string): number | null {
  return value === "none" ? null : Number(value);
}

function statusWord(email: EmailDraft) {
  if (email.status === "sent") return `Sent on ${formatDate(email.sentAt)}`;
  if (email.status === "approved") return "Approved";
  return "Draft";
}

function mailtoHref(email: EmailDraft) {
  return `mailto:${encodeURIComponent(email.to ?? "")}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}

/** Body text with every [confirm: ...] marker set in highlighter, since each one waits on the user. */
function Preview({ body, className }: { body: string; className?: string }) {
  const parts = body.split(/(\[confirm:[^\]]*\])/g);
  return (
    <p className={cn("whitespace-pre-wrap text-base text-ink", className)}>
      {parts.map((part, i) =>
        /^\[confirm:[^\]]*\]$/.test(part) ? (
          <mark key={i} className="highlight">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </p>
  );
}

export function OutreachView({
  emails: initial,
  applications,
  contacts,
  connections,
  demo,
}: {
  emails: EmailDraft[];
  applications: ApplicationView[];
  contacts: OrgContact[];
  connections: IntegrationConnection[];
  demo: boolean;
}) {
  const { toast } = useToast();
  const [emails, setEmails] = React.useState(initial);
  const [scope, setScope] = React.useState<Scope>("all");
  const [open, setOpen] = React.useState<string | null>(null);
  const [drafting, setDrafting] = React.useState(false);
  const [sentFor, setSentFor] = React.useState<EmailDraft | null>(null);
  const [sendFor, setSendFor] = React.useState<{ email: EmailDraft; via: Via } | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<EmailDraft | null>(null);

  const gmail = connections.find((c) => c.provider === "google") ?? null;
  const outlook = connections.find((c) => c.provider === "microsoft") ?? null;

  const counts = {
    all: emails.length,
    drafts: emails.filter((e) => e.status !== "sent").length,
    sent: emails.filter((e) => e.status === "sent").length,
  };
  const visible = emails.filter((e) => (scope === "all" ? true : scope === "sent" ? e.status === "sent" : e.status !== "sent"));

  const replace = (next: EmailDraft) => setEmails((list) => list.map((e) => (e.id === next.id ? next : e)));
  const appFor = (id: string | null) => (id ? (applications.find((a) => a.id === id) ?? null) : null);

  const draftButton = (
    <Button onClick={() => setDrafting(true)} variant="secondary">
      Draft an email
    </Button>
  );

  return (
    <PageContainer width="wide">
      <PageHeader title="Outreach" description="Drafts you read and send yourself; nothing goes out on its own." actions={draftButton} />
      {demo ? <p className="mt-4 text-base text-ink-muted">Demo workspace: drafts here are sample text until a model key is connected.</p> : null}

      {emails.length === 0 ? (
        <EmptyState className="mt-8" title="No emails yet" description="Draft an introduction, a question for a program officer, or a cover note, and it shows up here for you to read first." action={draftButton} />
      ) : (
        <>
          <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="mt-6">
            <TabsList aria-label="Filter emails">
              <TabsTrigger value="all">
                All <span className="text-sm text-ink-muted tnum">{counts.all}</span>
              </TabsTrigger>
              <TabsTrigger value="drafts">
                Drafts <span className="text-sm text-ink-muted tnum">{counts.drafts}</span>
              </TabsTrigger>
              <TabsTrigger value="sent">
                Sent <span className="text-sm text-ink-muted tnum">{counts.sent}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {visible.length === 0 ? (
            <p className="mt-6 text-base text-ink-muted">{scope === "sent" ? "Nothing sent yet." : "No drafts waiting."}</p>
          ) : (
            <ul className="mt-2">
              {visible.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  application={appFor(email.applicationId)}
                  expanded={open === email.id}
                  gmail={gmail}
                  outlook={outlook}
                  onToggle={() => setOpen((cur) => (cur === email.id ? null : email.id))}
                  onSaved={replace}
                  onCopy={async () => {
                    try {
                      await navigator.clipboard.writeText(`${email.subject}\n\n${email.body}`);
                      toast({ title: "Copied", description: "Subject and body are on your clipboard.", tone: "info" });
                    } catch {
                      toast({ title: "Could not copy", description: "Select the text and copy it yourself.", tone: "warning" });
                    }
                  }}
                  onMarkSent={() => setSentFor(email)}
                  onSend={(via) => setSendFor({ email, via })}
                  onDelete={() => setDeleteFor(email)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {drafting ? (
        <DraftDialog
          applications={applications}
          contacts={contacts}
          onClose={() => setDrafting(false)}
          onDrafted={(draft) => {
            setEmails((list) => [draft, ...list]);
            setScope("all");
            setOpen(draft.id);
            setDrafting(false);
            toast({ title: "Draft ready. Read it before anything goes anywhere." });
          }}
        />
      ) : null}

      {sentFor ? (
        <MarkSentDialog
          email={sentFor}
          onClose={() => setSentFor(null)}
          onConfirm={async (days) => {
            const next = await services.outreach.markSent(sentFor.id, "manual", days);
            replace(next);
            setSentFor(null);
            toast({ title: "Marked as sent", description: days ? `We will remind you to follow up in ${days} days.` : "No follow-up reminder set." });
          }}
        />
      ) : null}

      {sendFor ? (
        <SendDialog
          email={sendFor.email}
          via={sendFor.via}
          account={sendFor.via === "gmail" ? gmail : outlook}
          onClose={() => setSendFor(null)}
          onConfirm={async (days) => {
            const result = await services.outreach.send(sendFor.email.id, sendFor.via, days);
            if (!result.ok) {
              toast({ title: "Not sent", description: result.error, tone: "warning" });
              return;
            }
            replace(result.data);
            setSendFor(null);
            toast({ title: "Sent", description: days ? `From your ${sendFor.via === "gmail" ? "Gmail" : "Outlook"} account. We will remind you to follow up in ${days} days.` : `From your ${sendFor.via === "gmail" ? "Gmail" : "Outlook"} account.` });
          }}
        />
      ) : null}

      {deleteFor ? (
        <Dialog open onOpenChange={(o) => !o && setDeleteFor(null)}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Delete this draft?</DialogTitle>
              <DialogDescription>{deleteFor.subject}. This cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteFor(null)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await services.outreach.remove(deleteFor.id);
                  setEmails((list) => list.filter((e) => e.id !== deleteFor.id));
                  setDeleteFor(null);
                  toast({ title: "Deleted", tone: "info" });
                }}
              >
                Delete draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </PageContainer>
  );
}

function EmailRow({
  email,
  application,
  expanded,
  gmail,
  outlook,
  onToggle,
  onSaved,
  onCopy,
  onMarkSent,
  onSend,
  onDelete,
}: {
  email: EmailDraft;
  application: ApplicationView | null;
  expanded: boolean;
  gmail: IntegrationConnection | null;
  outlook: IntegrationConnection | null;
  onToggle: () => void;
  onSaved: (next: EmailDraft) => void;
  onCopy: () => void;
  onMarkSent: () => void;
  onSend: (via: Via) => void;
  onDelete: () => void;
}) {
  const [subject, setSubject] = React.useState(email.subject);
  const [body, setBody] = React.useState(email.body);
  const sent = email.status === "sent";
  const panelId = `email-${email.id}-panel`;

  const save = async () => {
    if (subject === email.subject && body === email.body) return;
    const next = await services.outreach.update(email.id, { subject, body });
    onSaved(next);
  };

  const confirmCount = (email.body.match(/\[confirm:[^\]]*\]/g) ?? []).length;

  return (
    <li className="border-b border-rule">
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} className="block w-full py-5 text-left transition-colors hover:bg-paper-hover">
        <h2 className="font-display text-xl text-ink">{email.subject}</h2>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-ink-muted">Kind</dt>
            <dd className="text-ink">{kindLabel[email.kind]}</dd>
          </div>
          {application ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-muted">Application</dt>
              <dd className="text-ink">{application.opportunity.title}</dd>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <dt className="text-ink-muted">To</dt>
            <dd className="text-ink">{email.toName && email.to ? `${email.toName}, ${email.to}` : (email.toName ?? email.to ?? "Not set")}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-muted">Status</dt>
            <dd className="text-ink">{statusWord(email)}</dd>
          </div>
          {email.followUpAt ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-muted">Follow-up</dt>
              <dd className="text-ink">{formatDate(email.followUpAt)}</dd>
            </div>
          ) : null}
          {!sent && confirmCount > 0 ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-muted">To confirm</dt>
              <dd className="text-ink">
                <mark className="highlight tnum">{confirmCount}</mark>
              </dd>
            </div>
          ) : null}
        </dl>
        {!expanded ? <Preview body={email.body} className="mt-3 line-clamp-2 text-ink-muted" /> : null}
      </button>

      {expanded ? (
        <div id={panelId} className="flex flex-col gap-5 pb-6">
          {sent ? (
            <>
              <p className="text-base font-semibold text-ink">{email.subject}</p>
              <Preview body={email.body} className="max-w-[65ch]" />
            </>
          ) : (
            <>
              <Field id={`email-${email.id}-subject`} label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={save} />
              </Field>
              <Field id={`email-${email.id}-body`} label="Body" hint={confirmCount > 0 ? "Anything in square brackets is something to confirm before this goes out." : undefined}>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={save} className="min-h-64" />
              </Field>
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onCopy}>
              Copy
            </Button>
            {!sent ? (
              <>
                <Button asChild variant="secondary">
                  <a href={mailtoHref(email)}>Open in your mail app</a>
                </Button>
                <Button variant="secondary" onClick={onMarkSent}>
                  Mark as sent
                </Button>
                {gmail ? <Button onClick={() => onSend("gmail")}>Send from Gmail</Button> : null}
                {outlook ? <Button onClick={() => onSend("outlook")}>Send from Outlook</Button> : null}
              </>
            ) : null}
            <Button variant="ghost" onClick={onDelete} className="sm:ml-auto">
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function FollowUpField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field id={id} label="Set a follow-up reminder?">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {followUpOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function MarkSentDialog({ email, onClose, onConfirm }: { email: EmailDraft; onClose: () => void; onConfirm: (days: number | null) => Promise<void> }) {
  const [followUp, setFollowUp] = React.useState("none");
  const [saving, setSaving] = React.useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Mark as sent</DialogTitle>
          <DialogDescription>{email.subject}. We will file it as sent today.</DialogDescription>
        </DialogHeader>
        <FollowUpField id="mark-sent-follow-up" value={followUp} onChange={setFollowUp} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onConfirm(followUpDays(followUp));
              setSaving(false);
            }}
          >
            Mark as sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({ email, via, account, onClose, onConfirm }: { email: EmailDraft; via: Via; account: IntegrationConnection | null; onClose: () => void; onConfirm: (days: number | null) => Promise<void> }) {
  const [followUp, setFollowUp] = React.useState("none");
  const [sending, setSending] = React.useState(false);
  const providerName = via === "gmail" ? "Gmail" : "Outlook";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Send from {providerName}</DialogTitle>
          <DialogDescription>This will send from your connected {providerName} account{account ? `, ${account.accountEmail}` : ""}. Read it once more first.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-2 border-y border-rule py-3 text-base">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-muted">To</dt>
            <dd className="text-ink">{email.toName && email.to ? `${email.toName}, ${email.to}` : (email.to ?? "Not set")}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-muted">Subject</dt>
            <dd className="text-ink">{email.subject}</dd>
          </div>
        </dl>
        <FollowUpField id="send-follow-up" value={followUp} onChange={setFollowUp} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={sending}
            disabled={!email.to}
            onClick={async () => {
              setSending(true);
              await onConfirm(followUpDays(followUp));
              setSending(false);
            }}
          >
            Send from {providerName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftDialog({ applications, contacts, onClose, onDrafted }: { applications: ApplicationView[]; contacts: OrgContact[]; onClose: () => void; onDrafted: (draft: EmailDraft) => void }) {
  const [kind, setKind] = React.useState<EmailKind>("intro");
  const [applicationId, setApplicationId] = React.useState("none");
  const [contactId, setContactId] = React.useState("none");
  const [to, setTo] = React.useState("");
  const [toName, setToName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pickContact = (id: string) => {
    setContactId(id);
    const contact = contacts.find((c) => c.id === id);
    if (contact) {
      setTo(contact.email ?? "");
      setToName(contact.name);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const application = applications.find((a) => a.id === applicationId) ?? null;
    const result = await services.outreach.draft({
      kind,
      applicationId: application?.id ?? null,
      funderId: application?.funder.id ?? null,
      contactId: contactId === "none" ? null : contactId,
      to: to.trim() || null,
      toName: toName.trim() || null,
      notes: notes.trim(),
    });
    setBusy(false);
    if (result.ok) onDrafted(result.data);
    else setError(result.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Draft an email</DialogTitle>
          <DialogDescription>We write it from your confirmed facts. You read it, change it, and send it yourself.</DialogDescription>
        </DialogHeader>
        <Field id="draft-kind" label="Kind">
          <Select value={kind} onValueChange={(v) => setKind(v as EmailKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindOrder.map((k) => (
                <SelectItem key={k} value={k}>
                  {kindLabel[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="draft-application" label="Application" optional>
          <Select value={applicationId} onValueChange={setApplicationId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {applications.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.funder.name}: {a.opportunity.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="draft-contact" label="Contact" optional hint="Choosing one fills in the address and name below.">
          <Select value={contactId} onValueChange={pickContact}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.organization ? `${c.name}, ${c.organization}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="draft-to" label="To (email)" optional>
            <Input type="email" inputMode="email" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@funder.org" />
          </Field>
          <Field id="draft-to-name" label="Their name" optional>
            <Input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Program officer" />
          </Field>
        </div>
        <Field id="draft-notes" label="Anything we should know" optional>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="A past conversation, a question you want answered, a date to mention." className="min-h-24" />
        </Field>
        {error ? (
          <p role="alert" className="border-l-[6px] border-burgundy py-1 pl-4 text-base text-ink">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            {busy ? "Drafting" : "Draft the email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
