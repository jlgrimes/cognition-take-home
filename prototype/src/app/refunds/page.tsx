import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb, getPayments } from "@/lib/db";
import { can } from "@/platform/auth";
import { listRefundRequests } from "@/apps/refunds/service";
import { refundLimitCents } from "@/apps/refunds/workflow";
import { StatusBadge } from "@/platform/ui/StatusBadge";
import { money, when } from "@/lib/format";

export default async function RefundsDashboard() {
  const user = await requireUser();
  if (!can(user, "refunds.view")) notFound();
  const db = getDb();
  const days = 14;
  const since = new Date(Date.now() - days * 86400000);
  since.setUTCHours(0, 0, 0, 0);
  const refunds = await getPayments().listRefunds(since.toISOString());
  const byDay = new Map<string, number>();
  for (let i = 0; i <= days; i++) byDay.set(new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10), 0);
  for (const r of refunds) {
    const d = r.created_at.slice(0, 10);
    if (byDay.has(d)) byDay.set(d, byDay.get(d)! + r.amount_cents);
  }
  const max = Math.max(1, ...byDay.values());
  const total = refunds.reduce((s, r) => s + r.amount_cents, 0);
  const pending = listRefundRequests(db, user, "pending_approval");
  const recent = listRefundRequests(db, user);
  const reasons = Object.entries(refunds.reduce<Record<string, number>>((m, r) => ((m[r.reason] = (m[r.reason] ?? 0) + 1), m), {}));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Refunds</h1>
          <p className="mt-1 text-sm text-gray-600">
            Your single-refund limit: <b>{money(refundLimitCents(user))}</b>. Larger refunds need a second approver.
          </p>
        </div>
        {can(user, "refunds.create") && (
          <Link href="/refunds/new" className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">New refund</Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label={`Refunded, last ${days} days`} value={money(total)} />
        <Stat label="Refunds issued" value={String(refunds.length)} />
        <Stat label="Awaiting approval" value={String(pending.length)} />
      </div>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-medium">Refund volume by day</h2>
        <div className="mt-4 flex h-40 items-end gap-1">
          {[...byDay.entries()].map(([d, v]) => (
            <div key={d} className="group flex flex-1 flex-col items-center justify-end" title={`${d}: ${money(v)}`}>
              <div className="w-full rounded-t bg-gray-800 group-hover:bg-emerald-600" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0 }} />
              <div className="mt-1 text-[10px] text-gray-400">{d.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-gray-600">
          {reasons.map(([k, n]) => <span key={k}>{k.replace(/_/g, " ")}: <b>{n}</b></span>)}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-medium">Requests</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr><th className="py-2">Request</th><th>Customer</th><th>Amount</th><th>Reason</th><th>Status</th><th>Requested by</th><th>Approved by</th><th>Created</th></tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="py-2 font-mono"><Link href={`/refunds/${r.id}`} className="underline">{r.id}</Link></td>
                <td className="text-gray-600">{r.customer_email}</td>
                <td>{money(r.amount_cents)}</td>
                <td className="text-gray-600">{r.reason_code.replace(/_/g, " ")}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.requester_name}</td>
                <td>{r.approver_name ?? "—"}</td>
                <td className="text-gray-500">{when(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
