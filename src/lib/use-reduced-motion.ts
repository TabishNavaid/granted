"use client";

import * as React from "react";

const query = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  return React.useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
