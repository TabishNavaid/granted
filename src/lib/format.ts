import { differenceInCalendarDays, format, formatDistanceToNowStrict, isPast, parseISO } from "date-fns";

export function formatMoney(amount: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (amount == null) return "Not listed";
  if (opts.compact && amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (opts.compact && amount >= 1000) {
    const k = amount / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function formatRange(min: number | null, max: number | null) {
  if (min == null && max == null) return "Amount not listed";
  if (min != null && max != null) return `${formatMoney(min, { compact: true })} to ${formatMoney(max, { compact: true })}`;
  if (min != null) return `From ${formatMoney(min, { compact: true })}`;
  return `Up to ${formatMoney(max, { compact: true })}`;
}

export function formatDate(iso: string | null | undefined, pattern = "MMM d, yyyy") {
  if (!iso) return "No date";
  return format(parseISO(iso), pattern);
}

export function formatShortDate(iso: string) {
  return format(parseISO(iso), "MMM d");
}

export function relativeTime(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

export function daysUntil(iso: string) {
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export function deadlineLabel(iso: string | null) {
  if (!iso) return { text: "Rolling", tone: "neutral" as const };
  const d = daysUntil(iso);
  if (isPast(parseISO(iso)) && d < 0) return { text: "Passed", tone: "neutral" as const };
  if (d === 0) return { text: "Due today", tone: "danger" as const };
  if (d === 1) return { text: "Due tomorrow", tone: "danger" as const };
  if (d <= 7) return { text: `${d} days left`, tone: "danger" as const };
  if (d <= 21) return { text: `${d} days left`, tone: "warning" as const };
  return { text: `${d} days left`, tone: "neutral" as const };
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
