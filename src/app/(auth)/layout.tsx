import { Logo } from "@/components/app/logo";
import { Drawing } from "@/components/drawings/drawing";
import { Meadow } from "@/components/drawings/meadow";
import { drawingOf, meadowFlowers } from "@/lib/drawings";
import { PRODUCT_NAME } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const sun = drawingOf("sun");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main id="main" className="flex flex-col px-4 py-8 sm:px-12 lg:px-20">
        <Logo />
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
      <aside className="relative hidden flex-col justify-center overflow-hidden border-l border-rule px-12 pb-56 pt-12 lg:flex" aria-label={`Why ${PRODUCT_NAME}`}>
        {sun ? <Drawing asset={sun} eager className="absolute right-10 top-10 h-28 w-auto" /> : null}
        <blockquote className="max-w-md">
          <p className="font-display text-3xl leading-tight text-ink">“I answered four questions on a Tuesday and had a proposal I would have taken a week to write.”</p>
          <footer className="mt-4 text-sm text-ink-muted">Dana, executive director of a youth program. An illustrative quote.</footer>
        </blockquote>
        <Meadow seed="auth" className="absolute inset-x-0 bottom-0 h-48" clumps={24} flowers={meadowFlowers(5, "auth").map((f, i) => ({ key: `${f.slug}-${i}`, flower: f }))} />
      </aside>
    </div>
  );
}
