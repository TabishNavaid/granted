import type { Metadata } from "next";
import { demoPage } from "@/lib/demo/page";
import render from "./render";

export const metadata: Metadata = { title: "Reading your website" };

export default demoPage("onboardingReading", render);
