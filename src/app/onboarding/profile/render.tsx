import { services } from "@/lib/services";
import { ProfileStep } from "./profile-step";
import { PersonConfirmStep } from "./person-confirm";

export default async function OnboardingProfilePage() {
  const [org, facts, documents] = await Promise.all([services.org.get(), services.knowledge.listFacts(), services.knowledge.listDocuments()]);
  if (org.orgType === "individual") return <PersonConfirmStep profile={await services.person.getProfile()} />;
  // What we just read, waiting on the director. The demo's recorded runs land here the same way.
  const pending = facts.filter((f) => f.status === "needs_review" && f.sourceLabel !== "You");
  const shown = pending.length ? pending : facts.filter((f) => f.status === "confirmed");
  let records: { heading: string; items: string[]; note: string } | null = null;
  if (org.orgType === "firm") {
    const [projects, people, certs] = await Promise.all([services.firm.listProjects(), services.firm.listPersonnel(), services.firm.listCertifications()]);
    records = { heading: "Your projects, people, and credentials", note: "What bids will draw on. Anything read from your site was kept only where a page says so. Add contract values, references, and photos on the Firm and records page after setup.", items: [...projects.map((p) => `Project: ${p.name}, ${p.client}`), ...people.map((p) => `Person: ${p.name}, ${p.title}`), ...certs.map((c) => `Credential: ${c.label}`)] };
  } else if (org.orgType === "research") {
    const r = await services.research.getProfile();
    if (r) records = { heading: "Team, publications, and facilities", note: "Read from your lab page. Biosketches and the facilities section are built from these.", items: [...r.investigators.map((i) => `Investigator: ${i.name}, ${i.title}`), ...r.publications.map((p) => `Publication: ${p.title} (${p.year})`), ...r.priorAwards.map((a) => `Prior award: ${a.title}`), ...r.facilities.map((f) => `Facility: ${f.name}`)] };
  }
  return <ProfileStep org={org} facts={shown} documents={documents} real alreadyConfirmed={pending.length === 0} records={records} />;
}
