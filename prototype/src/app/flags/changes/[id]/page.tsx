import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { can } from "@/platform/auth";
import { listAudit } from "@/platform/audit";
import { availableTransitions } from "@/platform/workflow";
import { describeState, getChangeRequest } from "@/apps/flags/service";
import { flagChangeWorkflow, type EnvState } from "@/apps/flags/workflow";
import { StatusBadge } from "@/platform/ui/StatusBadge";
import { TransitionForm } from "@/platform/ui/TransitionForm";
import { AuditTimeline } from "@/platform/ui/AuditTimeline";
import { Flash } from "@/platform/ui/Flash";
import { when } from "@/lib/format";
import { changeTransition } from "../../actions";

function StateBox({ title, s }: { title: string; s: EnvState }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-xs uppercase text-gray-500">{title}</div>
      <div className="mt-1 font-medium">{describeState(s)}</div>
      {s.targets.length > 0 && <div className="mt-1 font-mono text-xs text-gray-600">{s.targets.join(", ")}</div>}
    </div>
  );
}

export default async function ChangeRequestPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  if (!can(user, "flags.view")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const cr = getChangeRequest(db, user, id);
  if (!cr) notFound();
  return (
    <div>
      <Link href={`/flags/${cr.flag_key}`} className="text-sm text-gray-500 underline">← {cr.flag_key}</Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{cr.id}: {cr.kind === "rollback" ? `roll back ${cr.rollback_of}` : "prod change"}</h1>
        <StatusBadge status={cr.status} />
      </div>
      <div className="mt-4"><Flash error={sp.error} ok={sp.ok} /></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <StateBox title="Prod when proposed" s={JSON.parse(cr.previous_json) as EnvState} />
            <StateBox title="Proposed" s={JSON.parse(cr.proposed_json) as EnvState} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div><dt className="text-xs uppercase text-gray-500">Flag</dt><dd className="font-mono">{cr.flag_key}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Reason</dt><dd>{cr.reason}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Requested by</dt><dd>{cr.requester_name} · {when(cr.created_at)}</dd></div>
            <div><dt className="text-xs uppercase text-gray-500">Reviewed by</dt><dd>{cr.reviewer_name ?? "—"}{cr.applied_at ? ` · applied ${when(cr.applied_at)}` : ""}</dd></div>
          </dl>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Actions</h2>
          <TransitionForm action={changeTransition} recordId={cr.id} version={cr.version} transitions={availableTransitions(flagChangeWorkflow, cr, user)} />
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-medium">Audit trail</h2>
        <AuditTimeline rows={listAudit(db, { entityType: "flag_change_request", entityId: cr.id })} />
      </section>
    </div>
  );
}
