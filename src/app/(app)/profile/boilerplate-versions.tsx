"use client";

import * as React from "react";
import type { Boilerplate, BoilerplateVersion } from "@/lib/types";
import { services } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Older versions of one boilerplate paragraph, with a way back to any of them. */
export function BoilerplateVersionsDialog({ boilerplate, onClose, onRestored }: { boilerplate: Boilerplate | null; onClose: () => void; onRestored: (next: Boilerplate) => void }) {
  const { toast } = useToast();
  const [versions, setVersions] = React.useState<BoilerplateVersion[] | null>(null);
  const [restoring, setRestoring] = React.useState<string | null>(null);

  const load = React.useCallback(async (id: string) => {
    try {
      const list = await services.knowledge.listBoilerplateVersions(id);
      setVersions([...list].sort((a, b) => b.version - a.version));
    } catch {
      setVersions([]);
    }
  }, []);

  // The parent keys this dialog by paragraph, so each opening starts fresh and loads once.
  const id = boilerplate?.id;
  React.useEffect(() => {
    if (!id) return;
    let live = true;
    services.knowledge
      .listBoilerplateVersions(id)
      .then((list) => live && setVersions([...list].sort((a, b) => b.version - a.version)))
      .catch(() => live && setVersions([]));
    return () => {
      live = false;
    };
  }, [id]);

  const restore = async (v: BoilerplateVersion) => {
    if (!boilerplate) return;
    setRestoring(v.id);
    try {
      const next = await services.knowledge.restoreBoilerplateVersion(v.id);
      onRestored(next);
      toast({ title: `Version ${v.version} restored as version ${next.version}`, description: "The text it replaced is kept as a version too." });
      await load(next.id);
    } catch (err) {
      toast({ title: "Could not restore it", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Dialog open={!!boilerplate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        {boilerplate ? (
          <>
            <DialogHeader>
              <DialogTitle>Versions of {boilerplate.title}</DialogTitle>
              <DialogDescription>
                You are on version {boilerplate.version}. Restoring an older one saves the current text as a version first, so nothing is lost.
              </DialogDescription>
            </DialogHeader>
            {versions === null ? (
              <div className="flex flex-col gap-3" aria-label="Loading versions">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-base text-ink-muted">
                {boilerplate.version > 1 ? "Earlier versions were saved before versions were kept, so they are not stored here. " : "No older versions yet. "}
                The next edit you save keeps the current text here.
              </p>
            ) : (
              <ul className="border-t border-rule">
                {versions.map((v) => (
                  <li key={v.id} className="flex flex-col gap-2 border-b border-rule py-4 sm:flex-row sm:items-start sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-ink">
                        Version <span className="tnum">{v.version}</span>
                        <span className="ml-3 text-sm font-normal text-ink-muted">Saved {formatDate(v.savedAt)}</span>
                      </p>
                      <p className="mt-1 line-clamp-3 max-w-[65ch] text-sm text-ink">{v.body}</p>
                    </div>
                    <Button variant="secondary" size="sm" loading={restoring === v.id} disabled={!!restoring} onClick={() => restore(v)}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
