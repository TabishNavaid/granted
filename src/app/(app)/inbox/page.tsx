import type { Metadata } from "next";
import { services } from "@/lib/services";
import type { InboxContext } from "@/components/app/inbox-item";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [allItems, matches, user, milestones, facts, documents, applications] = await Promise.all([
    services.inbox.list(),
    services.opportunities.listMatches(),
    services.org.currentUser(),
    services.calendar.listMilestones(),
    services.knowledge.listFacts(),
    services.knowledge.listDocuments(),
    services.applications.list(),
  ]);

  // The newest pending plan whose plan record still exists. A replanned month replaces the older plan record.
  let planItem: (typeof allItems)[number] | undefined;
  let plan: Awaited<ReturnType<typeof services.inbox.getPlan>> = null;
  for (const i of allItems) {
    if (i.type !== "monthly_plan" || i.status !== "pending" || i.payload.type !== "monthly_plan") continue;
    const p = await services.inbox.getPlan(i.payload.planId);
    if (p) {
      planItem = i;
      plan = p;
      break;
    }
  }

  const emailIds = allItems.flatMap((i) => (i.payload.type === "email_draft" ? [i.payload.emailDraftId] : []));
  const emails = await Promise.all(emailIds.map((id) => services.inbox.getEmailDraft(id).catch(() => null)));
  const emailById = new Set(emails.flatMap((e) => (e ? [e.id] : [])));
  // An email item whose draft is gone has nothing to show or approve, so it stays out of the list.
  const items = allItems.filter((i) => i.payload.type !== "email_draft" || emailById.has(i.payload.emailDraftId));

  // Emails can be to funders this workspace has neither matched nor applied to (a directory funder, a thank-you after a win).
  const knownFunders = new Set(matches.map((m) => m.funder.id).concat(applications.map((a) => a.funder.id)));
  const extraFunders = await Promise.all(
    Array.from(new Set(emails.flatMap((e) => (e && e.funderId && !knownFunders.has(e.funderId) ? [e.funderId] : [])))).map((id) =>
      services.funders.get(id).then((f) => (f ? ([f.funder.id, f.funder.name] as [string, string]) : null)).catch(() => null),
    ),
  );
  const missingIds = items.flatMap((i) => (i.payload.type === "missing_facts" ? i.payload.missingFactIds : []));
  // Workspaces for every application an Inbox item is about: questions for missing facts, sections for drafts.
  const workspaces = await Promise.all(
    Array.from(new Set(items.flatMap((i) => (i.payload.type === "missing_facts" || i.payload.type === "proposal_draft" ? [i.payload.applicationId] : [])))).map((id) => services.applications.getWorkspace(id)),
  );

  const ctx: InboxContext = {
    matches: Object.fromEntries(matches.map((m) => [m.id, m])),
    emails: Object.fromEntries(emails.flatMap((e) => (e ? [[e.id, e]] : []))),
    milestones: Object.fromEntries(milestones.map((m) => [m.id, m])),
    missingFacts: Object.fromEntries(workspaces.flatMap((w) => (w ? w.missingFacts.filter((m) => missingIds.includes(m.id)).map((m) => [m.id, m]) : []))),
    facts: Object.fromEntries(facts.map((f) => [f.id, f])),
    documents: Object.fromEntries(documents.map((d) => [d.id, d])),
    sections: Object.fromEntries(workspaces.flatMap((w) => (w ? [[w.application.id, w.sections]] : []))),
    funderNames: Object.fromEntries(
      matches
        .map((m) => [m.funder.id, m.funder.name])
        .concat(applications.map((a) => [a.funder.id, a.funder.name]))
        .concat(extraFunders.flatMap((f) => (f ? [f] : []))),
    ),
    applicationTitles: Object.fromEntries(applications.map((a) => [a.id, `${a.funder.name}: ${a.opportunity.title}`])),
  };

  return <InboxView items={items} plan={plan} planItemId={planItem?.id ?? null} ctx={ctx} firstName={user.fullName.split(" ")[0]} />;
}
