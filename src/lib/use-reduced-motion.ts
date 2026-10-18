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

/** Cycles through `steps` states on an interval; sits on the last step when motion is reduced. */
export function useLoop(steps: number, ms: number, pause = 1800) {
  const reduced = useReducedMotion();
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (reduced) return;
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      i = (i + 1) % (steps + 1);
      setStep(i);
      t = setTimeout(tick, i === steps ? pause : i === 0 ? 500 : ms);
    };
    t = setTimeout(tick, ms);
    return () => clearTimeout(t);
  }, [steps, ms, pause, reduced]);
  return reduced ? steps : step;
}
