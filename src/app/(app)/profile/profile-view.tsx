"use client";

import * as React from "react";
import { Check, FileText, FileUp, History, Pencil, Trash2, UploadCloud } from "lucide-react";
import type { Boilerplate, Document, Fact, Organization } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { formatDate, relativeTime, wordCount } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { CitationChip } from "@/components/app/citation-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const docTypeLabel: Record<Document["type"], string> = {
  annual_report: "Annual report",
  past_proposal: "Past proposal",
  form_990: "Form 990",
  budget: "Budget",
  board_list: "Board list",
  determination_letter: "IRS letter",
  other: "Other",
};

export function ProfileView({ org: initialOrg, facts: initialFacts, boilerplates: initialBp, documents: initialDocs, initialTab }: { org: Organization; facts: Fact[]; boilerplates: Boilerplate[]; documents: Document[]; initialTab?: string }) {
  const { toast } = useToast();
  const [org, setOrg] = React.useState(initialOrg);
  const [facts, setFacts] = React.useState(initialFacts);
  const [bps, setBps] = React.useState(initialBp);
  const [docs, setDocs] = React.useState(initialDocs);
  const [tab, setTab] = React.useState(initialTab && ["overview", "facts", "boilerplate", "documents"].includes(initialTab) ? initialTab : "overview");
  const [editing, setEditing] = React.useState(false);
  const [editingFact, setEditingFact] = React.useState<Fact | null>(null);
  const [editingBp, setEditingBp] = React.useState<Boilerplate | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const docById = (id: string | null) => docs.find((d) => d.id === id);
  const needsReview = facts.filter((f) => f.status !== "confirmed").length;

  const confirm = async (f: Fact) => {
    const next = await services.knowledge.confirmFact(f.id);
    setFacts((l) => l.map((x) => (x.id === f.id ? next : x)));
    toast({ title: "Confirmed", description: `${f.label} is current as of today.` });
  };

  const addFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const d = await services.knowledge.addDocument({ name: file.name, size: file.size, type: file.type });
      setDocs((l) => [d, ...l]);
      setTimeout(async () => setDocs(await services.knowledge.listDocuments()), 3000);
    }
    toast({ title: "Uploading", description: "The Profile agent will read it and suggest any new facts in your Inbox.", tone: "info" });
  };

  const factColumns: Column<Fact>[] = [
    { key: "label", header: "Fact", cell: (f) => (
      <div>
        <p className="font-medium text-fg">{f.label}</p>
        <p className="text-xs text-fg-subtle sm:hidden">{f.value}</p>
      </div>
    ) },
    { key: "value", header: "Value", hideBelow: "sm", cell: (f) => <span className="font-display text-base text-fg">{f.value}</span> },
    { key: "source", header: "Source", hideBelow: "md", cell: (f) => {
      const d = docById(f.sourceDocumentId);
      return <CitationChip label={d ? `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}` : "You"} sourceTitle={d?.title} excerpt={f.sourceExcerpt} page={f.sourcePage} verifiedAt={f.lastConfirmedAt} />;
    } },
    { key: "status", header: "Status", cell: (f) => (
      f.status === "confirmed" ? <span className="text-xs text-fg-subtle">Confirmed {formatDate(f.lastConfirmedAt, "MMM yyyy")}</span>
      : <Badge variant="warning">{f.status === "stale" ? "Over a year old" : "Needs review"}</Badge>
    ) },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (f) => (
      <div className="flex justify-end gap-1">
        {f.status !== "confirmed" ? (
          <Button variant="soft" size="sm" onClick={() => confirm(f)}>
            <Check aria-hidden /> Still true
          </Button>
        ) : null}
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${f.label}`} onClick={() => setEditingFact(f)}>
          <Pencil />
        </Button>
      </div>
    ) },
  ];

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Profile and knowledge"
        description="Everything the agents know about you. Every number has a source, and nothing goes into a proposal that is not on this page."
      />
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList aria-label="Knowledge base sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="facts">
            Facts {needsReview ? <Badge variant="warning" className="px-1.5 py-0 tnum">{needsReview}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="boilerplate">Boilerplate</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-fg">{org.name}</h2>
                  <p className="mt-1 text-sm text-fg-muted">
                    EIN {org.ein} · {org.city}, {org.state} · Founded {org.foundedYear}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden /> Edit
                </Button>
              </div>
              <p className="mt-5 font-display text-lg leading-relaxed text-fg">{org.mission}</p>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Causes</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">{org.causes.map((c) => <Badge key={c} variant="neutral">{c}</Badge>)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Who we serve</dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">{org.populations.map((c) => <Badge key={c} variant="neutral">{c}</Badge>)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Service area</dt>
                  <dd className="mt-1 text-sm text-fg">{org.serviceArea}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Website</dt>
                  <dd className="mt-1 text-sm">
                    <a href={org.websiteUrl} className="text-accent underline-offset-2 hover:underline" target="_blank" rel="noreferrer">{org.websiteUrl.replace(/^https?:\/\//, "")}</a>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">At a glance</p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    ["Budget", `$${(org.annualBudget / 1000).toFixed(0)}K`],
                    ["Staff", String(org.staffCount)],
                    ["Volunteers", String(org.volunteerCount)],
                    ["Fiscal year end", org.fiscalYearEnd],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-fg-subtle">{k}</dt>
                      <dd className="font-display text-xl text-fg">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Knowledge base</p>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  <li className="flex justify-between"><span className="text-fg-muted">Facts with sources</span><span className="font-medium text-fg tnum">{facts.length}</span></li>
                  <li className="flex justify-between"><span className="text-fg-muted">Boilerplate pieces</span><span className="font-medium text-fg tnum">{bps.length}</span></li>
                  <li className="flex justify-between"><span className="text-fg-muted">Documents</span><span className="font-medium text-fg tnum">{docs.length}</span></li>
                  <li className="flex justify-between"><span className="text-fg-muted">Need your review</span><span className={cn("font-medium tnum", needsReview ? "text-warning" : "text-fg")}>{needsReview}</span></li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="facts">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">Numbers the agents are allowed to use. Facts older than a year ask to be re-confirmed.</p>
          </div>
          <DataTable columns={factColumns} rows={[...facts].sort((a, b) => (a.status === "confirmed" ? 1 : 0) - (b.status === "confirmed" ? 1 : 0))} rowKey={(f) => f.id} caption="Organization facts and their sources" />
        </TabsContent>

        <TabsContent value="boilerplate">
          <p className="mb-4 text-sm text-fg-muted">Reusable paragraphs written from your documents. Each edit saves a new version.</p>
          <ul className="grid gap-4 md:grid-cols-2">
            {bps.map((b) => (
              <li key={b.id} className="flex flex-col rounded-lg border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg text-fg">{b.title}</h3>
                    <p className="text-xs text-fg-subtle">
                      Version {b.version} · {b.wordCount} words · updated {relativeTime(b.updatedAt)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingBp(b)}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                </div>
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-fg-muted">{b.body}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {b.sourceDocumentIds.map((id) => {
                    const d = docById(id);
                    return d ? <CitationChip key={id} label={d.title} sourceTitle={d.title} /> : null;
                  })}
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="documents">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
            className={cn("flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors", dragOver ? "border-accent bg-accent-soft/40" : "border-border-strong bg-surface")}
          >
            <UploadCloud className="size-6 text-accent" aria-hidden />
            <p className="mt-3 font-medium text-fg">Drop a document here</p>
            <p className="mt-1 max-w-sm text-sm text-fg-muted">Annual reports, past proposals, 990s, budgets. PDF, Word, or Excel up to 25 MB. We read them and pull out facts with page numbers.</p>
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" className="sr-only" id="doc-upload" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            <Button variant="secondary" className="mt-4" onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden /> Choose files
            </Button>
          </div>
          <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-fg-muted" aria-hidden>
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{d.title}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {docTypeLabel[d.type]} · {(d.sizeBytes / 1_000_000).toFixed(1)} MB{d.pageCount ? ` · ${d.pageCount} pages` : ""} · uploaded {formatDate(d.uploadedAt)}
                  </p>
                </div>
                {d.status === "ready" ? (
                  <Badge variant="success">{d.factCount} fact{d.factCount === 1 ? "" : "s"}</Badge>
                ) : d.status === "extracting" ? (
                  <span className="flex items-center gap-2 text-xs text-fg-muted">
                    <Skeleton className="h-2 w-16" /> Reading
                  </span>
                ) : d.status === "failed" ? (
                  <Badge variant="danger">Could not read</Badge>
                ) : (
                  <Badge variant="neutral">Uploaded</Badge>
                )}
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.title}`} onClick={async () => { await services.knowledge.removeDocument(d.id); setDocs((l) => l.filter((x) => x.id !== d.id)); }}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Changes here are used in every future draft.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const next = await services.org.update({ name: String(fd.get("name")), mission: String(fd.get("mission")), serviceArea: String(fd.get("serviceArea")) });
              setOrg(next);
              setEditing(false);
              toast({ title: "Profile saved" });
            }}
          >
            <Field id="org-name" label="Organization name">
              <Input name="name" defaultValue={org.name} />
            </Field>
            <Field id="org-mission" label="Mission">
              <Textarea name="mission" defaultValue={org.mission} />
            </Field>
            <Field id="org-area" label="Service area" hint="Counties, cities, or ZIP codes. Funders filter on this.">
              <Input name="serviceArea" defaultValue={org.serviceArea} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFact} onOpenChange={(o) => !o && setEditingFact(null)}>
        <DialogContent size="sm">
          {editingFact ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const next = await services.knowledge.updateFact(editingFact.id, { value: String(fd.get("value")), status: "confirmed", lastConfirmedAt: new Date().toISOString(), sourceExcerpt: `Updated by Dana Okafor on ${formatDate(new Date().toISOString())}` });
                setFacts((l) => l.map((f) => (f.id === next.id ? next : f)));
                setEditingFact(null);
                toast({ title: "Fact updated", description: "You are now listed as the source." });
              }}
            >
              <DialogHeader>
                <DialogTitle>{editingFact.label}</DialogTitle>
                <DialogDescription>Current source: {docById(editingFact.sourceDocumentId)?.title ?? "you"}. If you change the value, you become the source.</DialogDescription>
              </DialogHeader>
              <Field id="fact-value" label="Value">
                <Input name="value" defaultValue={editingFact.value} />
              </Field>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditingFact(null)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBp} onOpenChange={(o) => !o && setEditingBp(null)}>
        <DialogContent size="lg">
          {editingBp ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const body = String(new FormData(e.currentTarget).get("body"));
                const next = await services.knowledge.updateBoilerplate(editingBp.id, body);
                setBps((l) => l.map((b) => (b.id === next.id ? next : b)));
                setEditingBp(null);
                toast({ title: `Saved as version ${next.version}` });
              }}
            >
              <DialogHeader>
                <DialogTitle>{editingBp.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5">
                  <History className="size-3.5" aria-hidden /> Version {editingBp.version}. Saving creates version {editingBp.version + 1}; older versions are kept.
                </DialogDescription>
              </DialogHeader>
              <Field id="bp-body" label="Text" hint={`${wordCount(editingBp.body)} words`}>
                <Textarea name="body" defaultValue={editingBp.body} className="min-h-64 font-display text-base" />
              </Field>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditingBp(null)}>Cancel</Button>
                <Button type="submit">Save new version</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
