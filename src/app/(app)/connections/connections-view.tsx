"use client";

import * as React from "react";
import Link from "next/link";
import type { ApplicationView, ContactKind, ContactNote, EmailDraft, OrgContact } from "@/lib/types";
import { services } from "@/lib/services";
import { parseCsv, rowToContact } from "@/lib/services/shared";
import { formatDate, relativeTime } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const kindLabel: Record<ContactKind, string> = {
  board: "Board member",
  staff: "Staff",
  funder: "Funder staff",
  partner: "Partner",
  volunteer: "Volunteer",
  other: "Other",
};

const kindOrder: ContactKind[] = ["board", "staff", "funder", "partner", "volunteer", "other"];

type NoteKind = ContactNote["kind"];

const noteKindLabel: Record<NoteKind, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  intro: "Introduction",
};

const noteKindOrder: NoteKind[] = ["note", "call", "email", "meeting", "intro"];

type Filter = "all" | "board" | "funder" | "partner";

const NO_APPLICATION = "none";

export function ConnectionsView({ contacts: initial, applications, demo }: { contacts: OrgContact[]; applications: ApplicationView[]; demo: boolean }) {
  const { toast } = useToast();
  const [contacts, setContacts] = React.useState(initial);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;
  const visible = filter === "all" ? contacts : contacts.filter((c) => c.kind === filter);

  const open = (c: OrgContact) => {
    setSelectedId(c.id);
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  };

  const reload = async () => setContacts(await services.contacts.list());

  const importFile = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setImporting(false);
      toast({ title: "Could not read the file", description: "Try saving it again as a CSV and importing once more.", tone: "warning" });
    };
    reader.onload = async () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const rows = parseCsv(text)
          .map(rowToContact)
          .filter((r): r is NonNullable<ReturnType<typeof rowToContact>> => r !== null);
        if (rows.length === 0) {
          toast({ title: "Nothing to import", description: "We could not find a Name column, or a First name and Last name pair, in that file.", tone: "warning" });
          return;
        }
        const result = await services.contacts.importRows(rows);
        await reload();
        toast({ title: "Import finished", description: `${result.added} added, ${result.skipped} skipped` });
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const actions = (
    <>
      <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={importing}>
        {importing ? "Importing" : "Import a CSV"}
      </Button>
      <Button onClick={() => setAdding(true)}>Add a person</Button>
    </>
  );

  const columns: Column<OrgContact>[] = [
    {
      key: "name",
      header: "Name",
      cell: (c) => (
        <div>
          <p className="font-semibold text-ink">{c.name}</p>
          {c.organization ? <p className="text-xs text-ink-muted">{c.organization}</p> : null}
        </div>
      ),
    },
    { key: "role", header: "Role", hideBelow: "sm", cell: (c) => <span className="text-ink">{c.role || "Not listed"}</span> },
    { key: "kind", header: "Kind", hideBelow: "md", cell: (c) => <span className="text-ink">{kindLabel[c.kind]}</span> },
    { key: "touch", header: "Last touch", hideBelow: "sm", cell: (c) => <span className="text-ink-muted">{c.lastTouchAt ? relativeTime(c.lastTouchAt) : "Never"}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => (
        <Button variant={c.id === selectedId ? "secondary" : "ghost"} size="sm" aria-pressed={c.id === selectedId} onClick={() => open(c)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <PageContainer width="wide">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a CSV file to import"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
        }}
      />
      <PageHeader title="Connections" description="The people your organization already knows, and who could make an introduction." actions={contacts.length ? actions : undefined} />
      {demo ? <p className="mt-4 text-sm text-ink-muted">Demo workspace: the people here are sample data.</p> : null}
      <p className="mt-2 max-w-[65ch] text-sm text-ink-muted">A CSV with Name, Organization, Role, Email, Phone, Relationship columns, or a LinkedIn connections export, works.</p>

      {contacts.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Nobody here yet"
          description="Add the people your board, staff, and partners already know. When a funder appears in your pipeline, we can draft the introduction request for them to send."
          action={<div className="flex flex-wrap gap-2">{actions}</div>}
        />
      ) : (
        <>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-8">
            <TabsList variant="line" aria-label="Filter people by kind">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="funder">Funder staff</TabsTrigger>
              <TabsTrigger value="partner">Partners</TabsTrigger>
            </TabsList>
          </Tabs>
          <DataTable
            className="mt-6"
            columns={columns}
            rows={visible}
            rowKey={(c) => c.id}
            caption="People your organization knows"
            emptyMessage={filter === "all" ? "Nobody here yet." : `Nobody filed under ${filter === "funder" ? "funder staff" : filter === "board" ? "board" : "partners"} yet.`}
          />
        </>
      )}

      {selected ? (
        <div ref={detailRef} className="mt-10 scroll-mt-16 lg:scroll-mt-6">
          <ContactDetail
            key={selected.id}
            contact={selected}
            applications={applications}
            onClose={() => setSelectedId(null)}
            onChange={(next) => setContacts((list) => list.map((c) => (c.id === next.id ? next : c)))}
            onRemoved={() => {
              setContacts((list) => list.filter((c) => c.id !== selected.id));
              setSelectedId(null);
              toast({ title: "Removed", description: `${selected.name} is no longer in your connections.` });
            }}
          />
        </div>
      ) : null}

      {adding ? (
        <AddPersonDialog
          onClose={() => setAdding(false)}
          onAdded={(c) => {
            setContacts((list) => [c, ...list]);
            setAdding(false);
            toast({ title: "Added", description: `${c.name} is in your connections.` });
          }}
        />
      ) : null}
    </PageContainer>
  );
}

