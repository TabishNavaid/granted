import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <main id="main" className="flex flex-col px-6 py-8 sm:px-12 lg:px-20">
        <Logo />
        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
      <aside className="hidden flex-col justify-between bg-accent p-12 text-accent-fg lg:flex" aria-label="Why Granted">
        <p className="text-sm font-medium opacity-80">Verified by default</p>
        <blockquote className="max-w-md">
          <p className="font-display text-3xl leading-snug">“I opened the Inbox on a Tuesday, answered four questions, and had a proposal I would have taken a week to write.”</p>
          <footer className="mt-5 text-sm opacity-80">An executive director in our pilot cohort. Fictional quote for the demo.</footer>
        </blockquote>
        <ul className="flex flex-col gap-2 text-sm opacity-90">
          <li>Nothing is sent or submitted without your approval.</li>
          <li>Every fact links to the document it came from.</li>
          <li>Your data is never used to train models.</li>
        </ul>
      </aside>
    </div>
  );
}
