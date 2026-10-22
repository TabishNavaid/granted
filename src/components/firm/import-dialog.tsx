"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { services } from "@/lib/services";
import { mapPeople, mapProjects, parseTable, type Table } from "@/lib/firm/import";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

const FIELD_WORDS: Record<string, string> = {
  name: "Name",
  client: "Client",
  city: "City",
  state: "State",
  location: "Location",
  scope: "Description",
  sector: "Sector",
  projectType: "Project type",
  sizeSqft: "Size (sq ft)",
  contractValue: "Fee",
  constructionCost: "Construction cost",
  completionDate: "Completed",
  role: "Role",
  services: "Services",
  referenceName: "Reference",
  title: "Title",
  discipline: "Discipline",
  yearsTotal: "Years of experience",
  yearsWithFirm: "Years with the firm",
  education: "Education",
  registrations: "Registrations",
  certifications: "Certifications",
};

/**
 * Bring a firm's project list or staff list in from a spreadsheet: upload an .xlsx or .csv file, or paste the
 * rows copied from Excel. The preview shows which columns were matched, the first rows, and every row that has
 * a problem. Nothing is saved until the person presses Import.
 */
export function ImportDialog({ kind }: { kind: "projects" | "people" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [table, setTable] = React.useState<Table | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [paste, setPaste] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | { done: number; total: number }>(null);
  const noun = kind === "projects" ? "project" : "person";
  const nouns = kind === "projects" ? "projects" : "people";

  const mapped = React.useMemo(() => (table ? (kind === "projects" ? mapProjects(table, new Date(), fileName ? `Imported from ${fileName}` : "Imported spreadsheet") : mapPeople(table)) : null), [table, kind, fileName]);

  const reset = () => {
    setTable(null);
    setFileName(null);
    setPaste("");
    setError(null);
    setBusy(null);
  };

  const readFile = async (file: File) => {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const r = await fetch("/api/import/sheet", { method: "POST", body: fd });
    const body = (await r.json().catch(() => null)) as { ok: boolean; table?: Table; error?: string } | null;
    if (!body?.ok || !body.table) return setError(body?.error ?? "We could not read that file.");
    setFileName(file.name);
    setTable(body.table);
  };

  const importAll = async () => {
    if (!mapped?.items.length) return;
    setBusy({ done: 0, total: mapped.items.length });
    let done = 0;
    try {
      for (const item of mapped.items) {
        if (kind === "projects") await services.firm.saveProject(item as Parameters<typeof services.firm.saveProject>[0]);
        else await services.firm.savePerson(item as Parameters<typeof services.firm.savePerson>[0]);
        done++;
        setBusy({ done, total: mapped.items.length });
      }
      toast({ title: `${done} ${done === 1 ? noun : nouns} imported`, description: "Open any of them to add what the sheet did not have." });
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(`Stopped after ${done}: ${err instanceof Error ? err.message : "something went wrong"}. The ones before it were saved.`);
      setBusy(null);
    }
  };

  const matched = mapped ? Object.entries(mapped.columns).filter(([k, v]) => v && FIELD_WORDS[k]) : [];
  const preview = mapped?.items.slice(0, 5) ?? [];

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden /> Import from a spreadsheet
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Import {nouns} from a spreadsheet</DialogTitle>
            <DialogDescription>Upload an Excel or CSV file, or copy the rows in Excel (headers included) and paste them below. You will see what we read before anything is saved.</DialogDescription>
          </DialogHeader>
          {!table ? (
            <div className="flex flex-col gap-4">
              <label className="flex cursor-pointer flex-col items-start gap-2 border border-dashed border-rule-strong p-5">
                <span className="text-base font-semibold text-ink">Choose a file</span>
                <span className="text-sm text-ink-muted">.xlsx, .csv, or .tsv, up to 4 MB. The first sheet is read.</span>
                <input
                  type="file"
                  accept=".xlsx,.csv,.tsv,.txt"
                  className="text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void readFile(f);
                  }}
                />
              </label>
              <div>
                <label htmlFor={`paste-${kind}`} className="text-base font-semibold text-ink">
                  Or paste rows
                </label>
                <textarea id={`paste-${kind}`} value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className="mt-2 w-full rounded-md border border-rule-strong bg-paper p-3 font-mono text-sm text-ink" placeholder={kind === "projects" ? "Project name\tClient\tCity\tState\tCompleted\tConstruction cost\tDescription" : "Name\tTitle\tDiscipline\tYears experience\tRegistrations"} />
                <Button size="sm" className="mt-2" disabled={!paste.trim()} onClick={() => setTable(parseTable(paste))}>
                  Read the pasted rows
                </Button>
              </div>
            </div>
          ) : mapped ? (
            <div className="flex flex-col gap-5">
              <p className="text-base text-ink">
                <span className="font-semibold">{mapped.items.length}</span> {mapped.items.length === 1 ? noun : nouns} found in {table.rows.length} rows{fileName ? ` of ${fileName}` : ""}.
              </p>
              <div>
                <p className="text-sm font-semibold text-ink">Columns we matched</p>
                <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {matched.map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3 border-b border-rule py-1">
                      <span className="text-ink-muted">{FIELD_WORDS[k]}</span>
                      <span className="truncate font-mono text-ink">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {preview.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <caption className="sr-only">The first rows as they will be saved</caption>
                    <thead className="border-b border-ink text-ink-muted">
                      <tr>
                        <th className="py-1.5 pr-3 font-normal">Name</th>
                        <th className="py-1.5 pr-3 font-normal">{kind === "projects" ? "Client" : "Title"}</th>
                        <th className="py-1.5 pr-3 font-normal">{kind === "projects" ? "Place" : "Registrations"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((it, i) => {
                        const p = it as Record<string, unknown>;
                        return (
                          <tr key={i} className="border-b border-rule">
                            <td className="py-1.5 pr-3 text-ink">{String(p.name)}</td>
                            <td className="py-1.5 pr-3 text-ink-muted">{String(kind === "projects" ? p.client : p.title) || "None"}</td>
                            <td className="py-1.5 pr-3 text-ink-muted">{kind === "projects" ? [p.city, p.state].filter(Boolean).join(", ") || "None" : ((p.registrations as { license: string; state: string }[]).map((r) => `${r.license} ${r.state}`.trim()).join("; ") || "None")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {mapped.issues.length ? (
                <div>
                  <p className="text-sm font-semibold text-ink">{mapped.issues.length === 1 ? "One thing to check" : `${mapped.issues.length} things to check`}</p>
                  <ul className="mt-1 max-h-40 overflow-y-auto text-sm text-ink-muted">
                    {mapped.issues.slice(0, 30).map((x, i) => (
                      <li key={i}>
                        {x.row ? `Row ${x.row}: ` : ""}
                        {x.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            {table ? (
              <Button variant="ghost" onClick={reset} disabled={!!busy}>
                Start over
              </Button>
            ) : null}
            {table && mapped?.items.length ? (
              <Button onClick={importAll} loading={!!busy}>
                {busy ? `Imported ${busy.done} of ${busy.total}` : `Import ${mapped.items.length} ${mapped.items.length === 1 ? noun : nouns}`}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
