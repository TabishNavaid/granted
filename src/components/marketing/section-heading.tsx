/** A marketing section heading: one sentence, balanced across lines. */
export function SectionHeading({ className, as: Tag = "h2", children }: { className?: string; as?: "h1" | "h2"; children: string }) {
  return <Tag className={`font-display text-ink [text-wrap:balance] ${className ?? "text-4xl sm:text-5xl"}`}>{children}</Tag>;
}
