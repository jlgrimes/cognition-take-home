import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { can, loadUser } from "@/platform/auth";
import { listAudit } from "@/platform/audit";
import { availableTransitions } from "@/platform/workflow";
import { getCase } from "@/apps/kyc/data";
import { HIGH_RISK, kycWorkflow, type KycCase } from "@/apps/kyc/workflow";
import { StatusBadge } from "@/platform/ui/StatusBadge";
import { TransitionForm } from "@/platform/ui/TransitionForm";
import { AuditTimeline } from "@/platform/ui/AuditTimeline";
import { Flash } from "@/platform/ui/Flash";
import { kycTransition } from "../actions";

export default async function KycCasePage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ reveal?: string; error?: string; ok?: string }> }) {
  const user = await requireUser();
  if (!can(user, "kyc.view")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const canReveal = can(user, "kyc.pii.reveal");
  const c = getCase(db, user, id, sp.reveal === "1" && canReveal);
  if (!c) notFound();
  const vendor = JSON.parse(c.vendor_result) as {
    vendor: string; idCheck: string; selfieMatch: number; address: string; sanctions: { hit: boolean; list?: string; score?: number };
  };
  const name = (uid: string | null) => (uid ? loadUser(db, uid)?.name ?? uid : "—");
  const field = (label: string, value: React.ReactNode) => (
    <div><dt className="text-xs uppercase text-gray-500">{label}</dt><dd className="font-mono text-sm">{value}</dd></div>
  );

  return (
    <div>
      <Link href="/kyc" className="text-sm text-gray-500 underline">← Queue</Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{c.id}: {c.applicant_name}</h1>
        <StatusBadge status={c.status} />
      </div>
      <p className="mt-1 text-sm text-gray-600">{c.review_reason} · risk <b className={c.risk_score >= HIGH_RISK ? "text-rose-600" : ""}>{c.risk_score}</b></p>
      <div className="mt-4"><Flash error={sp.error} ok={sp.ok} /></div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Applicant</h2>
            {c._masked ? (
              canReveal ? <Link href={`/kyc/${c.id}?reveal=1`} className="text-xs underline">Reveal PII (audited)</Link>
                : <span className="text-xs text-gray-400">PII masked for your role</span>
            ) : <Link href={`/kyc/${c.id}`} className="text-xs text-rose-600 underline">PII visible: hide</Link>}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            {field("Email", c.email)}{field("Date of birth", c.dob)}{field("SSN", c.ssn)}{field("Country", c.country)}
            {field("Document", c.doc_type)}{field("Document number", c.doc_number)}
          </dl>
          <h2 className="mt-6 font-medium">Vendor result <span className="text-xs text-gray-400">({vendor.vendor})</span></h2>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            {field("ID check", vendor.idCheck)}
            {field("Selfie match", vendor.selfieMatch)}
            {field("Address", vendor.address)}
            {field("Watchlist", vendor.sanctions.hit ? `HIT: ${vendor.sanctions.list} (score ${vendor.sanctions.score})` : "clear")}
          </dl>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 text-sm">
            <div><span className="text-gray-500">Assignee:</span> {name(c.assignee_id)}</div>
            <div><span className="text-gray-500">Escalated by:</span> {name(c.escalated_by)}</div>
            <div><span className="text-gray-500">Decided by:</span> {name(c.decided_by)}</div>
          </div>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Actions</h2>
          <TransitionForm action={kycTransition} recordId={c.id} version={c.version}
            transitions={availableTransitions(kycWorkflow, c as unknown as KycCase, user)} />
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-medium">Audit trail</h2>
        <AuditTimeline rows={listAudit(db, { entityType: "kyc_case", entityId: c.id })} />
      </section>
    </div>
  );
}
