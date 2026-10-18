"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <h1 className="font-display text-h1 text-ink">Add one to three documents.</h1>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">An annual report, an old proposal, or a 990 gives us real numbers to cite. It's optional, but honestly, the drafts are much better with them.</p>
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
          className={cn("mt-8 flex flex-col items-center justify-center border-2 border-dashed border-ink px-6 py-12 text-center transition-colors", dragOver ? "bg-paper-tint" : "bg-paper")}
        >
          <p className="font-display text-xl text-ink">Drop files here</p>
          <p className="mt-1 text-sm text-ink-muted">PDF, Word, or Excel up to 25 MB each</p>
          <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" className="sr-only" id="onb-upload" onChange={(e) => e.target.files && add(e.target.files)} aria-label="Choose documents" />
          <Button type="button" variant="secondary" className="mt-5" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
        </div>
        {files.length ? (
          <ul className="mt-6 border-t border-rule" aria-live="polite">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-4 border-b border-rule py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-ink">{f.name}</p>
                  <p className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
                    <span className="tnum">{(f.size / 1_000_000).toFixed(1)} MB</span>
                  </p>
                </div>
                {f.status === "reading" ? (
                  <span className="flex items-center gap-2 text-sm text-ink-muted">
                    <Skeleton className="h-2 w-14" /> Reading
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-ink tnum">{f.facts} facts found</span>
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
            Continue
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/onboarding/interview">Skip for now</Link>
          </Button>
        </div>
      </div>
      <aside className="border-l-2 border-ink pl-5 text-base text-ink-muted lg:self-start">
        <h2 className="font-display text-xl text-ink">Most useful</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 marker:font-display marker:text-ink">
          <li>Your most recent annual report</li>
          <li>A proposal you were proud of, won or not</li>
          <li>Last year&apos;s Form 990</li>
        </ol>
        <p className="mt-4">We pull out the numbers with page references, so every claim in a draft can show exactly where it came from.</p>
      </aside>
    </div>
  );
}
