import type { AuditRow } from "@/platform/audit";
import { when } from "@/lib/format";

function Change({ before, after }: { before: string | null; after: string | null }) {
  if (!after) return null;
  const a = JSON.parse(after) as Record<string, unknown>;
  const b = before ? (JSON.parse(before) as Record<string, unknown>) : {};
  const keys = Object.keys(a).filter((k) => k !== "version");
  if (!keys.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 font-mono text-xs text-gray-600">
      {keys.map((k) => (
        <li key={k}>
          {k}: <span className="text-rose-700 line-through">{String(b[k] ?? "∅")}</span> → <span className="text-emerald-700">{String(a[k] ?? "∅")}</span>
        </li>
      ))}
    </ul>
  );
}

export function AuditTimeline({ rows, showEntity = false }: { rows: AuditRow[]; showEntity?: boolean }) {
  if (!rows.length) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <ol className="space-y-3 border-l border-gray-200 pl-4">
      {rows.map((r) => (
        <li key={r.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
          <div className="text-sm">
            <span className="font-medium">{r.actor_name ?? r.actor_id}</span>{" "}
            <span className="font-mono text-xs rounded bg-gray-100 px-1">{r.action}</span>
            {showEntity && <span className="ml-1 text-gray-500">on {r.entity_id}</span>}
            <span className="ml-2 text-xs text-gray-400">{when(r.at)}</span>
          </div>
          {r.reason && <div className="text-sm text-gray-700">“{r.reason}”</div>}
          <Change before={r.before_json} after={r.after_json} />
        </li>
      ))}
    </ol>
  );
}
