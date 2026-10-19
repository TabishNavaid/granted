import type { Metadata } from "next";
import { services } from "@/lib/services";
import { SocialView } from "./social-view";

export const metadata: Metadata = { title: "Social" };

export default async function SocialPage() {
  const [campaigns, runtime, applications] = await Promise.all([services.social.listCampaigns(), services.loop.runtime(), services.applications.list()]);
  return <SocialView campaigns={campaigns} demo={runtime.demo && !runtime.ai} applications={applications} />;
}
