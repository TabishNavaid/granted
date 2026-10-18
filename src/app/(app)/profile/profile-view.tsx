"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
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
    toast({ title: "Confirmed", description: `${f.label} is good as of today. Thanks for checking.` });
  };

  const [uploading, setUploading] = React.useState<string | null>(null);
  const addFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setUploading(file.name);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", /990/.test(file.name) ? "form_990" : /annual|report/i.test(file.name) ? "annual_report" : /proposal|loi/i.test(file.name) ? "past_proposal" : /budget/i.test(file.name) ? "budget" : "other");
      try {
        const r = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const data = (await r.json()) as { ok: boolean; error?: string; document?: Document; extraction?: { ok: boolean; factCount?: number; error?: string } };
        if (!r.ok || !data.ok || !data.document) {
          toast({ title: `Could not read ${file.name}`, description: data.error ?? "Try again in a moment.", tone: "warning" });
          continue;
        }
        setDocs((l) => [data.document!, ...l]);
        if (data.extraction?.ok) {
          setFacts(await services.knowledge.listFacts());
          toast({ title: `${data.extraction.factCount ?? 0} facts found in ${data.document.title}`, description: "They are waiting for your review in the Facts tab." });
        } else {
          toast({ title: `${data.document.title} uploaded`, description: data.extraction?.error ?? "Stored. Facts can be read from it once a model key is connected.", tone: "info" });
        }
      } catch {
        toast({ title: `Could not upload ${file.name}`, description: "Check your connection and try again.", tone: "warning" });
      }
    }
    setUploading(null);
  };
  const extract = async (d: Document) => {
    setUploading(d.title);
    const r = await services.knowledge.extractDocument(d.id);
    setUploading(null);
    if (!r.ok) return toast({ title: "Could not read it", description: r.error, tone: "warning" });
    setFacts(await services.knowledge.listFacts());
    setDocs(await services.knowledge.listDocuments());
    toast({ title: `${r.data.factCount} facts found`, description: "They are waiting for your review in the Facts tab." });
  };
  const [addingBp, setAddingBp] = React.useState(false);

  const factColumns: Column<Fact>[] = [
    { key: "label", header: "Fact", cell: (f) => (
      <div>
        <p className="font-semibold text-ink">{f.label}</p>
        <p className="text-xs text-ink-muted sm:hidden">{f.value}</p>
      </div>
    ) },
    { key: "value", header: "Value", hideBelow: "sm", cell: (f) => <span className="font-display text-base text-ink">{f.value}</span> },
    { key: "source", header: "Source", hideBelow: "md", cell: (f) => {
      const d = docById(f.sourceDocumentId);
      return <CitationChip label={d ? `${d.title}${f.sourcePage ? `, p.${f.sourcePage}` : ""}` : f.sourceLabel ?? (f.sourceUrl ? "Website" : "You")} sourceTitle={d?.title ?? f.sourceLabel ?? undefined} url={f.sourceUrl} excerpt={f.sourceExcerpt} page={f.sourcePage} verifiedAt={f.lastConfirmedAt} />;
    } },
    { key: "status", header: "Status", cell: (f) => (
      f.status === "confirmed" ? <span className="text-sm text-ink-muted">Confirmed {formatDate(f.lastConfirmedAt, "MMM yyyy")}</span>
      : <Badge variant="warning">{f.status === "stale" ? "Over a year old" : "Check this"}</Badge>
    ) },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (f) => (
      <div className="flex justify-end gap-1">
        {f.status !== "confirmed" ? (
          <Button variant="secondary" size="sm" onClick={() => confirm(f)}>
            Still true
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
        description="What drafts are allowed to say about you. Every number has a source, and nothing goes into a proposal that is not on this page."
      />
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList variant="line" aria-label="Knowledge base sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="facts">
            Facts {needsReview ? <span className="count">{needsReview}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="boilerplate">Boilerplate</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="font-display text-3xl text-ink">{org.name}</h2>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
                <div className="flex gap-1.5">
                  <dt>EIN</dt>
                  <dd className="font-semibold text-ink tnum">{org.ein}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>City</dt>
                  <dd className="font-semibold text-ink">
                    {org.city}, {org.state}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Founded</dt>
                  <dd className="font-semibold text-ink tnum">{org.foundedYear ?? "Not stated"}</dd>
                </div>
              </dl>
              <p className="mt-6 max-w-[65ch] text-xl leading-relaxed text-ink">{org.mission}</p>
              <dl className="mt-8 flex flex-col gap-5 border-t border-rule pt-6">
                <div>
                  <dt className="text-sm font-semibold text-ink">Causes</dt>
                  <dd className="mt-1 text-base text-ink">{org.causes.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-ink">Who we serve</dt>
                  <dd className="mt-1 text-base text-ink">{org.populations.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-ink">Service area</dt>
                  <dd className="mt-1 text-base text-ink">{org.serviceArea}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-ink">Website</dt>
                  <dd className="mt-1 text-base">
                    <a href={org.websiteUrl} className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink" target="_blank" rel="noreferrer">
                      {org.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col gap-10">
              <div className="border-t border-rule pt-4">
                <h2 className="font-display text-xl text-ink">At a glance</h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                  {[
                    ["Budget", org.annualBudget == null ? "Not stated" : `$${(org.annualBudget / 1000).toFixed(0)}K`],
                    ["Staff", org.staffCount == null ? "Not stated" : String(org.staffCount)],
                    ["Volunteers", org.volunteerCount == null ? "Not stated" : String(org.volunteerCount)],
                    ["Fiscal year end", org.fiscalYearEnd],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-sm text-ink-muted">{k}</dt>
                      <dd className="mt-1 font-display text-3xl text-ink tnum">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="border-t border-rule pt-4">
                <h2 className="font-display text-xl text-ink">Knowledge base</h2>
                <ul className="mt-3 border-t border-rule text-sm">
                  <li className="flex justify-between gap-4 border-b border-rule py-2">
                    <span className="text-ink-muted">Facts with sources</span>
                    <span className="font-semibold text-ink tnum">{facts.length}</span>
                  </li>
                  <li className="flex justify-between gap-4 border-b border-rule py-2">
                    <span className="text-ink-muted">Boilerplate pieces</span>
                    <span className="font-semibold text-ink tnum">{bps.length}</span>
                  </li>
                  <li className="flex justify-between gap-4 border-b border-rule py-2">
                    <span className="text-ink-muted">Documents</span>
                    <span className="font-semibold text-ink tnum">{docs.length}</span>
                  </li>
                  <li className="flex justify-between gap-4 border-b border-rule py-2">
                    <span className="text-ink-muted">Need your review</span>
                    <span className="font-semibold text-ink tnum">{needsReview}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="facts">
          <p className="mb-4 max-w-[65ch] text-base text-ink-muted">The numbers we are allowed to use. Anything older than a year will ask you if it is still true.</p>
          <DataTable columns={factColumns} rows={[...facts].sort((a, b) => (a.status === "confirmed" ? 1 : 0) - (b.status === "confirmed" ? 1 : 0))} rowKey={(f) => f.id} caption="Organization facts and their sources" />
        </TabsContent>

        <TabsContent value="boilerplate">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-[65ch] text-base text-ink-muted">Paragraphs you will use again and again, in your own words. Every edit saves a new version, so nothing is lost. Claims in them still need a confirmed fact before they go into a draft.</p>
            <Button variant="secondary" size="sm" onClick={() => setAddingBp(true)}>
              Add a paragraph
            </Button>
          </div>
          <ul className="border-t border-rule">
            {bps.map((b) => (
              <li key={b.id} className="border-b border-rule py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl text-ink">{b.title}</h3>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink-muted">
                      <span className="tnum">Version {b.version}</span>
                      <span className="tnum">{b.wordCount} words</span>
                      <span>Updated {relativeTime(b.updatedAt)}</span>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingBp(b)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${b.title}`}
                      onClick={async () => {
                        await services.knowledge.removeBoilerplate(b.id);
                        setBps((l) => l.filter((x) => x.id !== b.id));
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-4 max-w-[65ch] text-base text-ink">{b.body}</p>
                {b.sourceDocumentIds.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {b.sourceDocumentIds.map((id) => {
                      const d = docById(id);
                      return d ? <CitationChip key={id} label={d.title} sourceTitle={d.title} /> : null;
                    })}
                  </div>
                ) : null}
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
            className={cn("flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors", dragOver ? "border-ink-deep bg-paper-tint" : "border-rule-strong bg-paper")}
          >
            <p className="font-display text-xl text-ink">Drop a document here</p>
            <p className="mt-2 max-w-[48ch] text-base text-ink-muted">Annual reports, old proposals, 990s, budgets. PDF, Word, or plain text up to 25 MB. We read the text and pull out facts with the passage each one came from.</p>
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md" className="sr-only" id="doc-upload" aria-label="Choose documents" onChange={(e) => e.target.files && addFiles(e.target.files)} />
            <Button variant="secondary" className="mt-5" loading={!!uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? `Reading ${uploading}` : "Choose files"}
            </Button>
          </div>
          <ul className="mt-8 border-t border-rule">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 border-b border-rule py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-ink">{d.title}</p>
                  <p className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
                    <span>{docTypeLabel[d.type]}</span>
                    <span className="tnum">{(d.sizeBytes / 1_000_000).toFixed(1)} MB</span>
                    {d.pageCount ? <span className="tnum">{d.pageCount} pages</span> : null}
                    <span>Uploaded {formatDate(d.uploadedAt)}</span>
                  </p>
                </div>
                {d.status === "ready" ? (
                  d.factCount ? (
                    <span className="shrink-0 text-sm text-ink tnum">
                      {d.factCount} fact{d.factCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => extract(d)} loading={uploading === d.title}>
                      Read for facts
                    </Button>
                  )
                ) : d.status === "extracting" ? (
                  <span className="flex shrink-0 items-center gap-2 text-sm text-ink-muted">
                    <Skeleton className="h-2 w-16" /> Reading
                  </span>
                ) : d.status === "failed" ? (
                  <span className="shrink-0 text-sm font-semibold text-alert">Could not read</span>
                ) : (
                  <span className="shrink-0 text-sm text-ink-muted">Uploaded</span>
                )}
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.title}`} onClick={async () => { await services.knowledge.removeDocument(d.id); setDocs((l) => l.filter((x) => x.id !== d.id)); }}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={addingBp} onOpenChange={setAddingBp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a paragraph</DialogTitle>
            <DialogDescription>Mission, history, a program description, how you evaluate. Drafts can draw on it, with a fact citation for every claim.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const b = await services.knowledge.addBoilerplate({ type: String(fd.get("type")) as Boilerplate["type"], title: String(fd.get("title")), body: String(fd.get("body")) });
              setBps((l) => [b, ...l]);
              setAddingBp(false);
              toast({ title: "Paragraph saved" });
            }}
          >
            <Field id="bp-type" label="Kind">
              <select name="type" id="bp-type" className="h-10 border-[1.5px] border-ink bg-paper px-3 text-base text-ink" defaultValue="program">
                {(["mission", "history", "program", "staff_bio", "evaluation", "budget_narrative", "need_statement"] as const).map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="bp-title" label="Title">
              <Input name="title" required placeholder="After-School Studio" />
            </Field>
            <Field id="bp-body" label="Text">
              <Textarea name="body" required rows={6} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddingBp(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Whatever you change here shows up in every draft from now on.</DialogDescription>
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
                toast({ title: "Fact updated", description: "You're the source now." });
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
                <DialogDescription>
                  Version {editingBp.version}. Saving creates version {editingBp.version + 1}; older versions are kept.
                </DialogDescription>
              </DialogHeader>
              <Field id="bp-body" label="Text" hint={`${wordCount(editingBp.body)} words`}>
                <Textarea name="body" defaultValue={editingBp.body} className="min-h-64" />
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
