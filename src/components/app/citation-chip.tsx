"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ExternalLink, FileText, Globe } from "lucide-react";
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
 * A citation chip. Click to see the exact passage the claim came from.
 * Used inline in proposals and next to facts and funder details.
 */
export function CitationChip({ label, excerpt, sourceTitle, url, page, kind = "document", verifiedAt, size = "sm", className }: CitationChipProps) {
  const Icon = kind === "web" ? Globe : FileText;
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border border-transparent bg-accent-soft font-medium text-accent-soft-fg transition-colors hover:border-accent",
            size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
            className,
          )}
        >
          <Icon className={size === "sm" ? "size-2.5" : "size-3"} aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-surface-raised p-4 text-sm shadow-md animate-rise-in focus:outline-none"
        >
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-subtle">
            <Icon className="size-3.5" aria-hidden />
            {sourceTitle ?? label}
            {page ? <span>, page {page}</span> : null}
          </p>
          {excerpt ? (
            <blockquote className="border-l-2 border-accent pl-3 font-display text-[0.95rem] leading-relaxed text-fg">“{excerpt}”</blockquote>
          ) : (
            <p className="text-fg-muted">Source passage will appear here.</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-fg-subtle">
            {verifiedAt ? <span title={formatDate(verifiedAt)}>Verified {relativeTime(verifiedAt)}</span> : <span />}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                Open source <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>
          <PopoverPrimitive.Arrow className="fill-surface-raised" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** "Source: funder.org · Verified 3 days ago" line. */
export function VerifiedSource({ url, verifiedAt, className, label }: { url: string; verifiedAt: string; className?: string; label?: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep the raw string
  }
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-subtle", className)}>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fg-muted underline-offset-2 hover:text-fg hover:underline">
        <Globe className="size-3" aria-hidden />
        {label ?? host}
      </a>
      <span aria-hidden>·</span>
      <span>
        Verified <time dateTime={verifiedAt}>{relativeTime(verifiedAt)}</time>
      </span>
    </p>
  );
}
