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

/** Ring indicator. The arc length is the score; the color says what it means. */
export function FitScore({ score, size = "md", showLabel = true, className }: FitScoreProps) {
  const { label, tone } = fitLabel(score);
  const px = size === "sm" ? 40 : size === "md" ? 56 : 80;
  const stroke = size === "sm" ? 3.5 : size === "md" ? 4.5 : 6;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = tone === "strong" ? "text-fit-strong" : tone === "good" ? "text-fit-good" : "text-fit-fair";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn("relative shrink-0", color)}
        role="img"
        aria-label={`Fit score ${score} out of 100, ${label.toLowerCase()}`}
        style={{ width: px, height: px }}
      >
        <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden className="-rotate-90">
          <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={stroke} />
          <circle
            cx={px / 2}
            cy={px / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className="transition-[stroke-dasharray] duration-700 [transition-timing-function:var(--ease-out-soft)]"
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-display tnum text-fg",
            size === "sm" ? "text-sm" : size === "md" ? "text-lg" : "text-2xl",
          )}
          aria-hidden
        >
          {score}
        </span>
      </div>
      {showLabel ? (
        <div className="leading-tight">
          <p className={cn("font-medium text-fg", size === "sm" ? "text-sm" : "text-base")}>{label}</p>
          {size !== "sm" ? <p className="text-xs text-fg-subtle">out of 100</p> : null}
        </div>
      ) : null}
    </div>
  );
}
