import { services } from "@/lib/services";
import { EinStep } from "./ein-step";

export default async function EinPage() {
  const org = await services.org.get();
  return <EinStep initialEin={org.ein} />;
}
