/**
 * Demo sessions. Each visitor to the demo gets their own copy of the sample
 * workspaces, so two people trying the shared link at once never see each
 * other's changes.
 *
 * In the browser (the demo with no keys, see src/lib/demo): one session, this
 * visitor's, saved to localStorage after every call, so a reload, a new tab,
 * or a different serverless instance changes nothing. When the browser
 * refuses localStorage it falls back to sessionStorage, then to memory for
 * the life of the tab.
 *
 * On a server (the demo with a model key, scripts): sessions live in memory,
 * keyed by the cookie the proxy sets, and expire after a quiet period. Code
 * that reads demo state outside a session (an ICS feed fetched by a calendar
 * app, a test) gets the shared default session.
 */
export const DEMO_COOKIE = "ff_demo";

export interface DemoSession<W> {
  id: string;
  workspaces: Map<string, W>;
  currentId: string;
  touchedAt: number;
  /** Lookups that belong to the visitor but not to one workspace: RFP pages, uploaded pages, notice texts, added workspaces. */
  maps: Map<string, Map<string, unknown>>;
  counters: Record<string, number>;
}

const MAX_SESSIONS = 300;
const IDLE_MS = 12 * 60 * 60 * 1000;
const BROWSER = typeof window !== "undefined";

// Next exposes AsyncLocalStorage on the server's global object; scripts run without it and use the shared session.
type Als = { run<T>(store: string, fn: () => T): T; getStore(): string | undefined };
const g = globalThis as typeof globalThis & {
  AsyncLocalStorage?: new () => Als;
  __fundfellowsDemoAls?: Als | null;
  __fundfellowsDemoSessions?: Map<string, DemoSession<unknown>>;
};
function als(): Als | null {
  if (g.__fundfellowsDemoAls === undefined) g.__fundfellowsDemoAls = !BROWSER && typeof g.AsyncLocalStorage === "function" ? new g.AsyncLocalStorage() : null;
  return g.__fundfellowsDemoAls;
}

export function runInSession<T>(sessionId: string | null | undefined, fn: () => T): T {
  const a = als();
  return a ? a.run(sessionId && /^[\w-]{8,64}$/.test(sessionId) ? sessionId : "shared", fn) : fn();
}

export function currentSessionId(): string {
  return BROWSER ? "browser" : (als()?.getStore() ?? "shared");
}

// Route handlers and server actions can load separate copies of a module; the sessions must be one table.
const sessions = (g.__fundfellowsDemoSessions ??= new Map());

function sweep(now: number) {
  for (const [id, s] of sessions) if (now - s.touchedAt > IDLE_MS && id !== "shared") sessions.delete(id);
  if (sessions.size <= MAX_SESSIONS) return;
  const oldest = [...sessions.values()].filter((s) => s.id !== "shared").sort((a, b) => a.touchedAt - b.touchedAt);
  for (const s of oldest.slice(0, sessions.size - MAX_SESSIONS)) sessions.delete(s.id);
}

let defaultWorkspaceId = "";

/** The session the current call runs in, created on first use (in the browser, from what was saved). */
export function demoSession(): DemoSession<unknown> {
  const id = currentSessionId();
  const now = Date.now();
  if (BROWSER && browser.stale && !browser.busy) {
    browser.stale = false;
    sessions.delete(id);
  }
  let s = sessions.get(id);
  if (!s) {
    if (!BROWSER) sweep(now);
    s = (BROWSER ? loadSnapshot() : null) ?? { id, workspaces: new Map(), currentId: defaultWorkspaceId, touchedAt: now, maps: new Map(), counters: {} };
    sessions.set(id, s);
  }
  s.touchedAt = now;
  return s;
}

/** A visitor-wide lookup that survives a reload in the browser demo. Reads the current session on every call. */
export function sessionMap<V>(name: string) {
  const map = (): Map<string, V> => {
    const s = demoSession();
    let m = s.maps.get(name);
    if (!m) s.maps.set(name, (m = new Map()));
    return m as Map<string, V>;
  };
  return {
    get: (key: string) => map().get(key),
    set: (key: string, value: V) => void map().set(key, value),
    has: (key: string) => map().has(key),
    delete: (key: string) => map().delete(key),
    [Symbol.iterator]: () => map()[Symbol.iterator](),
  };
}

/** The next number in a visitor-wide sequence (ids), so ids stay unique across reloads. */
export function nextInSequence(name: string, start: number): number {
  const s = demoSession();
  const n = (s.counters[name] ?? start) + 1;
  s.counters[name] = n;
  return n;
}

/** A session table for one kind of workspace. Created once by the demo state module. */
export function sessionTable<W>(factory: (workspaceId: string) => W, defaultWorkspace: string) {
  defaultWorkspaceId = defaultWorkspace;
  const session = () => demoSession() as DemoSession<W>;

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

// ---------- Browser storage ----------

const KEY = "ff_demo_v1";
const VERSION = 1;

interface Snapshot {
  v: number;
  currentId: string;
  workspaces: Record<string, unknown>;
  maps: Record<string, [string, unknown][]>;
  counters: Record<string, number>;
}

const browser: { storage: Storage | null | undefined; stale: boolean; busy: boolean; listening: boolean; warned: boolean } = { storage: undefined, stale: false, busy: false, listening: false, warned: false };

/** localStorage, else sessionStorage, else nothing (memory for the life of the tab). */
function storage(): Storage | null {
  if (browser.storage !== undefined) return browser.storage;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const s = window[name];
      s.setItem("__fl_probe", "1");
      s.removeItem("__fl_probe");
      return (browser.storage = s);
    } catch {
      // private mode, blocked site data: try the next one
    }
  }
  return (browser.storage = null);
}

function loadSnapshot(): DemoSession<unknown> | null {
  if (!browser.listening) {
    browser.listening = true;
    // Another tab saved: read its copy before the next call here.
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) browser.stale = true;
    });
  }
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as Snapshot;
    if (snap.v !== VERSION || typeof snap.currentId !== "string") return null;
    return {
      id: "browser",
      currentId: snap.currentId,
      touchedAt: Date.now(),
      workspaces: new Map(Object.entries(snap.workspaces ?? {})),
      maps: new Map(Object.entries(snap.maps ?? {}).map(([k, v]) => [k, new Map(v)])),
      counters: snap.counters ?? {},
    };
  } catch {
    return null;
  }
}

/** While a call runs, the saved copy stays as it was before the call, so a reload never lands halfway through one. */
export function setDemoBusy(busy: boolean) {
  browser.busy = busy;
}

/** Save the browser session. Called after every call settles. */
export function saveDemoSession() {
  if (!BROWSER) return;
  const s = sessions.get("browser");
  if (!s) return;
  const snap: Snapshot = {
    v: VERSION,
    currentId: s.currentId,
    workspaces: Object.fromEntries(s.workspaces),
    maps: Object.fromEntries([...s.maps].map(([k, m]) => [k, [...m]])),
    counters: s.counters,
  };
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(snap));
  } catch {
    // Full: keep going in memory for this tab.
    browser.storage = null;
    if (!browser.warned) {
      browser.warned = true;
      console.warn("The demo could not save to this browser's storage, so a reload starts over.");
    }
  }
}

/** Forget this browser's demo: the next call starts from the samples. */
export function clearDemoSession() {
  if (!BROWSER) return;
  sessions.delete("browser");
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nothing saved
  }
}
