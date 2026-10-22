import type { SourceDefinition } from "./types";

export type Tier = "hourly" | "daily" | "weekly" | "monthly";

/**
 * Which GitHub Actions slot a source runs in, read from its own cron: "25 * * * *" is hourly,
 * "15 9 * * *" daily, "40 6 * * 0" weekly, "0 5 1 * *" monthly. A source with no schedule runs daily.
 */
export function tierOf(s: Pick<SourceDefinition, "schedule">): Tier {
  const parts = (s.schedule ?? "").trim().split(/\s+/);
  if (parts.length !== 5) return "daily";
  const [, hour, dom, , dow] = parts;
  if (hour === "*" || hour.includes("/") || hour.includes(",")) return "hourly";
  if (dom !== "*") return "monthly";
  if (dow !== "*") return "weekly";
  return "daily";
}
