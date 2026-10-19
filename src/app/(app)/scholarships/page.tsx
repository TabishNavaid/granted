import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ScholarshipsView } from "./scholarships-view";

export const metadata: Metadata = { title: "Scholarships and fellowships" };

export default async function ScholarshipsPage() {
  const [profile, matches] = await Promise.all([services.scholarships.getProfile(), services.scholarships.matches()]);
  return <ScholarshipsView initialProfile={profile} initialMatches={matches} />;
}
