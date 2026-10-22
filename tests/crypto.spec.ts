import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { decryptToken, encryptToken, isEncrypted, TokenKeyMissing } from "@/lib/crypto/tokens";

function withKeys(current: string | undefined, previous: string | undefined, fn: () => void) {
  const before = { c: process.env.TOKEN_ENCRYPTION_KEY, p: process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS };
  const set = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
  set("TOKEN_ENCRYPTION_KEY", current);
  set("TOKEN_ENCRYPTION_KEY_PREVIOUS", previous);
  try {
    fn();
  } finally {
    set("TOKEN_ENCRYPTION_KEY", before.c);
    set("TOKEN_ENCRYPTION_KEY_PREVIOUS", before.p);
  }
}

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("hex");

test.describe("stored OAuth tokens", () => {
  test("round trip, and the stored form never contains the token", () => {
    withKeys(k1, undefined, () => {
      const token = "ya29.a0-real-looking-token";
      const stored = encryptToken(token);
      expect(isEncrypted(stored)).toBe(true);
      expect(stored).not.toContain(token);
      expect(decryptToken(stored)).toBe(token);
      expect(encryptToken(token)).not.toBe(stored);
    });
  });

  test("a changed byte is refused rather than decrypted to garbage", () => {
    withKeys(k1, undefined, () => {
      const stored = encryptToken("secret");
      const raw = Buffer.from(stored.slice(7), "base64");
      raw[raw.length - 1] ^= 1;
      expect(() => decryptToken(`enc:v1:${raw.toString("base64")}`)).toThrow(/could not be decrypted/);
    });
  });

  test("rotation: tokens written with the old key still read", () => {
    let stored = "";
    withKeys(k1, undefined, () => {
      stored = encryptToken("old");
    });
    withKeys(k2, k1, () => {
      expect(decryptToken(stored)).toBe("old");
    });
    withKeys(k2, undefined, () => {
      expect(() => decryptToken(stored)).toThrow();
    });
  });

  test("without a key nothing is written in the clear", () => {
    withKeys(undefined, undefined, () => {
      expect(() => encryptToken("x")).toThrow(TokenKeyMissing);
      expect(decryptToken("legacy-plain")).toBe("legacy-plain");
    });
  });
});
