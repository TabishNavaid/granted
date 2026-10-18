import type { Metadata } from "next";
import { services } from "@/lib/services";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function SignUpPage() {
  const runtime = await services.loop.runtime();
  return <SignUpForm magicLink={!runtime.demo} />;
}
