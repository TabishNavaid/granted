import { sha1Hex } from "@/lib/hash";

/**
 * A small JSON cache with a TTL so repeat runs do not call Grants.gov or the
 * model again. Entries live in memory, on disk (.cache/ in dev, the OS temp
 * dir elsewhere), and in Supabase when a backend is registered.
 */
export interface CacheBackend {
  get(key: string): Promise<{ value: unknown; expiresAt: number } | null>;
  set(key: string, value: unknown, expiresAt: number): Promise<void>;
}

const memory = ((globalThis as typeof globalThis & { __fundfellowsCache?: Map<string, { value: unknown; expiresAt: number }> }).__fundfellowsCache ??= new Map<string, { value: unknown; expiresAt: number }>());
let backend: CacheBackend | null = null;

export function registerCacheBackend(b: CacheBackend | null) {
  backend = b;
}

// The disk copy is a server thing; the browser demo never reads live sources, so it keeps memory only.
// The imports are left to the runtime so a browser bundle never tries to include them.
async function disk() {
  if (typeof window !== "undefined") throw new Error("no disk in the browser");
  const [fs, os, path] = await Promise.all([import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "node:fs/promises"), import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "node:os"), import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "node:path")]);
  const dev = process.env.NODE_ENV !== "production";
  const dir = dev ? path.join(process.cwd(), ".cache") : path.join(os.tmpdir(), "fundfellows-cache");
  return { fs, dir, file: (key: string) => path.join(dir, sha1Hex(key) + ".json") };
}

async function readFile(key: string) {
  try {
    const { fs, file } = await disk();
    const raw = await fs.readFile(file(key), "utf8");
    return JSON.parse(raw) as { value: unknown; expiresAt: number };
  } catch {
    return null;
  }
}

async function writeFile(key: string, entry: { value: unknown; expiresAt: number }) {
  try {
    const { fs, dir, file } = await disk();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file(key), JSON.stringify(entry));
  } catch {
    // Read-only filesystem: memory and the backend still have it.
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const m = memory.get(key);
  if (m && m.expiresAt > now) return m.value as T;
  const f = await readFile(key);
  if (f && f.expiresAt > now) {
    memory.set(key, f);
    return f.value as T;
  }
  if (backend) {
    try {
      const b = await backend.get(key);
      if (b && b.expiresAt > now) {
        memory.set(key, b);
        return b.value as T;
      }
    } catch {
      // The backend is best effort.
    }
  }
  return null;
}

export async function cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  const entry = { value, expiresAt: Date.now() + ttlMs };
  memory.set(key, entry);
  await writeFile(key, entry);
  if (backend) {
    try {
      await backend.set(key, value, entry.expiresAt);
    } catch {
      // Best effort.
    }
  }
}

/** Run `fn` unless a fresh cached value exists. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>, opts: { bypass?: boolean } = {}): Promise<{ value: T; fromCache: boolean }> {
  if (!opts.bypass) {
    const hit = await cacheGet<T>(key);
    if (hit !== null) return { value: hit, fromCache: true };
  }
  const value = await fn();
  await cacheSet(key, value, ttlMs);
  return { value, fromCache: false };
}

export const HOURS = 60 * 60 * 1000;
