import type { Metadata } from "next";
import { demoPage } from "@/lib/demo/page";
import render, { safeDecode } from "./render";
import { services } from "@/lib/services";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await services.funders.get(safeDecode(id)).catch(() => null);
  return { title: profile ? profile.funder.name : "Funder" };
}

export default demoPage("funder", render);
