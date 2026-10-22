"use client";

import { ImportDialog } from "./import-dialog";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Certification, FirmProfile, Personnel, PortfolioProject } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { certWords, ROLE_WORDS } from "@/lib/firm/facts";
import { formatMoney } from "@/lib/format";

/**
 * A firm's knowledge base: the company, its projects, its people, and its
 * credentials. Everything here is the firm's own record; bids cite it, and
 * nothing a bid says about the firm can come from anywhere else.
 */

const list = (s: string) => s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[^0-9.]/g, "")) || null);

export function CompanyPanel({ initial, readOnly }: { initial: FirmProfile | null; readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const p = initial;
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({
    naics: (p?.naics ?? []).map((n) => `${n.code} ${n.label}${n.primary ? " (primary)" : ""}`).join("\n"),
    sectors: (p?.sectors ?? []).join("; "),
    states: (p?.states ?? []).join(", "),
    uei: p?.uei ?? "",
    cage: p?.cageCode ?? "",
    single: p?.bonding?.singleLimit ? String(p.bonding.singleLimit) : "",
    aggregate: p?.bonding?.aggregateLimit ? String(p.bonding.aggregateLimit) : "",
    surety: p?.bonding?.surety ?? "",
    emr: p?.safety?.emr != null ? String(p.safety.emr) : "",
    emrYear: p?.safety?.emrYear ? String(p.safety.emrYear) : "",
    capacity: p?.activeBidCapacity ? String(p.activeBidCapacity) : "",
    rates: (p?.rates ?? []).map((r) => `${r.role}: ${r.rate}`).join("\n"),
  });
  const save = async () => {
    await services.firm.saveProfile({
      naics: list(f.naics).map((l, i) => ({ code: l.match(/\d{6}/)?.[0] ?? "", label: l.replace(/\d{6}/, "").replace(/\(primary\)/i, "").trim(), primary: /primary/i.test(l) || i === 0 })).filter((n) => n.code),
      sectors: list(f.sectors),
      states: f.states.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]{2}$/.test(x)),
      uei: f.uei.trim() || null,
      cageCode: f.cage.trim() || null,
      bonding: num(f.single) || num(f.aggregate) ? { singleLimit: num(f.single), aggregateLimit: num(f.aggregate), surety: f.surety.trim() || null, asOf: new Date().toISOString().slice(0, 10), documentId: null } : null,
      safety: num(f.emr) != null ? { emr: num(f.emr), emrYear: num(f.emrYear), trir: p?.safety?.trir ?? null, dart: p?.safety?.dart ?? null, fatalitiesFiveYears: p?.safety?.fatalitiesFiveYears ?? null, programNote: p?.safety?.programNote ?? null } : p?.safety ?? null,
      activeBidCapacity: num(f.capacity),
      rates: list(f.rates).map((l) => ({ role: l.split(":")[0].trim(), rate: num(l.split(":")[1] ?? "") ?? 0 })).filter((r) => r.role && r.rate),
    });
    setOpen(false);
    toast({ title: "Firm profile saved", description: "Bids use it from now on." });
    router.refresh();
  };
  const rows: [string, React.ReactNode][] = [
    ["Work categories (NAICS)", p?.naics.length ? p.naics.map((n) => `${n.code} ${n.label}${n.primary ? " (primary)" : ""}`).join("; ") : "Not set. SAM.gov search needs them."],
    ["Sectors", p?.sectors.join(", ") || "Not set"],
    ["States you work in", p?.states.join(", ") || "Not set"],
    ["SAM.gov registration", p?.uei ? `UEI ${p.uei}${p.cageCode ? `, CAGE ${p.cageCode}` : ""}${p.samRegistrationExpires ? `, active through ${p.samRegistrationExpires}` : ""}` : "Not set"],
    ["Bonding", p?.bonding?.singleLimit ? `${formatMoney(p.bonding.singleLimit)} single, ${p.bonding.aggregateLimit ? formatMoney(p.bonding.aggregateLimit) : "?"} aggregate${p.bonding.surety ? `, ${p.bonding.surety}` : ""}` : "None on file. Construction bids that need a bond will say so."],
    ["Insurance", p?.insurance.length ? p.insurance.map((i) => `${i.kind}${i.perOccurrence ? ` ${formatMoney(i.perOccurrence)}` : ""}`).join("; ") : "Not set"],
    ["Safety", p?.safety?.emr != null ? `EMR ${p.safety.emr}${p.safety.emrYear ? ` (${p.safety.emrYear})` : ""}${p.safety.trir != null ? `, TRIR ${p.safety.trir}` : ""}` : "Not set"],
    ["Staff by discipline", p?.employeesByDiscipline.length ? p.employeesByDiscipline.map((d) => `${d.count} ${d.discipline}`).join(", ") : "Not set"],
    ["Bids the team can carry at once", p?.activeBidCapacity ? String(p.activeBidCapacity) : "Not set"],
    ["Hourly rates for fee proposals", p?.rates.length ? p.rates.map((r) => `${r.role} $${r.rate}`).join("; ") : "Not set"],
  ];
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-base text-ink-muted">What every bid starts from. Go/no-go reads your categories, states, bonding, and capacity; fee proposals read your rates.</p>
        {readOnly ? null : (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Edit
          </Button>
        )}
      </div>
      <dl className="mt-4 border-t border-rule">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[14rem_1fr]">
            <dt className="text-sm text-ink-muted">{k}</dt>
            <dd className="text-base text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Firm profile</DialogTitle>
            <DialogDescription>Only what is true and current. Bids cite these.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid max-h-[60vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            <Field id="f-naics" label="NAICS codes, one per line" className="sm:col-span-2">
              <Textarea rows={3} value={f.naics} onChange={(e) => setF({ ...f, naics: e.target.value })} />
            </Field>
            <Field id="f-sectors" label="Sectors, separated by semicolons" className="sm:col-span-2">
              <Input value={f.sectors} onChange={(e) => setF({ ...f, sectors: e.target.value })} />
            </Field>
            <Field id="f-states" label="States you work in (TX, OK)">
              <Input value={f.states} onChange={(e) => setF({ ...f, states: e.target.value })} />
            </Field>
            <Field id="f-capacity" label="Bids the team can carry at once">
              <Input inputMode="numeric" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
            </Field>
            <Field id="f-uei" label="Unique Entity ID">
              <Input value={f.uei} onChange={(e) => setF({ ...f, uei: e.target.value })} />
            </Field>
            <Field id="f-cage" label="CAGE code">
              <Input value={f.cage} onChange={(e) => setF({ ...f, cage: e.target.value })} />
            </Field>
            <Field id="f-single" label="Bonding, single project ($)">
              <Input inputMode="numeric" value={f.single} onChange={(e) => setF({ ...f, single: e.target.value })} />
            </Field>
            <Field id="f-aggregate" label="Bonding, aggregate ($)">
              <Input inputMode="numeric" value={f.aggregate} onChange={(e) => setF({ ...f, aggregate: e.target.value })} />
            </Field>
            <Field id="f-surety" label="Surety">
              <Input value={f.surety} onChange={(e) => setF({ ...f, surety: e.target.value })} />
            </Field>
            <Field id="f-emr" label="EMR and year (0.78, 2025)">
              <div className="flex gap-2">
                <Input aria-label="EMR" value={f.emr} onChange={(e) => setF({ ...f, emr: e.target.value })} />
                <Input aria-label="EMR year" value={f.emrYear} onChange={(e) => setF({ ...f, emrYear: e.target.value })} />
              </div>
            </Field>
            <Field id="f-rates" label="Hourly rates, one per line (Project manager: 175)" className="sm:col-span-2">
              <Textarea rows={4} value={f.rates} onChange={(e) => setF({ ...f, rates: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const blankProject = (): Omit<PortfolioProject, "id" | "orgId"> => ({ name: "", client: "", clientType: "municipal", city: "", state: "", scope: "", sector: "", projectType: "", sizeSqft: null, contractValue: null, constructionCost: null, startDate: null, completionDate: null, status: "completed", role: "prime", deliveryMethod: null, services: [], outcomes: [], reference: null, photos: [], personnelIds: [], profileCode: null, source: { kind: "entered", label: "Entered by the firm", url: null } });

export function ProjectsPanel({ projects, readOnly }: { projects: PortfolioProject[]; readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<(Omit<PortfolioProject, "id" | "orgId"> & { id?: string }) | null>(null);
  const save = async () => {
    if (!editing?.name.trim()) return;
    await services.firm.saveProject(editing);
    setEditing(null);
    toast({ title: "Project saved" });
    router.refresh();
  };
  const remove = async (id: string) => {
    await services.firm.removeProject(id);
    router.refresh();
  };
  const e = editing;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-[65ch] text-base text-ink-muted">Every project a bid can show. Bids choose the most relevant for each solicitation; the SF 330 shows up to ten in Section F.</p>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <ImportDialog kind="projects" />
            <Button size="sm" onClick={() => setEditing(blankProject())}>
              <Plus className="size-4" aria-hidden /> Add a project
            </Button>
          </div>
        )}
      </div>
      {projects.length ? (
        <ul className="mt-4 border-t border-rule">
          {projects.map((p) => (
            <li key={p.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <h3 className="font-display text-xl text-ink">{p.name}</h3>
                <p className="text-base text-ink-muted">
                  {p.client} · {[p.city, p.state].filter(Boolean).join(", ")} · {ROLE_WORDS[p.role]}
                  {p.status === "completed" ? (p.completionDate ? ` · completed ${p.completionDate.slice(0, 4)}` : "") : " · in progress"}
                </p>
                <p className="mt-1 max-w-[70ch] text-base text-ink">{p.scope}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {[p.sizeSqft ? `${p.sizeSqft.toLocaleString("en-US")} sq ft` : null, p.constructionCost ? `construction ${formatMoney(p.constructionCost)}` : null, p.contractValue ? `fee ${formatMoney(p.contractValue)}` : null, p.profileCode ? `SF 330 code ${p.profileCode}` : null, p.reference ? `reference: ${p.reference.name}` : "no reference yet"].filter(Boolean).join(" · ")}
                </p>
              </div>
              {readOnly ? null : (
                <div className="flex items-start gap-1">
                  <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Edit ${p.name}`} onClick={() => setEditing({ ...p })}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-4" size="sm" title="No projects yet" description="Add the projects you would show an owner. Setup reads them from your website's project pages when it can." />
      )}
      <Dialog open={Boolean(e)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{e?.id ? "Edit project" : "Add a project"}</DialogTitle>
            <DialogDescription>Only what you would stand behind in front of the owner. Bids quote it.</DialogDescription>
          </DialogHeader>
          {e ? (
            <div className="mt-2 grid max-h-[60vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field id="p-name" label="Project name" className="sm:col-span-2">
                <Input value={e.name} onChange={(x) => setEditing({ ...e, name: x.target.value })} />
              </Field>
              <Field id="p-client" label="Client">
                <Input value={e.client} onChange={(x) => setEditing({ ...e, client: x.target.value })} />
              </Field>
              <Field id="p-type" label="Project type (Fire station)">
                <Input value={e.projectType} onChange={(x) => setEditing({ ...e, projectType: x.target.value })} />
              </Field>
              <Field id="p-city" label="City">
                <Input value={e.city} onChange={(x) => setEditing({ ...e, city: x.target.value })} />
              </Field>
              <Field id="p-state" label="State (TX)">
                <Input value={e.state} onChange={(x) => setEditing({ ...e, state: x.target.value.toUpperCase().slice(0, 2) })} />
              </Field>
              <Field id="p-scope" label="What the firm did" className="sm:col-span-2">
                <Textarea rows={3} value={e.scope} onChange={(x) => setEditing({ ...e, scope: x.target.value })} />
              </Field>
              <Field id="p-size" label="Size (square feet)">
                <Input inputMode="numeric" value={e.sizeSqft ?? ""} onChange={(x) => setEditing({ ...e, sizeSqft: num(x.target.value) })} />
              </Field>
              <Field id="p-cost" label="Construction cost ($)">
                <Input inputMode="numeric" value={e.constructionCost ?? ""} onChange={(x) => setEditing({ ...e, constructionCost: num(x.target.value) })} />
              </Field>
              <Field id="p-fee" label="Firm's fee ($)">
                <Input inputMode="numeric" value={e.contractValue ?? ""} onChange={(x) => setEditing({ ...e, contractValue: num(x.target.value) })} />
              </Field>
              <Field id="p-done" label="Completed (YYYY-MM-DD)">
                <Input value={e.completionDate ?? ""} onChange={(x) => setEditing({ ...e, completionDate: x.target.value || null, status: x.target.value ? "completed" : "in_progress" })} />
              </Field>
              <Field id="p-role" label="Role">
                <Select value={e.role} onValueChange={(v) => setEditing({ ...e, role: v as PortfolioProject["role"] })}>
                  <SelectTrigger id="p-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_WORDS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="p-code" label="SF 330 profile code (H09)">
                <Input value={e.profileCode ?? ""} onChange={(x) => setEditing({ ...e, profileCode: x.target.value.toUpperCase() || null })} />
              </Field>
              <Field id="p-outcomes" label="Outcomes, separated by semicolons" className="sm:col-span-2">
                <Input value={e.outcomes.join("; ")} onChange={(x) => setEditing({ ...e, outcomes: list(x.target.value) })} />
              </Field>
              <Field id="p-ref" label="Reference (name, title)" className="sm:col-span-2">
                <Input value={e.reference ? `${e.reference.name}, ${e.reference.title}` : ""} onChange={(x) => setEditing({ ...e, reference: x.target.value.trim() ? { name: x.target.value.split(",")[0].trim(), title: x.target.value.split(",").slice(1).join(",").trim(), organization: e.client, phone: e.reference?.phone ?? null, email: e.reference?.email ?? null } : null })} />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!e?.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PeoplePanel({ personnel, projects, readOnly }: { personnel: Personnel[]; projects: PortfolioProject[]; readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<(Omit<Personnel, "id" | "orgId"> & { id?: string }) | null>(null);
  const save = async () => {
    if (!editing?.name.trim()) return;
    await services.firm.savePerson(editing);
    setEditing(null);
    toast({ title: "Person saved" });
    router.refresh();
  };
  const e = editing;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-[65ch] text-base text-ink-muted">Key personnel with their registrations and the projects they worked on. Bids tailor each résumé to the solicitation from these records.</p>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <ImportDialog kind="people" />
            <Button size="sm" onClick={() => setEditing({ name: "", title: "", role: "", discipline: "", yearsTotal: null, yearsWithFirm: null, education: [], registrations: [], certifications: [], summary: "", projectIds: [], resumeDocumentId: null, office: null })}>
              <Plus className="size-4" aria-hidden /> Add a person
            </Button>
          </div>
        )}
      </div>
      <ul className="mt-4 border-t border-rule">
        {personnel.map((p) => (
          <li key={p.id} className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <h3 className="font-display text-xl text-ink">{p.name}</h3>
              <p className="text-base text-ink-muted">
                {p.title} · usually {p.role.toLowerCase()} · {p.yearsTotal ?? "?"} years, {p.yearsWithFirm ?? "?"} with the firm
              </p>
              <p className="mt-1 text-base text-ink">{p.registrations.map((r) => `${r.license} (${r.state})`).join("; ") || "No registrations listed"}</p>
              {p.certifications.length ? <p className="text-sm text-ink-muted">{p.certifications.join(", ")}</p> : null}
              <p className="mt-1 text-sm text-ink-muted">Projects: {projects.filter((x) => p.projectIds.includes(x.id)).map((x) => x.name).join("; ") || "none linked"}</p>
            </div>
            {readOnly ? null : (
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Edit ${p.name}`} onClick={() => setEditing({ ...p })}>
                <Pencil />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(e)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{e?.id ? "Edit person" : "Add a person"}</DialogTitle>
            <DialogDescription>Registrations are checked against the project&apos;s state on every bid.</DialogDescription>
          </DialogHeader>
          {e ? (
            <div className="mt-2 grid max-h-[60vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
              <Field id="pe-name" label="Name">
                <Input value={e.name} onChange={(x) => setEditing({ ...e, name: x.target.value })} />
              </Field>
              <Field id="pe-title" label="Title">
                <Input value={e.title} onChange={(x) => setEditing({ ...e, title: x.target.value })} />
              </Field>
              <Field id="pe-role" label="Usual role on a proposal">
                <Input value={e.role} onChange={(x) => setEditing({ ...e, role: x.target.value })} />
              </Field>
              <Field id="pe-disc" label="Discipline">
                <Input value={e.discipline} onChange={(x) => setEditing({ ...e, discipline: x.target.value })} />
              </Field>
              <Field id="pe-years" label="Years of experience">
                <Input inputMode="numeric" value={e.yearsTotal ?? ""} onChange={(x) => setEditing({ ...e, yearsTotal: num(x.target.value) })} />
              </Field>
              <Field id="pe-firm" label="Years with the firm">
                <Input inputMode="numeric" value={e.yearsWithFirm ?? ""} onChange={(x) => setEditing({ ...e, yearsWithFirm: num(x.target.value) })} />
              </Field>
              <Field id="pe-regs" label="Registrations, one per line (Professional Engineer, TX)" className="sm:col-span-2">
                <Textarea rows={2} value={e.registrations.map((r) => `${r.license}, ${r.state}`).join("\n")} onChange={(x) => setEditing({ ...e, registrations: list(x.target.value).map((l) => ({ license: l.split(",")[0].trim(), state: (l.split(",")[1] ?? "").trim().toUpperCase(), number: null, expires: null })) })} />
              </Field>
              <Field id="pe-edu" label="Education, separated by semicolons" className="sm:col-span-2">
                <Input value={e.education.join("; ")} onChange={(x) => setEditing({ ...e, education: list(x.target.value) })} />
              </Field>
              <Field id="pe-sum" label="Summary, in the firm's words" className="sm:col-span-2">
                <Textarea rows={3} value={e.summary} onChange={(x) => setEditing({ ...e, summary: x.target.value })} />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!e?.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CERT_KINDS: Certification["kind"][] = ["small_business", "8a", "wosb", "edwosb", "sdvosb", "vosb", "hubzone", "mbe", "wbe", "dbe", "license", "registration", "other"];

export function CredentialsPanel({ certifications, readOnly }: { certifications: Certification[]; readOnly: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<(Omit<Certification, "id" | "orgId"> & { id?: string }) | null>(null);
  const save = async () => {
    if (!editing) return;
    await services.firm.saveCertification(editing);
    setEditing(null);
    router.refresh();
  };
  const e = editing;
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-base text-ink-muted">Small business and ownership statuses, and state licenses and registrations. Go/no-go checks each solicitation&apos;s set-aside and state against them.</p>
        {readOnly ? null : (
          <Button size="sm" onClick={() => setEditing({ kind: "license", label: "", issuer: "", state: null, number: null, expires: null, documentId: null })}>
            <Plus className="size-4" aria-hidden /> Add a credential
          </Button>
        )}
      </div>
      <ul className="mt-4 border-t border-rule">
        {certifications.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-4 border-b border-rule py-3">
            <div>
              <p className="font-semibold text-ink">{c.label || certWords(c.kind)}</p>
              <p className="text-sm text-ink-muted">{[c.issuer, c.state, c.number, c.expires ? `expires ${c.expires}` : null].filter(Boolean).join(" · ")}</p>
            </div>
            {readOnly ? null : (
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Edit ${c.label}`} onClick={() => setEditing({ ...c })}>
                <Pencil />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(e)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{e?.id ? "Edit credential" : "Add a credential"}</DialogTitle>
            <DialogDescription>Add the certificate on the Documents tab so the matrix can count it as attached.</DialogDescription>
          </DialogHeader>
          {e ? (
            <div className="mt-2 grid gap-4">
              <Field id="c-kind" label="Kind">
                <Select value={e.kind} onValueChange={(v) => setEditing({ ...e, kind: v as Certification["kind"] })}>
                  <SelectTrigger id="c-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CERT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {certWords(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="c-label" label="Name as written on it">
                <Input value={e.label} onChange={(x) => setEditing({ ...e, label: x.target.value })} />
              </Field>
              <Field id="c-issuer" label="Issued by">
                <Input value={e.issuer} onChange={(x) => setEditing({ ...e, issuer: x.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field id="c-state" label="State">
                  <Input value={e.state ?? ""} onChange={(x) => setEditing({ ...e, state: x.target.value.toUpperCase().slice(0, 2) || null })} />
                </Field>
                <Field id="c-number" label="Number">
                  <Input value={e.number ?? ""} onChange={(x) => setEditing({ ...e, number: x.target.value || null })} />
                </Field>
                <Field id="c-exp" label="Expires">
                  <Input value={e.expires ?? ""} onChange={(x) => setEditing({ ...e, expires: x.target.value || null })} />
                </Field>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
