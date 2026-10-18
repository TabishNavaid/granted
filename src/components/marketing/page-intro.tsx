/** The top of every marketing subpage: one headline and one line under it, left aligned. */
export function PageIntro({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <section className="border-b-2 border-ink">
      <div className="mx-auto max-w-[75rem] px-4 pb-12 pt-14 sm:px-6 lg:px-10 lg:pb-16 lg:pt-20">
        <h1 className="max-w-[16ch] font-display text-h1 text-ink">{title}</h1>
        {lead ? <p className="mt-5 max-w-[60ch] text-lg text-ink-muted sm:text-xl">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function Prose({ sections }: { sections: readonly { heading: string; body: readonly string[] }[] }) {
  return (
    <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[14rem_1fr] lg:gap-16 lg:px-10 lg:py-20">
      <nav aria-label="On this page" className="mb-10 lg:mb-0 lg:sticky lg:top-24 lg:self-start">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted lg:flex-col lg:gap-y-2.5">
          {sections.map((s, i) => (
            <li key={s.heading}>
              <a href={`#s-${i + 1}`} className="underline-offset-4 hover:text-ink hover:underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-[68ch]">
        {sections.map((s, i) => (
          <section key={s.heading} id={`s-${i + 1}`} className="scroll-mt-24 border-t border-rule py-8 first:border-t-0 first:pt-0">
            <h2 className="font-display text-2xl text-ink">{s.heading}</h2>
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 text-base leading-relaxed text-ink">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
