import type { Metadata } from "next";
import { services } from "@/lib/services";
import { FundersView } from "./funders-view";

export const metadata: Metadata = { title: "Funders" };

export default async function FundersPage() {
  const [known, directory, likeYou] = await Promise.all([services.funders.list(), services.funders.directory("", null), services.funders.fundersLikeYou()]);
  return <FundersView known={known} initialDirectory={directory} likeYou={likeYou} />;
}
