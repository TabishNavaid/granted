import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "Profile and knowledge" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [org, facts, boilerplates, documents] = await Promise.all([
    services.org.get(),
    services.knowledge.listFacts(),
    services.knowledge.listBoilerplates(),
    services.knowledge.listDocuments(),
  ]);
  return <ProfileView org={org} facts={facts} boilerplates={boilerplates} documents={documents} initialTab={tab} />;
}
