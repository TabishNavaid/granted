import { redirect } from "next/navigation";
import { services } from "@/lib/services";
import { ReadingStep } from "./reading-step";

export default async function ReadingPage() {
  const [org, demo] = await Promise.all([services.org.get(), services.demo.status()]);
  if (!org.websiteUrl) redirect("/onboarding");
  return <ReadingStep websiteUrl={org.websiteUrl} ein={org.ein || null} recordedOn={demo.replay ? demo.recordedOn : null} />;
}
