import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { can } from "@internal/platform/auth";
import { describeState, listChangeRequests, listFlags } from "@internal/flags/service";
import { ENVS, type EnvState } from "@internal/flags/workflow";
import { StatusBadge } from "@internal/platform/ui/StatusBadge";
import { when } from "@internal/platform/format";

export default async function FlagsPage() {
  const user = await requireUser();
  if (!can(user, "flags.view")) notFound();
  const db = getDb();
  const flags = listFlags(db, user);
  const pending = listChangeRequests(db, user, { status: "pending_approval" });
  const recent = listChangeRequests(db, user);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Feature flags</h1>
      <p className="mt-1 text-sm text-gray-600">
        Engineers change dev and staging directly. Prod changes are proposed with a reason and applied once a different
        flag approver signs off.
      </p>

      {can(user, "flags.approve") && pending.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-medium">Waiting for approval ({pending.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pending.map((c) => (
              <li key={c.id}>
                <Link href={`/flags/changes/${c.id}`} className="font-mono underline">{c.id}</Link>{" "}
                <span className="font-mono">{c.flag_key}</span>: {describeState(JSON.parse(c.previous_json) as EnvState)} →{" "}
                <b>{describeState(JSON.parse(c.proposed_json) as EnvState)}</b>
                <span className="text-gray-500"> · {c.requester_name}, {when(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr><th className="py-2">Flag</th><th>Owner</th>{ENVS.map((e) => <th key={e}>{e}</th>)}</tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.key} className="border-t border-gray-100 align-top">
                <td className="py-2 pr-4">
                  <Link href={`/flags/${f.key}`} className="font-mono underline">{f.key}</Link>
                  <div className="text-xs text-gray-500">{f.description}</div>
                </td>
                <td className="text-gray-600">{f.owner}</td>
                {ENVS.map((e) => (
                  <td key={e} className={`whitespace-nowrap pr-3 ${f.envs[e].enabled ? "text-emerald-700" : "text-gray-400"}`}>
                    {describeState(f.envs[e])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-medium">Prod change requests</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-500">
            <tr><th className="py-2">Request</th><th>Flag</th><th>Change</th><th>Status</th><th>Requested by</th><th>Reviewed by</th><th>Created</th></tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="py-2 font-mono"><Link href={`/flags/changes/${c.id}`} className="underline">{c.id}</Link></td>
                <td className="font-mono">{c.flag_key}</td>
                <td>{c.kind === "rollback" ? "↩ " : ""}{describeState(JSON.parse(c.proposed_json) as EnvState)}</td>
                <td><StatusBadge status={c.status} /></td>
                <td>{c.requester_name}</td>
                <td>{c.reviewer_name ?? "—"}</td>
                <td className="text-gray-500">{when(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
