import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The brand mark slot. Renders public/brand/mark.svg. The wordmark is typographic
 * for now; set showMark on Logo once the hand-drawn lantern mark lands in that file.
 */
export function BrandMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/mark.svg" alt="" aria-hidden className={cn("inline-block size-[1em]", className)} />;
}

/** Small lantern used only as a status marker: lit means something is waiting on you. */
export function LanternMark({ className, lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg viewBox="0 0 32 40" className={cn("inline-block size-[1.15em]", className)} aria-hidden fill="none">
      <path d="M12 6a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 10h14l1.5 3.5H7.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 13.5h14v13a7 7 0 0 1-14 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 35h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {lit ? (
        <path className="animate-flicker origin-center" d="M16 17c-2.3 3-3.8 4.6-3.8 7.2a3.8 3.8 0 0 0 7.6 0c0-2.6-1.5-4.2-3.8-7.2z" fill="var(--glow)" />
      ) : (
        <path d="M14 26.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      )}
    </svg>
  );
}

export function Logo({ className, href = "/", size = "md", tone = "ink", showMark = false }: { className?: string; href?: string; size?: "sm" | "md" | "lg"; tone?: "ink" | "paper"; showMark?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-display tracking-tight",
        tone === "ink" ? "text-fg" : "text-night-fg",
        size === "sm" && "text-lg",
        size === "md" && "text-xl",
        size === "lg" && "text-3xl",
        className,
      )}
      aria-label={`${PRODUCT_NAME} home`}
    >
      {showMark ? <BrandMark /> : null}
      <span>{PRODUCT_NAME}</span>
      <span aria-hidden className="mb-[0.55em] inline-block size-[0.28em] rounded-full bg-glow" />
    </Link>
  );
}
