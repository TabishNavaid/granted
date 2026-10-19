import type { Metadata } from "next";
import { demoPage } from "@/lib/demo/page";
import render from "./render";
import { services } from "@/lib/services";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const app = await services.applications.get(id).catch(() => null);
  return { title: app ? `${app.opportunity.title} draft` : "Draft" };
}

export default demoPage("draft", render);
