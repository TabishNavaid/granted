import { Logo } from "@/components/app/logo";
import { DawnScene, SealedLetter } from "@/components/brand/illustrations";
import { PRODUCT_NAME } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <main id="main" className="flex flex-col px-6 py-8 sm:px-12 lg:px-20">
        <Logo />
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-night p-12 text-night-fg lg:flex" aria-label={`Why ${PRODUCT_NAME}`}>
        <div className="absolute inset-0 -z-10">
          <DawnScene lanterns={false} />
        </div>
        <p className="text-sm font-semibold text-glow">Nothing leaves without you</p>
        <blockquote className="max-w-md">
          <p className="font-display text-3xl leading-snug">“I answered four questions on a Tuesday and had a proposal I would have taken a week to write.”</p>
          <footer className="mt-5 text-sm text-night-fg/80">Dana, executive director of a youth program. Illustrative quote for the demo.</footer>
        </blockquote>
        <div className="flex items-center gap-4 rounded-2xl border border-night-fg/15 bg-night-raised/60 p-4 backdrop-blur-sm">
          <SealedLetter size={56} className="text-night-fg" />
          <ul className="flex flex-col gap-1 text-sm text-night-fg/90">
            <li>Every fact links to the document it came from.</li>
            <li>Nothing is sent or submitted without your approval.</li>
            <li>Your data is never used to train models.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
