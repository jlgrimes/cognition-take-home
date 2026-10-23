import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { can } from "@internal/platform/auth";
import { listAudit } from "@internal/platform/audit";
import { describeState, getFlag, lastApplied, listChangeRequests, type FlagEnv } from "@internal/flags/service";
import { ENVS, type EnvState } from "@internal/flags/workflow";
import { AuditTimeline } from "@internal/platform/ui/AuditTimeline";
import { StatusBadge } from "@internal/platform/ui/StatusBadge";
import { Flash } from "@internal/platform/ui/Flash";
import { when } from "@internal/platform/format";
import { proposeAction, rollbackAction, updateEnvAction } from "../actions";

function StateFields({ s }: { s: FlagEnv }) {
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Enabled
      </label>
      <label className="block text-sm">Rollout %
        <input name="rollout" type="number" min={0} max={100} step={1} defaultValue={s.rollout_pct}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5" />
      </label>
      <label className="block text-sm">Targeted merchant ids (always on when enabled)
        <textarea name="targets" rows={2} defaultValue={s.targets.join("\n")} placeholder="acct_..."
          className="mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-xs" />
      </label>
    </>
  );
}

export default async function FlagPage({
  params, searchParams,
}: { params: Promise<{ key: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  if (!can(user, "flags.view")) notFound();
  const { key } = await params;
  const sp = await searchParams;
  const db = getDb();
  const flag = getFlag(db, user, key);
  if (!flag) notFound();
  const requests = listChangeRequests(db, user, { key });
  const open = requests.find((c) => c.status === "pending_approval");
  const last = lastApplied(db, key);
  const canEdit = can(user, "flags.edit_nonprod");
  const canPropose = can(user, "flags.propose_prod");

  return (
    <div>
      <Link href="/flags" className="text-sm text-gray-500 underline">← Feature flags</Link>
      <h1 className="mt-2 font-mono text-2xl font-semibold">{flag.key}</h1>
      <p className="mt-1 text-sm text-gray-600">{flag.description} <span className="text-gray-400">· owner: {flag.owner}</span></p>
      <div className="mt-4"><Flash error={sp.error} ok={sp.ok} /></div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {ENVS.map((env) => {
          const s = flag.envs[env];
          return (
            <section key={env} className={`rounded-xl border bg-white p-5 ${env === "prod" ? "border-rose-300" : "border-gray-200"}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium uppercase">{env}</h2>
                <span className={s.enabled ? "text-sm text-emerald-700" : "text-sm text-gray-400"}>{describeState(s)}</span>
              </div>
              <p className="text-xs text-gray-400">v{s.version} · updated {when(s.updated_at)}</p>

              {env !== "prod" && canEdit && (
                <form action={updateEnvAction} className="mt-4 space-y-3">
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="env" value={env} />
                  <input type="hidden" name="version" value={s.version} />
                  <StateFields s={s} />
                  <button className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">Save {env}</button>
                </form>
              )}

              {env === "prod" && open && (
                <p className="mt-4 text-sm">
                  <Link href={`/flags/changes/${open.id}`} className="font-mono underline">{open.id}</Link> is waiting for approval:{" "}
                  <b>{describeState(JSON.parse(open.proposed_json) as EnvState)}</b>
                </p>
              )}
              {env === "prod" && !open && canPropose && (
                <>
                  <form action={proposeAction} className="mt-4 space-y-3">
                    <input type="hidden" name="key" value={key} />
                    <StateFields s={s} />
                    <textarea name="reason" rows={2} required placeholder="Why? (required, goes to the approver and the audit log)"
                      className="w-full rounded-md border border-gray-300 p-2 text-sm" />
                    <button className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">Propose prod change</button>
                  </form>
                  {last && (
                    <form action={rollbackAction} className="mt-4 border-t border-gray-100 pt-4">
                      <input type="hidden" name="key" value={key} />
                      <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">
                        ↩ Roll back {last.id} (to {describeState(JSON.parse(last.previous_json) as EnvState)})
                      </button>
                      <p className="mt-1 text-xs text-gray-500">Creates a change request; a flag approver still has to approve it.</p>
                    </form>
                  )}
                </>
              )}
              {env === "prod" && !open && !canPropose && (
                <p className="mt-4 text-xs text-gray-500">Only engineers can propose prod changes.</p>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Prod change requests</h2>
          {requests.length ? (
            <ul className="space-y-2 text-sm">
              {requests.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <Link href={`/flags/changes/${c.id}`} className="font-mono underline">{c.id}</Link>
                  <StatusBadge status={c.status} />
                  <span>{c.kind === "rollback" ? "↩ " : ""}{describeState(JSON.parse(c.proposed_json) as EnvState)}</span>
                  <span className="text-gray-500">· {c.requester_name}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">None yet.</p>}
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-medium">Audit trail</h2>
          <AuditTimeline rows={listAudit(db, { entityType: "flag", entityId: key })} />
        </section>
      </div>
    </div>
  );
}
