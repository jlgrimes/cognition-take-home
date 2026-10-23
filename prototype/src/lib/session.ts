import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadUser } from "@/platform/auth";
import type { User } from "@/platform/types";
import { getDb } from "./db";

// MOCK: authentication. A plain cookie holding a user id, set by the "sign in as" page.
// Production: OIDC against Entra ID/Okta (e.g. Auth.js), signed short-lived sessions,
// MFA + Conditional Access enforced by the IdP, SCIM deprovisioning. See docs/MOCKED.md#identity
export const SESSION_COOKIE = "demo_uid";

export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? loadUser(getDb(), id) : null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
