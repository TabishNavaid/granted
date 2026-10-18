import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-drawn feeling SVG scenes and glyphs. Strokes use currentColor so the
 * same drawing works on paper and on night. Flames are always marigold.
 */

const rough = (
  <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
  </filter>
);

/** The dawn: night sky giving way to marigold at the horizon, hills, and a lantern-lit path. */
export function DawnScene({ className, lanterns = true, anchor = "bottom" }: { className?: string; lanterns?: boolean; anchor?: "top" | "bottom" }) {
  const stars = [
    [120, 90, 1.6], [260, 50, 1], [410, 130, 1.3], [560, 40, 1], [720, 100, 1.8], [880, 60, 1], [1040, 140, 1.4], [1210, 70, 1], [1330, 150, 1.6], [180, 210, 1], [980, 220, 1.1], [1390, 30, 1],
  ];
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio={anchor === "top" ? "xMidYMin slice" : "xMidYMax slice"} className={cn("block h-full w-full", className)} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1838" />
          <stop offset="0.45" stopColor="#362c62" />
          <stop offset="0.72" stopColor="#8a4e5f" />
          <stop offset="0.9" stopColor="#d9884b" />
          <stop offset="1" stopColor="#f2ab3a" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe39a" />
          <stop offset="0.5" stopColor="#f2ab3a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f2ab3a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe39a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f2ab3a" stopOpacity="0" />
        </radialGradient>
        {rough}
      </defs>
      <rect width="1440" height="900" fill="url(#sky)" />
      {stars.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#f4ecdd" opacity={0.5 + (i % 3) * 0.15} />
      ))}
      <circle cx="1010" cy="640" r="220" fill="url(#sun)" opacity="0.9" />
      <g filter="url(#rough)">
        <path d="M-20 700 C 200 640, 380 690, 560 660 S 900 600, 1120 650 S 1360 700, 1460 660 V 920 H -20 Z" fill="#4b3a6e" opacity="0.95" />
        <path d="M-20 760 C 160 720, 360 780, 540 740 S 860 700, 1080 760 S 1320 800, 1460 740 V 920 H -20 Z" fill="#3a2d5c" />
        <path d="M-20 820 C 240 790, 420 850, 640 820 S 980 790, 1200 840 S 1380 860, 1460 830 V 920 H -20 Z" fill="#2a2350" />
      </g>
      {/* the path */}
      <path d="M 400 905 C 520 860, 560 850, 700 820 S 880 790, 960 760 S 1040 730, 1060 700" stroke="#f4ecdd" strokeOpacity="0.55" strokeWidth="14" strokeLinecap="round" fill="none" filter="url(#rough)" />
      <path d="M 400 905 C 520 860, 560 850, 700 820 S 880 790, 960 760 S 1040 730, 1060 700" stroke="#f2ab3a" strokeOpacity="0.35" strokeWidth="4" strokeDasharray="2 18" strokeLinecap="round" fill="none" />
      {lanterns
        ? [
            [520, 846, 1],
            [760, 802, 0.85],
            [960, 752, 0.7],
          ].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <circle r="46" fill="url(#lamp)" opacity="0.8" />
              <line x1="0" y1="0" x2="0" y2="-60" stroke="#f4ecdd" strokeOpacity="0.7" strokeWidth="2.5" />
              <g transform="translate(-10 -92) scale(0.65)">
                <path d="M9 10h14l1.5 3.5H7.5z M9 13.5h14v13a7 7 0 0 1-14 0z M11 35h10 M12 6a4 4 0 0 1 8 0" stroke="#f4ecdd" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M16 17c-2.3 3-3.8 4.6-3.8 7.2a3.8 3.8 0 0 0 7.6 0c0-2.6-1.5-4.2-3.8-7.2z" fill="#ffe39a" />
              </g>
            </g>
          ))
        : null}
    </svg>
  );
}

/** A quieter horizon for section breaks: a sun arc with a few rays. */
export function HorizonRule({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)} aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <svg viewBox="0 0 48 24" className="h-6 w-12 text-glow" fill="none">
        <path d="M8 20a16 16 0 0 1 32 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 2v4M10 8l2.5 2.5M38 8l-2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M2 21h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      </svg>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

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

/** A clearly marked place for a real photo of community work. */
export function PhotoSlot({ className, label = "Photo slot: your community, when you have one" }: { className?: string; label?: string }) {
  return (
    <div className={cn("photo-slot flex items-center justify-center rounded-lg p-6 text-center", className)}>
      <p className="font-hand text-xl text-fg-subtle">{label}</p>
    </div>
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
