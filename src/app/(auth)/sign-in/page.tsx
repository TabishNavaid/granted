import type { Metadata } from "next";
import { services } from "@/lib/services";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const [{ error, next }, runtime] = await Promise.all([searchParams, services.loop.runtime()]);
  return <SignInForm magicLink={!runtime.demo} initialError={error ?? null} next={next ?? null} />;
}
