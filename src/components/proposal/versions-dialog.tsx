"use client";

import * as React from "react";
import type { SectionVersion } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

/** Earlier versions of a section. Restoring keeps the current text as a version too. */
export function VersionsDialog({ open, onOpenChange, versions, onRestore, loading }: { open: boolean; onOpenChange: (o: boolean) => void; versions: SectionVersion[]; onRestore: (id: string) => Promise<void>; loading: boolean }) {
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const plain = (html: string) => html.replace(/<span data-gap="[^"]*" data-label="([^"]*)"><\/span>/g, "[NEED: $1]").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Earlier versions</DialogTitle>
          <DialogDescription>A version is saved before every rewrite and restore. Nothing is lost.</DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-ink-muted">Loading</p> : versions.length === 0 ? <p className="text-base text-ink-muted">No earlier versions yet. One is saved the first time you rewrite this section.</p> : (
          <ul className="max-h-96 overflow-y-auto border-t border-rule">
            {versions.map((v) => (
              <li key={v.id} className="border-b border-rule py-3">
                <p className="flex flex-wrap gap-x-4 text-sm">
                  <span className="font-semibold text-ink">{v.note}</span>
                  <span className="text-ink-muted">{formatDate(v.createdAt, "MMM d, h:mm a")}</span>
                  {v.byName ? <span className="text-ink-muted">{v.byName}</span> : null}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{plain(v.bodyHtml)}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  loading={restoring === v.id}
                  onClick={async () => {
                    setRestoring(v.id);
                    await onRestore(v.id);
                    setRestoring(null);
                  }}
                >
                  Restore this version
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
