"use client";

import * as React from "react";
import { Copy, Download, FileText, Printer } from "lucide-react";
import type { ApplicationView, Section } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

/** Pure HTML to text so it is safe during server rendering. */
function toPlainText(html: string) {
  return html
    .replace(/<span data-citation[^>]*><\/span>/g, "")
    .replace(/<span data-gap="[^"]*" data-label="([^"]*)"><\/span>/g, "[NEED: $1]")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<\/li>/g, "\n")
    .replace(/<\/h[23]>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHtml(html: string) {
  return html.replace(/<span data-citation[^>]*><\/span>/g, "").replace(/<span data-gap="[^"]*" data-label="([^"]*)"><\/span>/g, "<strong>[NEED: $1]</strong>");
}

function buildDocument(app: ApplicationView, sections: Section[]) {
  const body = sections
    .map((s) => `<h2>${s.title}</h2>${cleanHtml(s.bodyHtml) || "<p><em>Not written yet.</em></p>"}`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${app.opportunity.title}</title>
<style>body{font-family:Georgia,serif;font-size:11.5pt;line-height:1.5;max-width:7in;margin:1in auto;color:#111}h1{font-size:18pt;margin-bottom:0}h2{font-size:13pt;margin-top:1.4em}p{margin:0 0 .8em}</style></head>
<body><h1>${app.opportunity.title}</h1><p>${app.funder.name} · Riverbend Youth Collective</p>${body}</body></html>`;
}

export function ExportDialog({ open, onOpenChange, app, sections }: { open: boolean; onOpenChange: (o: boolean) => void; app: ApplicationView; sections: Section[] }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"docx" | "pdf" | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const filename = `${app.funder.name} - ${app.opportunity.title}`.replace(/[^\w\s-]/g, "").trim();

  const download = async () => {
    setBusy("docx");
    await new Promise((r) => setTimeout(r, 600));
    const blob = new Blob([buildDocument(app, sections)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(null);
    toast({ title: "Word file downloaded", description: "Open it in Word or Google Docs. Placeholders are marked NEED." });
  };
  const print = async () => {
    setBusy("pdf");
    const w = window.open("", "_blank", "width=900,height=1100");
    if (w) {
      w.document.write(buildDocument(app, sections));
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
    setBusy(null);
  };
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Could not copy", description: "Select the text and copy it manually.", tone: "warning" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Export proposal</DialogTitle>
          <DialogDescription>Citation chips are removed on export. Unanswered questions appear as NEED placeholders so nothing is invented.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="fields">Copy per field</TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={download}
              disabled={busy !== null}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-60"
            >
              <FileText className="size-5 text-accent" aria-hidden />
              <span className="font-medium text-fg">Word document</span>
              <span className="text-sm text-fg-muted">Best for funders who want an attachment. Opens in Word and Google Docs.</span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
                <Download className="size-3.5" aria-hidden /> {busy === "docx" ? "Preparing..." : "Download .doc"}
              </span>
            </button>
            <button
              type="button"
              onClick={print}
              disabled={busy !== null}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover disabled:opacity-60"
            >
              <Printer className="size-5 text-accent" aria-hidden />
              <span className="font-medium text-fg">PDF</span>
              <span className="text-sm text-fg-muted">Opens a print view. Choose Save as PDF in the print dialog.</span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent">
                <Download className="size-3.5" aria-hidden /> Print to PDF
              </span>
            </button>
          </TabsContent>
          <TabsContent value="fields">
            <p className="mb-3 text-sm text-fg-muted">For online portals with one box per question. Copy each section into the matching field.</p>
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
              {sections.map((s) => {
                const text = toPlainText(s.bodyHtml);
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg">{s.title}</p>
                      <p className="truncate text-xs text-fg-subtle">{text ? text.slice(0, 90) : "Not written yet"}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => copy(s.id, text)} disabled={!text}>
                      <Copy aria-hidden /> {copied === s.id ? "Copied" : "Copy"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
