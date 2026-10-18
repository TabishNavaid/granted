import type { Metadata } from "next";
import { services } from "@/lib/services";
import { SocialView } from "./social-view";

export const metadata: Metadata = { title: "Social" };

export default async function SocialPage() {
  const [campaigns, runtime] = await Promise.all([services.social.listCampaigns(), services.loop.runtime()]);
  return <SocialView campaigns={campaigns} demo={runtime.demo && !runtime.ai} />;
}
