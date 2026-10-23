import Link from "next/link";
import { requireUser } from "@/lib/session";
import { APPS } from "@/apps";
import { can } from "@/platform/auth";

export default async function Home() {
  const user = await requireUser();
  const apps = APPS.filter((a) => can(user, a.navPermission));
  return (
    <div>
      <h1 className="text-2xl font-semibold">Internal tools</h1>
      <p className="mt-1 text-sm text-gray-600">Apps you have access to, based on your roles.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((a) => (
          <Link key={a.id} href={a.href} className="rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-400">
            <div className="font-medium">{a.name}</div>
            <div className="mt-1 text-sm text-gray-600">{a.description}</div>
          </Link>
        ))}
        {can(user, "audit.view") && (
          <Link href="/audit" className="rounded-xl border border-gray-200 bg-white p-5 hover:border-gray-400">
            <div className="font-medium">Audit log</div>
            <div className="mt-1 text-sm text-gray-600">Every change across every app. Append-only.</div>
          </Link>
        )}
        {!apps.length && <p className="text-sm text-gray-500">You don&apos;t have access to any apps.</p>}
      </div>
    </div>
  );
}
