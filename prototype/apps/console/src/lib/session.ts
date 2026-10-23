import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadUser } from "@internal/platform/auth";
import { verifySession } from "@internal/platform/session";
import type { User } from "@internal/platform/types";
import { getDb } from "./db";

// Sessions are HMAC-signed and expire, so the cookie can't be edited to become someone else.
// MOCK: authentication. Who you are is still chosen on the "sign in as" page with no credential.
// Production: OIDC against Entra ID/Okta (e.g. Auth.js), MFA + Conditional Access enforced by the IdP,
// session revocation, SCIM deprovisioning. See docs/MOCKED.md#identity
export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// MOCK: secrets. Without SESSION_SECRET a random per-process secret is used (sessions end on restart).
// Production: from a secrets manager, rotated. See docs/MOCKED.md row 13.
const g = globalThis as { __sessionSecret?: string };
export const sessionSecret = () => (g.__sessionSecret ??= process.env.SESSION_SECRET || randomBytes(32).toString("hex"));

export async function currentUser(): Promise<User | null> {
  const id = verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
  return id ? loadUser(getDb(), id) : null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
