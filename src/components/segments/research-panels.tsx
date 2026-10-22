"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { FundedAnalog, ResearchProfile } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { programsFrom } from "@/lib/research";
import { FUNDER_AI_POLICIES } from "@/lib/research/policies";
import { formatMoney } from "@/lib/format";

/** A research team's records: people, papers, prior awards, facilities. Proposals cite them; biosketches and facilities are built from them. */
export function TeamRecordsPanel({ profile, readOnly }: { profile: ResearchProfile | null; readOnly: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [keywords, setKeywords] = React.useState((profile?.keywords ?? []).join("; "));
  const [capabilities, setCapabilities] = React.useState((profile?.capabilities ?? []).join("\n"));
  if (!profile) return <EmptyState size="sm" title="No team profile yet" description="Run setup with your lab or company page, and we read investigators, publications, awards, and facilities from it for you to check." />;
  const save = async () => {
    await services.research.saveProfile({ keywords: keywords.split(";").map((k) => k.trim()).filter(Boolean).slice(0, 6), capabilities: capabilities.split("\n").map((k) => k.trim()).filter(Boolean) });
    toast({ title: "Team profile saved", description: "The next search uses your new phrases." });
    router.refresh();
  };
  return (
    <div className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
      <section>
        <h2 className="font-display text-2xl text-ink">{profile.institution}</h2>
        {profile.department ? <p className="text-base text-ink-muted">{profile.department}</p> : null}
        <h3 className="mt-6 font-semibold text-ink">Investigators</h3>
        <ul className="mt-2 border-t border-rule">
          {profile.investigators.map((i) => (
            <li key={i.id} className="border-b border-rule py-3">
              <p className="font-semibold text-ink">{i.name}</p>
              <p className="text-sm text-ink-muted">
                {i.title}, {i.role === "pi" ? "principal investigator" : i.role === "co_pi" ? "co-investigator" : i.role}
              </p>
              <p className="text-base text-ink">{i.expertise.join(", ")}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 font-semibold text-ink">Publications</h3>
        <ul className="mt-2 border-t border-rule">
          {profile.publications.map((p) => (
            <li key={p.id} className="border-b border-rule py-3 text-base text-ink">
              {p.authors}. {p.title}. <em>{p.venue}</em>, {p.year}.
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-ink">Prior awards</h3>
        <ul className="mt-2 border-t border-rule">
          {profile.priorAwards.length ? (
            profile.priorAwards.map((a) => (
              <li key={a.id} className="border-b border-rule py-3 text-base text-ink">
                {a.title} <span className="text-ink-muted">, {a.funder}{a.amount ? `, ${formatMoney(a.amount)}` : ""}{a.endYear ? `, ended ${a.endYear}` : ""}</span>
              </li>
            ))
          ) : (
            <li className="border-b border-rule py-3 text-base text-ink-muted">None listed.</li>
          )}
        </ul>
        <h3 className="mt-6 font-semibold text-ink">Facilities</h3>
        <ul className="mt-2 border-t border-rule">
          {profile.facilities.map((f) => (
            <li key={f.id} className="border-b border-rule py-3 text-base">
              <span className="font-semibold text-ink">{f.name}.</span> <span className="text-ink">{f.description}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-4">
          <Field id="r-keywords" label="Search phrases, separated by semicolons" hint="Grants.gov, NSF, and NIH are searched for these.">
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} disabled={readOnly} />
          </Field>
          <Field id="r-caps" label="Capabilities, one per line">
            <Textarea rows={4} value={capabilities} onChange={(e) => setCapabilities(e.target.value)} disabled={readOnly} />
          </Field>
          {readOnly ? null : (
            <Button className="self-start" onClick={save}>
              Save
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

/** Funded NSF and NIH projects like the team's work: who funds it, through which program, managed by whom. */
export function FundedAnalogsPanel({ analogs, status, recordedOn }: { analogs: FundedAnalog[]; status: "live" | "recorded"; recordedOn: string | null }) {
  const programs = programsFrom(analogs).slice(0, 6);
  return (
    <div>
      <p className="max-w-[70ch] text-base text-ink-muted">
        Projects NSF and NIH funded that look like your work, from the NSF Award Search and NIH RePORTER. They show which programs fund this kind of research and which program officers manage it, which is often the best next call.
        {status === "recorded" ? ` Recorded on ${recordedOn}.` : ""}
      </p>
      {programs.length ? (
        <>
          <h2 className="mt-6 font-display text-2xl text-ink">Programs that fund this work</h2>
          <ul className="mt-3 border-t border-rule">
            {programs.map((p) => (
              <li key={`${p.source}${p.program}`} className="grid gap-x-6 border-b border-rule py-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold text-ink">
                    {p.program} <span className="text-sm font-normal text-ink-muted">, {p.source.toUpperCase()}</span>
                  </p>
                  {p.officers.length ? <p className="text-sm text-ink-muted">Program officers: {p.officers.slice(0, 3).join(", ")}</p> : null}
                </div>
                <p className="text-base text-ink tnum">
                  {p.count} project{p.count === 1 ? "" : "s"}
                  {p.total ? `, ${formatMoney(p.total)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h2 className="mt-8 font-display text-2xl text-ink">Funded projects</h2>
      <ul className="mt-3 border-t border-rule">
        {analogs.slice(0, 20).map((a) => (
          <li key={`${a.source}${a.id}`} className="border-b border-rule py-3">
            <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center font-semibold text-ink underline-offset-4 hover:underline">
              {a.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-sm text-ink-muted">
              {[a.source.toUpperCase(), a.institution, a.state, a.program, a.amount ? formatMoney(a.amount) : null, a.startDate?.slice(0, 4)].filter(Boolean).join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What major research funders say about AI in proposals, with sources. */
export function AiPoliciesPanel() {
  return (
    <div className="max-w-3xl">
      <p className="text-base text-ink-muted">Major research funders differ on AI. Every research proposal you draft here shows its funder&apos;s rule on the checklist. Checked October 18, 2026; rules change, so follow the links.</p>
      <ul className="mt-4 border-t border-rule">
        {FUNDER_AI_POLICIES.map((p) => (
          <li key={p.key} className="border-b border-rule py-4">
            <h3 className="font-display text-xl text-ink">{p.agency}</h3>
            <p className="mt-1 text-base text-ink">{p.summary}</p>
            <p className="mt-1 text-base text-ink">
              <span className="font-semibold">What to do:</span> {p.whatToDo}
            </p>
            {p.sources.length ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {p.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center text-ink underline underline-offset-4">
                      {s.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>{" "}
                    <span className="text-ink-muted">{s.date}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
