import type { Metadata } from "next";
import { demoPage } from "@/lib/demo/page";
import render from "./render";

export const metadata: Metadata = { title: "Your first matches" };

export default demoPage("onboardingMatches", render);
