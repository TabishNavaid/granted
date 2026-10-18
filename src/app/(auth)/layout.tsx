import { Logo } from "@/components/app/logo";
import { PRODUCT_NAME } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main id="main" className="flex flex-col px-4 py-8 sm:px-12 lg:px-20">
        <Logo />
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
      <aside className="hidden flex-col justify-center bg-paper-tint px-16 py-12 lg:flex" aria-label={`Why ${PRODUCT_NAME}`}>
        <blockquote className="max-w-md">
          <p className="font-display text-3xl leading-snug text-ink">“I answered four questions on a Tuesday and had a proposal I would have taken a week to write.”</p>
          <footer className="mt-5 text-sm text-ink-muted">Dana, executive director of a youth program. An illustrative quote.</footer>
        </blockquote>
      </aside>
    </div>
  );
}
