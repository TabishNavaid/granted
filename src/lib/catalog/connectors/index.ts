import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Connector } from "../types";

/**
 * Every connector module in this folder, loaded on demand so one broken
 * source never stops the others. Each module exports `connectors: Connector[]`.
 * Ingestion code only (Node, run by scripts/ingest.ts): the app bundle never imports this file.
 */
export function moduleNames(): string[] {
  return readdirSync(__dirname)
    .filter((f) => /\.ts$/.test(f) && !/^(index|_.*)\.ts$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .sort();
}

export async function loadConnectors(only?: string[]): Promise<Connector[]> {
  const out: Connector[] = [];
  for (const name of moduleNames()) {
    try {
      const mod = (await import(pathToFileURL(path.join(__dirname, `${name}.ts`)).href)) as { connectors?: Connector[] };
      for (const c of mod.connectors ?? []) if (!only?.length || only.includes(c.source.id) || only.includes(name)) out.push(c);
    } catch (err) {
      console.error(`Could not load connector module ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}
