import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { FunderDetail } from "./funder-detail";

/** Links encode the id; decode it once, and keep the raw value if it was never encoded. */
function safeDecode(id: string) {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await services.funders.get(safeDecode(id));
  return { title: profile ? profile.funder.name : "Funder" };
}

export default async function FunderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await services.funders.get(safeDecode(id));
  if (!profile) notFound();
  return <FunderDetail profile={profile} />;
}
