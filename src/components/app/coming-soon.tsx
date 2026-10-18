import Link from "next/link";
import { PageContainer, PageHeader } from "./page-header";
import { Button } from "@/components/ui/button";

export function ComingSoon({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <PageContainer width="narrow">
      <PageHeader title={title} description={description} />
      <section className="mt-8" aria-labelledby="soon-title">
        <h2 id="soon-title" className="font-display text-2xl text-ink">
          What it will do
        </h2>
        <ul className="mt-4 flex flex-col divide-y divide-rule border-y border-rule text-base text-ink">
          {bullets.map((b) => (
            <li key={b} className="py-3">
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-[60ch] text-base text-ink-muted">It comes with the Growth plan. Nothing for you to set up now. We will tell you when it is ready.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/inbox">Back to your Inbox</Link>
        </Button>
      </section>
    </PageContainer>
  );
}
