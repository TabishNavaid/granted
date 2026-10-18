import { Logo } from "@/components/app/logo";
import { Plate } from "@/components/brand/duotone";
import { plates } from "@/lib/images";
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
      <aside className="hidden flex-col justify-between border-l-2 border-ink p-12 lg:flex" aria-label={`Why ${PRODUCT_NAME}`}>
        <Plate image={plates.auth} inks="blue-yellow" aspect="4 / 5" sizes="50vw" priority className="max-w-md" />
        <blockquote className="mt-10 max-w-md">
          <p className="font-display text-2xl leading-tight text-ink">“I answered four questions on a Tuesday and had a proposal I would have taken a week to write.”</p>
          <footer className="mt-4 text-sm text-ink-muted">Dana, executive director of a youth program. An illustrative quote.</footer>
        </blockquote>
      </aside>
    </div>
  );
}