function ContactDetail({ contact, applications, onClose, onChange, onRemoved }: { contact: OrgContact; applications: ApplicationView[]; onClose: () => void; onChange: (c: OrgContact) => void; onRemoved: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: contact.name,
    organization: contact.organization,
    role: contact.role,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    kind: contact.kind,
    relationship: contact.relationship,
  });

  const [notes, setNotes] = React.useState<ContactNote[] | null>(null);
  const [noteKind, setNoteKind] = React.useState<NoteKind>("note");
  const [noteText, setNoteText] = React.useState("");
  const [nextStep, setNextStep] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);

  const [applicationId, setApplicationId] = React.useState<string>(NO_APPLICATION);
  const [drafting, setDrafting] = React.useState(false);
  const [draft, setDraft] = React.useState<EmailDraft | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    services.contacts.listNotes(contact.id).then((list) => {
      if (!cancelled) setNotes(list);
    });
    return () => {
      cancelled = true;
    };
  }, [contact.id]);

  const startEdit = () => {
    setForm({
      name: contact.name,
      organization: contact.organization,
      role: contact.role,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      kind: contact.kind,
      relationship: contact.relationship,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const next = await services.contacts.update(contact.id, {
        name: form.name.trim(),
        organization: form.organization.trim(),
        role: form.role.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        kind: form.kind,
        relationship: form.relationship.trim(),
      });
      onChange(next);
      setEditing(false);
      toast({ title: "Saved", description: `${next.name} is up to date.` });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await services.contacts.remove(contact.id);
      onRemoved();
    } finally {
      setRemoving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const n = await services.contacts.addNote(contact.id, { kind: noteKind, note: noteText.trim(), nextStep: nextStep.trim() || null });
      setNotes((list) => [n, ...(list ?? [])]);
      setNoteText("");
      setNextStep("");
      setNoteKind("note");
      onChange({ ...contact, lastTouchAt: n.happenedAt });
    } finally {
      setAddingNote(false);
    }
  };

  const draftIntro = async () => {
    setDrafting(true);
    setDraft(null);
    setDraftError(null);
    try {
      const result = await services.contacts.draftIntroRequest(contact.id, applicationId === NO_APPLICATION ? null : applicationId);
      if (result.ok) setDraft(result.data);
      else setDraftError(result.error);
    } finally {
      setDrafting(false);
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      toast({ title: "Copied", description: "The subject and body are on your clipboard." });
    } catch {
      toast({ title: "Could not copy", description: "Select the text and copy it yourself.", tone: "warning" });
    }
  };

  const sortedNotes = notes ? [...notes].sort((a, b) => (a.happenedAt < b.happenedAt ? 1 : -1)) : null;

  return (
    <section aria-labelledby="contact-detail-title" className="border border-ink bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="contact-detail-title" className="font-display text-3xl text-ink">
            {contact.name}
          </h2>
          <p className="mt-1 text-base text-ink-muted">{kindLabel[contact.kind]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <Button variant="secondary" size="sm" onClick={startEdit}>
              Edit
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {editing ? (
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field id="edit-name" label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field id="edit-organization" label="Organization" optional>
            <Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
          </Field>
          <Field id="edit-role" label="Role" optional>
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </Field>
          <Field id="edit-kind" label="Kind">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as ContactKind })}>
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
          <Field id="edit-email" label="Email" optional>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field id="edit-phone" label="Phone" optional>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field id="edit-relationship" label="How you know them" optional className="sm:col-span-2">
            <Textarea value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="min-h-20" />
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" loading={saving}>
              {saving ? "Saving" : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-ink">Organization</dt>
            <dd className="mt-0.5 text-base text-ink">{contact.organization || "Not listed"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Role</dt>
            <dd className="mt-0.5 text-base text-ink">{contact.role || "Not listed"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Email</dt>
            <dd className="mt-0.5 text-base text-ink">
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                  {contact.email}
                </a>
              ) : (
                "Not listed"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink">Phone</dt>
            <dd className="mt-0.5 text-base text-ink tnum">{contact.phone || "Not listed"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-semibold text-ink">How you know them</dt>
            <dd className="mt-0.5 max-w-[65ch] text-base text-ink">{contact.relationship || "Not written down yet."}</dd>
          </div>
        </dl>
      )}

      <div className="mt-8 border-t border-rule pt-6">
        <h3 className="font-display text-xl text-ink">Ask for an introduction</h3>
        <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">We write the request. {contact.name} sends it, in their own name, to the funder they know.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field id="intro-application" label="For which application" className="min-w-0 flex-1">
            <Select value={applicationId} onValueChange={setApplicationId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_APPLICATION}>No specific application</SelectItem>
                {applications.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.funder.name}: {a.opportunity.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button variant="secondary" onClick={draftIntro} loading={drafting} className="shrink-0">
            {drafting ? "Drafting" : "Draft the introduction request"}
          </Button>
        </div>
        {draftError ? (
          <p role="alert" className="mt-4 border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
            {draftError}
          </p>
        ) : null}
        {draft ? (
          <div className="mt-4 border border-ink bg-paper-tint p-4">
            <p className="text-sm font-semibold text-ink">Subject</p>
            <p className="mt-0.5 text-base text-ink">{draft.subject}</p>
            <p className="mt-4 text-sm font-semibold text-ink">Body</p>
            <pre className="mt-0.5 whitespace-pre-wrap font-body text-base leading-relaxed text-ink">{draft.body}</pre>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={copyDraft}>
                Copy
              </Button>
              <Button asChild variant="link" size="sm">
                <Link href="/outreach">Open it in Outreach</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 border-t border-rule pt-6">
        <h3 className="font-display text-xl text-ink">Relationship log</h3>
        {sortedNotes === null ? (
          <p className="mt-3 text-sm text-ink-muted">Loading the log.</p>
        ) : sortedNotes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Nothing logged yet. The first note goes below.</p>
        ) : (
          <ol className="mt-3 border-t border-rule">
            {sortedNotes.map((n) => (
              <li key={n.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-3 sm:grid-cols-[8rem_1fr]">
                <div className="text-sm text-ink-muted">
                  <p className="font-semibold text-ink">{noteKindLabel[n.kind]}</p>
                  <p className="tnum">{formatDate(n.happenedAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-base text-ink">{n.note}</p>
                  {n.nextStep ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      <span className="font-semibold text-ink">Next step</span> {n.nextStep}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        <form
          className="mt-5 grid gap-4 sm:grid-cols-[10rem_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            addNote();
          }}
        >
          <Field id="note-kind" label="Kind">
            <Select value={noteKind} onValueChange={(v) => setNoteKind(v as NoteKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {noteKindOrder.map((k) => (
                  <SelectItem key={k} value={k}>
                    {noteKindLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="note-text" label="Note">
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What happened, in a sentence or two." className="min-h-20" required />
          </Field>
          <Field id="note-next" label="Next step" optional className="sm:col-start-2">
            <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Follow up after the board meeting" />
          </Field>
          <div className="sm:col-start-2">
            <Button type="submit" variant="secondary" loading={addingNote} disabled={!noteText.trim()}>
              {addingNote ? "Adding" : "Add note"}
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-8 border-t border-rule pt-5">
        {confirmingRemove ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-base text-ink">Remove {contact.name} and their log from your connections?</p>
            <Button variant="danger" size="sm" onClick={remove} loading={removing}>
              {removing ? "Removing" : "Yes, remove them"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)}>
              Keep them
            </Button>
          </div>
        ) : (
          <Button variant="danger-ghost" size="sm" onClick={() => setConfirmingRemove(true)}>
            Remove
          </Button>
        )}
      </div>
    </section>
  );
}

function AddPersonDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (c: OrgContact) => void }) {
  const [form, setForm] = React.useState({ name: "", organization: "", role: "", email: "", phone: "", kind: "board" as ContactKind, relationship: "" });
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const c = await services.contacts.add({
        name: form.name.trim(),
        organization: form.organization.trim(),
        role: form.role.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        kind: form.kind,
        relationship: form.relationship.trim(),
        funderId: null,
      });
      onAdded(c);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>Someone your organization knows: a board member, a partner, a program officer, a volunteer.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field id="add-name" label="Name" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
          </Field>
          <Field id="add-organization" label="Organization" optional>
            <Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
          </Field>
          <Field id="add-role" label="Role" optional>
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </Field>
          <Field id="add-email" label="Email" optional>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field id="add-phone" label="Phone" optional>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field id="add-kind" label="Kind">
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as ContactKind })}>
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
          <Field id="add-relationship" label="How you know them" optional className="sm:col-span-2">
            <Textarea value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="Sat on our board 2019 to 2023. Knows the program officer at Meridian." className="min-h-20" />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!form.name.trim()}>
              {saving ? "Adding" : "Add this person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
