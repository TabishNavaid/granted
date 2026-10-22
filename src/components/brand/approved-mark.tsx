import { cn } from "@/lib/utils";

/**
 * The mark for "a person approved this": a fellow-green check in a circle that draws itself once. With reduced
 * motion it is simply there. Decorative; the words next to it say what happened.
 */
export function ApprovedMark({ className, grow = false }: { className?: string; grow?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("inline-block h-6 w-6 text-fellow", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" className={grow ? "animate-draw" : undefined} style={{ strokeDasharray: 63, strokeDashoffset: grow ? undefined : 0 }} />
      <path d="M7.5 12.5l3 3 6-6.5" className={grow ? "animate-draw-late" : undefined} style={{ strokeDasharray: 16, strokeDashoffset: grow ? undefined : 0 }} />
    </svg>
  );
}
