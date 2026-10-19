import { services } from "@/lib/services";
import { ProfileView } from "./profile-view";
import { CompanyPanel, CredentialsPanel, PeoplePanel, ProjectsPanel } from "@/components/firm/firm-panels";
import { AiPoliciesPanel, FundedAnalogsPanel, TeamRecordsPanel } from "@/components/segments/research-panels";
import { PersonProfilePanel } from "@/components/segments/person-panel";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [org, facts, boilerplates, documents, metrics, voice, me] = await Promise.all([
    services.org.get(),
    services.knowledge.listFacts(),
    services.knowledge.listBoilerplates(),
    services.knowledge.listDocuments(),
    services.knowledge.listMetrics(),
    services.knowledge.getVoice(),
    services.org.currentUser(),
  ]);
  const readOnly = me.role === "reviewer";
  const base = { org, facts, boilerplates, documents, metrics, voice, initialTab: tab };
  if (org.orgType === "firm") {
    const [profile, projects, personnel, certifications] = await Promise.all([services.firm.getProfile(), services.firm.listProjects(), services.firm.listPersonnel(), services.firm.listCertifications()]);
    return (
      <ProfileView
        {...base}
        title="Firm and records"
        description="What a bid is allowed to say about the firm: its projects, people, credentials, and boilerplate. Every claim in a draft cites one of these records."
        hideTabs={["impact", "voice", "overview"]}
        extraTabs={[
          { value: "company", label: "Company", content: <CompanyPanel initial={profile} readOnly={readOnly} /> },
          { value: "projects", label: `Projects (${projects.length})`, content: <ProjectsPanel projects={projects} readOnly={readOnly} /> },
          { value: "people", label: `People (${personnel.length})`, content: <PeoplePanel personnel={personnel} projects={projects} readOnly={readOnly} /> },
          { value: "credentials", label: "Credentials", content: <CredentialsPanel certifications={certifications} readOnly={readOnly} /> },
        ]}
      />
    );
  }
  if (org.orgType === "research") {
    const [profile, analogs] = await Promise.all([services.research.getProfile(), services.research.analogs()]);
    return (
      <ProfileView
        {...base}
        title="Team and records"
        description="Investigators, publications, prior awards, and facilities. Research proposals cite them, and biosketches and facilities are built from them."
        hideTabs={["impact"]}
        extraTabs={[
          { value: "team", label: "Team", content: <TeamRecordsPanel profile={profile} readOnly={readOnly} /> },
          { value: "funded", label: "Funded work like yours", content: <FundedAnalogsPanel analogs={analogs.analogs} status={analogs.status} recordedOn={analogs.recordedOn} /> },
          { value: "ai-rules", label: "Funders' AI rules", content: <AiPoliciesPanel /> },
        ]}
      />
    );
  }
  if (org.orgType === "individual") {
    const person = await services.person.getProfile();
    return (
      <ProfileView
        {...base}
        title="My profile"
        description="Read from your résumé and checked by you. Essays use only what is here, in your words."
        hideTabs={["overview", "impact", "voice", "boilerplate", "facts"]}
        extraTabs={[{ value: "me", label: "Profile", content: <PersonProfilePanel profile={person} readOnly={readOnly} /> }]}
      />
    );
  }
  return <ProfileView {...base} />;
}
