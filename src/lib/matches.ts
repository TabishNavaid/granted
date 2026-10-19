import type { MatchView } from "@/lib/types";

/** What this search just found comes first, strongest first; matches already in progress follow. */
export function newestFirst(list: MatchView[]): MatchView[] {
  const byFit = [...list].sort((a, b) => b.fitScore - a.fitScore);
  return [...byFit.filter((m) => m.status === "new"), ...byFit.filter((m) => m.status !== "new")];
}
