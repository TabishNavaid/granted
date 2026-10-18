import type { Metadata } from "next";
import { services } from "@/lib/services";
import { EinStep } from "./ein-step";

export const metadata: Metadata = { title: "Your EIN" };

export default async function EinPage() {
  const org = await services.org.get();
  return <EinStep initialEin={org.ein} />;
}
