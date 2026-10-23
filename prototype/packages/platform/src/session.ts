import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed session token: `<userId>.<expiresAtMs>.<signature>`.
 * Stops anyone editing the cookie to become another user. It does not prove who signed in:
 * the "sign in as" page is still a mock (docs/MOCKED.md#identity).
 */
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signSession(userId: string, secret: string, ttlMs: number, now = Date.now()): string {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error("Invalid user id");
  const payload = `${userId}.${now + ttlMs}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id if the token is untampered and unexpired, otherwise null. */
export function verifySession(token: string | undefined, secret: string, now = Date.now()): string | null {
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${userId}.${exp}`, secret));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (!(Number(exp) > now)) return null;
  return userId;
}
