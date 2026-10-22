import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level encryption for secrets we store for users (OAuth access and refresh tokens).
 * AES-256-GCM with a key the database never sees: TOKEN_ENCRYPTION_KEY, 32 random bytes as base64
 * (`openssl rand -base64 32`). Stored form: "enc:v1:" + base64(iv | auth tag | ciphertext).
 *
 * Rotation: put the new key in TOKEN_ENCRYPTION_KEY and the old one in TOKEN_ENCRYPTION_KEY_PREVIOUS.
 * Reads try both; every write uses the new key, so tokens move over as they refresh.
 */
const PREFIX = "enc:v1:";

export class TokenKeyMissing extends Error {
  constructor() {
    super("TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to the server environment.");
    this.name = "TokenKeyMissing";
  }
}

function parseKey(raw: string | undefined): Buffer | null {
  const v = raw?.trim();
  if (!v) return null;
  const buf = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, "hex") : Buffer.from(v, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters).");
  return buf;
}

function keys(): { current: Buffer | null; previous: Buffer | null } {
  return { current: parseKey(process.env.TOKEN_ENCRYPTION_KEY), previous: parseKey(process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS) };
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptToken(plain: string): string {
  const { current } = keys();
  if (!current) throw new TokenKeyMissing();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", current, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function tryDecrypt(key: Buffer, packed: Buffer): string | null {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Decrypts a stored token. A value stored before encryption existed is returned as is, and re-encrypted on its next write. */
export function decryptToken(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const { current, previous } = keys();
  if (!current && !previous) throw new TokenKeyMissing();
  const packed = Buffer.from(stored.slice(PREFIX.length), "base64");
  for (const k of [current, previous]) {
    if (!k) continue;
    const out = tryDecrypt(k, packed);
    if (out !== null) return out;
  }
  throw new Error("A stored token could not be decrypted with the configured keys. Reconnect the account.");
}
