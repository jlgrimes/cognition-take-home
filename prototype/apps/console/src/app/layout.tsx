import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/session";
import { APPS } from "@/apps";
import { can } from "@internal/platform/auth";
import { signOut } from "./login/actions";

export const metadata: Metadata = { title: "Internal Tools (Devin prototype)" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <div className="bg-amber-300 px-4 py-1 text-center text-xs font-medium text-amber-950">
          PROTOTYPE: auth, user directory and Stripe are mocked. See docs/MOCKED.md for what production needs.
        </div>
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-semibold">⚙️ Internal Tools</Link>
            {user && (
              <nav className="flex gap-4 text-sm">
                {APPS.filter((a) => can(user, a.navPermission)).map((a) => (
                  <Link key={a.id} href={a.href} className="text-gray-600 hover:text-gray-900">{a.name}</Link>
                ))}
                {can(user, "audit.view") && <Link href="/audit" className="text-gray-600 hover:text-gray-900">Audit log</Link>}
              </nav>
            )}
            <div className="ml-auto flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <span>
                    <span className="font-medium">{user.name}</span>{" "}
                    <span className="text-gray-500">({user.roles.join(", ")})</span>
                  </span>
                  <form action={signOut}><button className="text-gray-500 underline hover:text-gray-900">Switch user</button></form>
                </>
              ) : (
                <Link href="/login" className="underline">Sign in</Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
