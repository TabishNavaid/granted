import { cn } from "@/lib/utils";

/**
 * The FundFellows mark: two letter Fs facing each other. Their top arms join into one beam; their middle arms
 * reach toward each other and stop short. Two people meeting, a doorway, a portal frame. Drawn on a 32 unit
 * grid so it stays crisp at 16 pixels. Uses currentColor. Source files: public/brand/.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("inline-block h-6 w-6 shrink-0", className)} fill="currentColor" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="5" y="5" width="22" height="4" />
      <rect x="5" y="5" width="4" height="22" />
      <rect x="23" y="5" width="4" height="22" />
      <rect x="9" y="14" width="4.5" height="3.5" />
      <rect x="18.5" y="14" width="4.5" height="3.5" />
    </svg>
  );
}
