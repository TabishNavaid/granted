"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { formatDate, relativeTime } from "@/lib/format";

interface CitationChipProps {
  /** Short label shown on the chip, e.g. "Annual report, p.4". */
  label: string;
  /** Full excerpt from the source. */
  excerpt?: string;
  sourceTitle?: string;
  url?: string | null;
  page?: number | null;
  kind?: "document" | "web";
  verifiedAt?: string | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * A citation: a small footnote tag. Open it to read the exact passage
 * the claim came from.
 */
export function CitationChip({ label, excerpt, sourceTitle, url, page, verifiedAt, size = "sm", className }: CitationChipProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className={cn("cite-chip max-w-full hover:border-ink", size === "md" && "text-[0.85em]", className)}>
          <span className="truncate">{label}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content sideOffset={6} collisionPadding={12} className="sheet-raised-sm z-50 w-80 max-w-[calc(100vw-1.5rem)] p-4 text-sm text-ink animate-sheet-in focus:outline-none">
          <p className="mb-2 text-xs text-ink-muted">
            {sourceTitle ?? label}
            {page ? `, page ${page}` : null}
          </p>
          {excerpt ? <blockquote className="border-l-[3px] border-rule-strong pl-3 text-base italic leading-relaxed text-ink">“{excerpt}”</blockquote> : <p className="text-ink-muted">Source passage will appear here.</p>}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-muted">
            {verifiedAt ? <span title={formatDate(verifiedAt)}>Checked {relativeTime(verifiedAt)}</span> : <span />}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
                Open the source
              </a>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** "meridianfamilyfdn.org, checked 3 days ago" as two plain pieces of information. */
export function VerifiedSource({ url, verifiedAt, className, label }: { url: string; verifiedAt: string; className?: string; label?: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep the raw string
  }
  return (
    <p className={cn("text-xs text-ink-muted", className)}>
      <a href={url} target="_blank" rel="noreferrer" className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
        {label ?? host}
      </a>
      , checked <time dateTime={verifiedAt}>{relativeTime(verifiedAt)}</time>
    </p>
  );
}
