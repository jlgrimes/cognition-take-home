"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";

// MOCK: "sign in as" with no credential check. See docs/MOCKED.md#identity
export async function signIn(fd: FormData) {
  (await cookies()).set(SESSION_COOKIE, String(fd.get("userId")), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
