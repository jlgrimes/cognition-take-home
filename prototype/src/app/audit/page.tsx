import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { can } from "@/platform/auth";
import { listAudit } from "@/platform/audit";
import { AuditTimeline } from "@/platform/ui/AuditTimeline";
import { APPS } from "@/apps";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const user = await requireUser();
  if (!can(user, "audit.view")) notFound();
  const { app } = await searchParams;
  const rows = listAudit(getDb(), { app, limit: 300 });
  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-gray-600">Append-only (enforced by DB triggers). Includes PII reveals.</p>
      <div className="mt-4 flex gap-3 text-sm">
        <a href="/audit" className={!app ? "font-semibold" : "underline"}>All</a>
        {APPS.map((a) => (
          <a key={a.id} href={`/audit?app=${a.id}`} className={app === a.id ? "font-semibold" : "underline"}>{a.name}</a>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <AuditTimeline rows={rows} showEntity />
      </div>
    </div>
  );
}
