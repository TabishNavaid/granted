"use client";

import * as React from "react";
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

function buildDocument(app: ApplicationView, sections: Section[], orgName: string) {
  const body = sections
    .map((s) => `<h2>${s.title}</h2>${cleanHtml(s.bodyHtml) || "<p><em>Not written yet.</em></p>"}`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${app.opportunity.title}</title>
<style>body{font-family:Georgia,serif;font-size:11.5pt;line-height:1.5;max-width:7in;margin:1in auto;color:#111}h1{font-size:18pt;margin-bottom:0}h2{font-size:13pt;margin-top:1.4em}p{margin:0 0 .8em}</style></head>
<body><h1>${app.opportunity.title}</h1><p>${app.funder.name} for ${orgName}</p>${body}</body></html>`;
}

/** Blocks of plain text per section, for the .docx builder. Headings, paragraphs, and list items. */
function toBlocks(html: string): { kind: "h3" | "p" | "li"; text: string }[] {
  const cleaned = cleanHtml(html).replace(/<strong>\[NEED: ([^\]]*)\]<\/strong>/g, "[NEED: $1]");
  const blocks: { kind: "h3" | "p" | "li"; text: string }[] = [];
  for (const m of cleaned.matchAll(/<(h3|p|li)[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = toPlainText(m[2]);
    if (text) blocks.push({ kind: m[1] as "h3" | "p" | "li", text });
  }
  if (!blocks.length) {
    const text = toPlainText(cleaned);
    if (text) blocks.push({ kind: "p", text });
  }
  return blocks;
}

async function buildDocx(app: ApplicationView, sections: Section[], orgName: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(app.opportunity.title)] }),
    new Paragraph({ children: [new TextRun({ text: `${app.funder.name}, from ${orgName}`, italics: true })], spacing: { after: 300 } }),
  ];
  for (const s of sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(s.title)], spacing: { before: 280, after: 120 } }));
    const blocks = toBlocks(s.bodyHtml);
    if (!blocks.length) children.push(new Paragraph({ children: [new TextRun({ text: "Not written yet.", italics: true })] }));
    for (const b of blocks) {
      if (b.kind === "h3") children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(b.text)] }));
      else if (b.kind === "li") children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b.text)] }));
      else {
        // Mark gaps in bold so a NEED cannot slip past in Word.
        const runs = b.text.split(/(\[NEED: [^\]]*\])/g).map((part) => new TextRun({ text: part, bold: part.startsWith("[NEED:") }));
        children.push(new Paragraph({ children: runs, spacing: { after: 160 } }));
      }
    }
  }
  const doc = new Document({ creator: orgName, title: app.opportunity.title, styles: { default: { document: { run: { font: "Georgia", size: 23 } } } }, sections: [{ children }] });
  return Packer.toBlob(doc);
}

const fileOptionClasses = "flex flex-col gap-1 border border-ink p-4 text-left transition-colors hover:bg-paper-tint disabled:opacity-60";

export function ExportDialog({ open, onOpenChange, app, sections, orgName }: { open: boolean; onOpenChange: (o: boolean) => void; app: ApplicationView; sections: Section[]; orgName: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"docx" | "pdf" | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const filename = `${app.funder.name} - ${app.opportunity.title}`.replace(/[^\w\s-]/g, "").trim();

  const download = async () => {
    setBusy("docx");
    try {
      const blob = await buildDocx(app, sections, orgName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Word file downloaded", description: "Open it in Word or Google Docs. Anything still missing is marked NEED so it cannot slip past you." });
    } catch {
      toast({ title: "Could not build the file", description: "Try the PDF option, or copy each section by hand.", tone: "warning" });
    }
    setBusy(null);
  };
  const print = async () => {
    setBusy("pdf");
    const w = window.open("", "_blank", "width=900,height=1100");
    if (w) {
      w.document.write(buildDocument(app, sections, orgName));
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
      toast({ title: "Could not copy", description: "Select the text and copy it by hand. Sorry about that.", tone: "warning" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Export proposal</DialogTitle>
          <DialogDescription>We take the citation chips out on export. Anything you have not answered shows up as a NEED placeholder, so nothing gets invented on the way out the door.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="files">
          <TabsList variant="line">
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="fields">Copy per field</TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={download} disabled={busy !== null} className={fileOptionClasses}>
              <span className="font-display text-lg text-ink">Word document</span>
              <span className="text-sm text-ink-muted">For funders who want an attachment. Opens in Word and Google Docs.</span>
              <span className="mt-1 text-sm font-semibold text-ink underline decoration-[1.5px] underline-offset-4">{busy === "docx" ? "Preparing" : "Download .doc"}</span>
            </button>
            <button type="button" onClick={print} disabled={busy !== null} className={fileOptionClasses}>
              <span className="font-display text-lg text-ink">PDF</span>
              <span className="text-sm text-ink-muted">Opens a print view. Choose Save as PDF in the print dialog.</span>
              <span className="mt-1 text-sm font-semibold text-ink underline decoration-[1.5px] underline-offset-4">Print to PDF</span>
            </button>
          </TabsContent>
          <TabsContent value="fields">
            <p className="mb-3 text-sm text-ink-muted">For the portals with one box per question. Copy each section into its field and you are done.</p>
            <ul className="max-h-80 overflow-y-auto border-t border-rule pr-1">
              {sections.map((s) => {
                const text = toPlainText(s.bodyHtml);
                return (
                  <li key={s.id} className="flex items-center gap-3 border-b border-rule py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{s.title}</p>
                      <p className="truncate text-xs text-ink-muted">{text ? text.slice(0, 90) : "Not written yet"}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => copy(s.id, text)} disabled={!text}>
                      {copied === s.id ? "Copied" : "Copy"}
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
