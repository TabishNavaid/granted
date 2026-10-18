import Link from "next/link";
import { PageContainer, PageHeader } from "./page-header";
import { Button } from "@/components/ui/button";

export function ComingSoon({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <PageContainer width="narrow">
      <PageHeader eyebrow="Coming soon" title={title} description={description} />
      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        <p className="text-sm font-medium text-fg">What it will do</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-fg-muted">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2.5">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-fg-muted">This is on the Growth plan roadmap. Nothing to set up now.</p>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/inbox">Back to Inbox</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
