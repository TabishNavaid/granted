import type { CacheBackend } from "@/lib/cache";
import { adminClient } from "./clients";

/** Cache entries in Postgres so every server instance shares Grants.gov and model results. */
export function supabaseCacheBackend(): CacheBackend {
  const db = adminClient();
  return {
    async get(key) {
      const { data } = await db.from("cache_entries").select("value, expires_at").eq("key", key).maybeSingle();
      if (!data) return null;
      return { value: data.value, expiresAt: new Date(String(data.expires_at)).getTime() };
    },
    async set(key, value, expiresAt) {
      await db.from("cache_entries").upsert({ key, value, expires_at: new Date(expiresAt).toISOString() }, { onConflict: "key" });
    },
  };
}
