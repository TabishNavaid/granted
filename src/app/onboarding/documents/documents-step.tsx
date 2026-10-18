"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, FileUp, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Pending {
  id: string;
  name: string;
  size: number;
  status: "reading" | "ready";
  facts: number;
}

export function DocumentsStep() {
  const router = useRouter();
  const [files, setFiles] = React.useState<Pending[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const add = (list: FileList | File[]) => {
    const next: Pending[] = Array.from(list).map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, size: f.size, status: "reading", facts: 0 }));
    setFiles((cur) => [...cur, ...next]);
    next.forEach((p, i) => {
      setTimeout(() => setFiles((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: "ready", facts: 3 + ((i * 7) % 6) } : x))), 1800 + i * 600);
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="font-display text-3xl text-fg sm:text-4xl">Add one to three documents.</h1>
        <p className="mt-3 max-w-xl text-base text-fg-muted">An annual report, a past proposal, or a 990 gives the agents real numbers to cite. Optional, but drafts are much better with them.</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) add(e.dataTransfer.files);
          }}
          className={cn("mt-8 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors", dragOver ? "border-accent bg-accent-soft/40" : "border-border-strong bg-surface")}
        >
          <UploadCloud className="size-7 text-accent" aria-hidden />
          <p className="mt-3 font-medium text-fg">Drop files here</p>
          <p className="mt-1 text-sm text-fg-muted">PDF, Word, or Excel up to 25 MB each</p>
          <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" className="sr-only" id="onb-upload" onChange={(e) => e.target.files && add(e.target.files)} aria-label="Choose documents" />
          <Button type="button" variant="secondary" className="mt-4" onClick={() => inputRef.current?.click()}>
            <FileUp aria-hidden /> Choose files
          </Button>
        </div>
        {files.length ? (
          <ul className="mt-5 divide-y divide-border rounded-lg border border-border bg-surface" aria-live="polite">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{f.name}</p>
                  <p className="text-xs text-fg-subtle">{(f.size / 1_000_000).toFixed(1)} MB</p>
                </div>
                {f.status === "reading" ? (
                  <span className="flex items-center gap-2 text-xs text-fg-muted">
                    <Skeleton className="h-2 w-14" /> Reading
                  </span>
                ) : (
                  <Badge variant="success">{f.facts} facts found</Badge>
                )}
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => router.push("/onboarding/interview")} disabled={files.some((f) => f.status === "reading")}>
            Continue <ArrowRight aria-hidden />
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/onboarding/interview">Skip for now</Link>
          </Button>
        </div>
      </div>
      <aside className="rounded-lg border border-border bg-surface p-5 text-sm text-fg-muted lg:self-start">
        <p className="font-medium text-fg">Most useful</p>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4">
          <li>Your most recent annual report</li>
          <li>A proposal you were proud of, won or not</li>
          <li>Last year&apos;s Form 990</li>
        </ol>
        <p className="mt-4">We pull out numbers with page references so every claim in a draft can show where it came from.</p>
      </aside>
    </div>
  );
}
