import type { Metadata } from "next";
import { demoPage } from "@/lib/demo/page";
import render from "./render";

export const metadata: Metadata = { title: "Confirm your profile" };

export default demoPage("onboardingProfile", render);
