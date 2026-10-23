"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession } from "@internal/platform/session";
import { loadUser } from "@internal/platform/auth";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionSecret } from "@/lib/session";

// MOCK: "sign in as" with no credential check. See docs/MOCKED.md#identity
export async function signIn(fd: FormData) {
  const userId = String(fd.get("userId"));
  if (!loadUser(getDb(), userId)) redirect("/login");
  (await cookies()).set(SESSION_COOKIE, signSession(userId, sessionSecret(), SESSION_TTL_MS), {
    httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
