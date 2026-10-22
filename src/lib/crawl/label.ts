import type { Fact } from "@/lib/types";

/** "riverbendyouth.org/about" for a source chip. */
export function sourceLabelFor(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/, "");
    const label = `${u.hostname.replace(/^www\./, "")}${p}`;
    return label.length > 42 ? `${label.slice(0, 40)}…` : label;
  } catch {
    return url;
  }
}

/** The short source name shown on a fact's citation: its own label, or where it came from. */
export const factLabel = (f: Pick<Fact, "sourceLabel" | "sourceUrl">) => f.sourceLabel ?? (f.sourceUrl ? sourceLabelFor(f.sourceUrl) : "Source");
