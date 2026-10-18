import { cn } from "@/lib/utils";

export function fitLabel(score: number) {
  if (score >= 80) return { label: "Strong fit", tone: "strong" as const };
  if (score >= 65) return { label: "Good fit", tone: "good" as const };
  return { label: "Possible fit", tone: "fair" as const };
}

interface FitScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/** A printed score: the number large, its meaning under it, and a five-block meter in ink. */
export function FitScore({ score, size = "md", showLabel = true, className }: FitScoreProps) {
  const { label } = fitLabel(score);
  const filled = Math.round(score / 20);
  return (
    <div className={cn("inline-flex flex-col", className)} role="img" aria-label={`Fit score ${score} out of 100, ${label.toLowerCase()}`}>
      <span className={cn("font-display font-extrabold leading-none text-ink tnum", size === "sm" ? "text-2xl" : size === "md" ? "text-4xl" : "text-6xl")} aria-hidden>
        {score}
      </span>
      <span className={cn("mt-1.5 flex gap-[3px]", size === "lg" && "mt-2.5")} aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={cn("block border border-ink", size === "sm" ? "h-1.5 w-3" : size === "md" ? "h-2 w-4" : "h-2.5 w-6", i < filled && "bg-ink")} />
        ))}
      </span>
      {showLabel ? <span className={cn("mt-1 font-semibold text-ink", size === "sm" ? "text-xs" : "text-sm")} aria-hidden>{label}</span> : null}
    </div>
  );
}
