import type { ApplicationView, PersonProfile, ResearchProfile } from "@/lib/types";
import type { DemoState } from "./mock";
import { makeSegmentServices } from "./segments";
import { sessionMap } from "./demo-session";
import type { RfpPage } from "@/lib/bids/rfp";

/**
 * Firms, bids, research teams, and individuals over the demo's in-memory
 * state. Uploaded solicitations keep their pages here, by document id, so a
 * requirement can cite the page it is on.
 */
const docPages = sessionMap<{ pages: RfpPage[]; fileName: string }>("docPages");

export function rememberDocumentPages(documentId: string, fileName: string, pages: RfpPage[]) {
  docPages.set(documentId, { pages, fileName });
}

export function makeMockSegments(deps: { state: DemoState; newId: (p: string) => string; now: () => string; requireEditor: () => void; toApplicationView: (a: DemoState["applications"][number]) => ApplicationView }) {
  const { state } = deps;
  const clone = <T>(v: T): T => structuredClone(v);
  const upsert = <T extends { id: string }>(list: T[], row: T) => {
    const i = list.findIndex((x) => x.id === row.id);
    if (i >= 0) list[i] = row;
    else list.push(row);
    return clone(row);
  };
  const backend: import("./segments").SegmentBackend = {
    store: () => import("@/lib/bids/memory-store").then((m) => m.memoryBidStore),
    requireEditor: deps.requireEditor,
    newId: deps.newId,
    now: deps.now,
    async applicationView(id) {
      const a = state.applications.find((x) => x.id === id);
      return a ? deps.toApplicationView(a) : null;
    },
    firm: {
      async get() {
        return clone(state.firmProfile);
      },
      async save(p) {
        state.firmProfile = clone(p);
        return clone(p);
      },
      async projects() {
        return clone(state.projects);
      },
      async saveProject(p) {
        return upsert(state.projects, clone(p));
      },
      async removeProject(id) {
        state.projects = state.projects.filter((p) => p.id !== id);
        for (const m of Object.values(state.bidMeta)) m.projectIds = m.projectIds.filter((x) => x !== id);
      },
      async personnel() {
        return clone(state.personnel);
      },
      async savePerson(p) {
        return upsert(state.personnel, clone(p));
      },
      async removePerson(id) {
        state.personnel = state.personnel.filter((p) => p.id !== id);
        for (const m of Object.values(state.bidMeta)) m.assignments = m.assignments.map((a) => (a.personnelId === id ? { ...a, personnelId: null, why: "No one is assigned." } : a));
      },
      async certifications() {
        return clone(state.certifications);
      },
      async saveCertification(c) {
        return upsert(state.certifications, clone(c));
      },
      async removeCertification(id) {
        state.certifications = state.certifications.filter((c) => c.id !== id);
      },
    },
    research: {
      async get() {
        return clone(state.researchProfile);
      },
      async save(p: ResearchProfile) {
        state.researchProfile = clone(p);
        return clone(p);
      },
    },
    person: {
      async get() {
        return clone(state.personProfile);
      },
      async save(p: PersonProfile) {
        state.personProfile = clone(p);
        return clone(p);
      },
    },
    async documentPages(id) {
      const kept = docPages.get(id);
      if (kept) return kept;
      const doc = state.documents.find((d) => d.id === id);
      const text = state.documentTexts[id];
      return doc && text ? { pages: [{ page: 1, text }], fileName: doc.fileName } : null;
    },
    async addedNoticeIds() {
      return new Set(state.opportunities.filter((o) => o.id.startsWith("bid_sam_")).map((o) => o.id.replace(/^bid_/, "")));
    },
  };
  return { services: makeSegmentServices(backend), backend };
}
