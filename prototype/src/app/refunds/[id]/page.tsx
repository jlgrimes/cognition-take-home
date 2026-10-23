import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb, getPayments } from "@/lib/db";
import { can, loadUser } from "@/platform/auth";
import { listAudit } from "@/platform/audit";
import { availableTransitions } from "@/platform/workflow";
import { getRefund } from "@/apps/refunds/service";
import { refundWorkflow } from "@/apps/refunds/workflow";
import { StatusBadge } from "@/platform/ui/StatusBadge";
import { TransitionForm } from "@/platform/ui/TransitionForm";
import { AuditTimeline } from "@/platform/ui/AuditTimeline";
import { Flash } from "@/platform/ui/Flash";
import { money } from "@/lib/format";
import { refundTransition } from "../actions";

export default async function RefundPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  if (!can(user, "refunds.view")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const r = getRefund(db, id);
  if (!r) notFound();
  const charge = await getPayments().getCharge(r.charge_id);
  const name = (uid: string | null) => (uid ? loadUser(db, uid)?.name ?? uid : "—");
  return (
    <div>
      <Link href="/refunds" className="text-sm text-gray-500 underline">← Refunds</Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{r.id}: {money(r.amount_cents)}</h1>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-4"><Flash error={sp.error} ok={sp.ok} /></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4">
            <div><dt className="text-xs uppercase text-gray-500">Customer</dt><dd>{charge?.customer_name} · {charge?.customer_email}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Charge</dt><dd className="font-mono">{r.charge_id} ({charge && money(charge.amount_cents)})</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Reason</dt><dd>{r.reason_code.replace(/_/g, " ")}{r.note ? `: ${r.note}` : ""}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Stripe refund</dt><dd className="font-mono">{r.stripe_refund_id ?? "—"}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Requested by</dt><dd>{name(r.requested_by)}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Approved by</dt><dd>{name(r.approved_by)}</dd></div>
            {r.error && <div className="col-span-2 text-rose-700">Error: {r.error}</div>}
          </dl>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Actions</h2>
          <TransitionForm action={refundTransition} recordId={r.id} version={r.version} transitions={availableTransitions(refundWorkflow, r, user)} />
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-medium">Audit trail</h2>
        <AuditTimeline rows={listAudit(db, { entityType: "refund_request", entityId: r.id })} />
      </section>
    </div>
  );
}
