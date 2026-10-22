"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "failed">("idle");
  if (state === "done") return <p className="mt-6 text-base font-semibold text-ink">Done. You will not get these emails again.</p>;
  return (
    <div className="mt-6">
      <Button
        loading={state === "busy"}
        onClick={async () => {
          setState("busy");
          const r = await fetch(`/api/email/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
          setState(r?.ok ? "done" : "failed");
        }}
      >
        Unsubscribe
      </Button>
      {state === "failed" ? <p className="mt-3 text-sm text-alert">That did not go through. Try again, or turn emails off in Settings.</p> : null}
    </div>
  );
}
