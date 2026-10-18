import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-drawn feeling SVG scenes and glyphs. Strokes use currentColor so the
 * same drawing works on paper and on night. Flames are always marigold.
 */

/** A letter with a wax seal: the mark of something approved. */
export function SealedLetter({ className, size = 64, open = false }: { className?: string; size?: number; open?: boolean }) {
  return (
    <svg viewBox="0 0 64 48" width={size} height={(size * 48) / 64} className={cn("inline-block", className)} aria-hidden fill="none">
      <rect x="3" y="7" width="58" height="38" rx="4" fill="var(--surface-raised)" stroke="currentColor" strokeWidth="2" />
      {open ? (
        <path d="M3 11 L32 -4 L61 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="var(--surface)" />
      ) : (
        <path d="M3 11 L32 30 L61 11" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      )}
      <path d="M3 44 L24 26 M61 44 L40 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {!open ? (
        <g>
          <circle cx="32" cy="31" r="8.5" fill="var(--accent)" stroke="var(--accent-hover)" strokeWidth="1" />
          <path d="M32 26c-1.4 1.9-2.4 2.9-2.4 4.5a2.4 2.4 0 0 0 4.8 0c0-1.6-1-2.6-2.4-4.5z" fill="#ffe39a" />
        </g>
      ) : null}
    </svg>
  );
}

/** A standalone lantern, lit or not. Used for empty and loading states. */
export function LanternGlyph({ className, size = 72, lit = true, glow = true }: { className?: string; size?: number; lit?: boolean; glow?: boolean }) {
  return (
    <svg viewBox="0 0 64 80" width={size} height={(size * 80) / 64} className={cn("inline-block", className)} aria-hidden fill="none">
      {lit && glow ? <circle cx="32" cy="46" r="26" fill="var(--glow)" opacity="0.18" /> : null}
      <path d="M24 12a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 20h28l3 7H15z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M18 27h28v26a14 14 0 0 1-28 0z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 70h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 27v26M38 27v26" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      {lit ? (
        <path className="animate-flicker origin-[32px_46px]" d="M32 34c-4.6 6-7.6 9.2-7.6 14.4a7.6 7.6 0 0 0 15.2 0c0-5.2-3-8.4-7.6-14.4z" fill="var(--glow)" />
      ) : (
        <path d="M28 52h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      )}
    </svg>
  );
}

/** A sprout. Something has started. */
export function Seedling({ className, size = 64 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cn("inline-block", className)} aria-hidden fill="none">
      <path d="M12 54c8-4 32-4 40 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 52V30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 36c-10 0-16-6-16-16 10 0 16 6 16 16z" fill="var(--success-soft)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 30c0-10 6-16 16-16 0 10-6 16-16 16z" fill="var(--success-soft)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/** A small sun coming up over a line. The win moment. */
export function Sunrise({ className, size = 120 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 120 70" width={size} height={(size * 70) / 120} className={cn("inline-block", className)} aria-hidden fill="none">
      <defs>
        <clipPath id="above">
          <rect x="0" y="0" width="120" height="58" />
        </clipPath>
      </defs>
      <g clipPath="url(#above)">
        <circle className="animate-sunrise" cx="60" cy="58" r="22" fill="var(--glow)" />
      </g>
      <path d="M60 10v8M28 24l5.5 5.5M92 24l-5.5 5.5M16 48h8M96 48h8" stroke="var(--glow)" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 58h108" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 66c10-3 70-3 80 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** Marginalia: a handwritten note with a tiny arrow, for one human line. */
export function MarginNote({ children, className, arrow = "left" }: { children: React.ReactNode; className?: string; arrow?: "left" | "right" | "none" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-hand text-xl leading-none text-glow-text", className)}>
      {arrow === "left" ? (
        <svg viewBox="0 0 28 16" className="h-4 w-7 shrink-0" fill="none" aria-hidden>
          <path d="M26 3c-7 1-15 3-24 10m0 0 6-1m-6 1 1-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      <span>{children}</span>
      {arrow === "right" ? (
        <svg viewBox="0 0 28 16" className="h-4 w-7 shrink-0 -scale-x-100" fill="none" aria-hidden>
          <path d="M26 3c-7 1-15 3-24 10m0 0 6-1m-6 1 1-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}
