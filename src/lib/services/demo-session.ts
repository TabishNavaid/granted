import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Demo sessions. Each visitor to the demo gets their own copy of the sample
 * workspaces, keyed by a cookie the proxy sets, so two people trying the
 * shared link at once never see each other's changes. Sessions live in this
 * process's memory and expire after a quiet period; a restart resets them to
 * the samples, which is what a demo should do.
 *
 * Every service call enters through `runInSession` (see ./server.ts). Code
 * that reads demo state outside a session (an ICS feed fetched by a calendar
 * app, a test) gets the shared default session.
 */
export const DEMO_COOKIE = "fl_demo";

export interface DemoSession<W> {
  id: string;
  workspaces: Map<string, W>;
  currentId: string;
  touchedAt: number;
}

const MAX_SESSIONS = 300;
const IDLE_MS = 12 * 60 * 60 * 1000;

const gs = globalThis as typeof globalThis & { __firstlightDemoAls?: AsyncLocalStorage<string> };
const als = (gs.__firstlightDemoAls ??= new AsyncLocalStorage<string>());

export function runInSession<T>(sessionId: string | null | undefined, fn: () => T): T {
  return als.run(sessionId && /^[\w-]{8,64}$/.test(sessionId) ? sessionId : "shared", fn);
}

export function currentSessionId(): string {
  return als.getStore() ?? "shared";
}

/** A session table for one kind of workspace. Created once by the demo state module. */
export function sessionTable<W>(factory: (workspaceId: string) => W, defaultWorkspace: string) {
  // Route handlers and server actions can load separate copies of a module; the sessions must be one table.
  const g = globalThis as typeof globalThis & { __firstlightDemoSessions?: Map<string, DemoSession<unknown>> };
  const sessions = (g.__firstlightDemoSessions ??= new Map()) as Map<string, DemoSession<W>>;

  function sweep(now: number) {
    for (const [id, s] of sessions) if (now - s.touchedAt > IDLE_MS && id !== "shared") sessions.delete(id);
    if (sessions.size <= MAX_SESSIONS) return;
    const oldest = [...sessions.values()].filter((s) => s.id !== "shared").sort((a, b) => a.touchedAt - b.touchedAt);
    for (const s of oldest.slice(0, sessions.size - MAX_SESSIONS)) sessions.delete(s.id);
  }

  function session(): DemoSession<W> {
    const id = currentSessionId();
    const now = Date.now();
    let s = sessions.get(id);
    if (!s) {
      sweep(now);
      s = { id, workspaces: new Map(), currentId: defaultWorkspace, touchedAt: now };
      sessions.set(id, s);
    }
    s.touchedAt = now;
    return s;
  }

  function workspace(id?: string): W {
    const s = session();
    const key = id ?? s.currentId;
    let w = s.workspaces.get(key);
    if (!w) {
      w = factory(key);
      s.workspaces.set(key, w);
    }
    return w;
  }

  return {
    session,
    workspace,
    /** Make another workspace the one every screen reads. */
    switchTo(id: string) {
      session().currentId = id;
      return workspace(id);
    },
    /** Put a workspace back to its sample state. */
    reset(id?: string) {
      const s = session();
      const key = id ?? s.currentId;
      const w = factory(key);
      s.workspaces.set(key, w);
      return w;
    },
    currentWorkspaceId() {
      return session().currentId;
    },
    openedWorkspaceIds() {
      return [...session().workspaces.keys()];
    },
  };
}
