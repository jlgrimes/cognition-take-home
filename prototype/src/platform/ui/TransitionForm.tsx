import type { AvailableTransition } from "@/platform/workflow";

const TONE: Record<string, string> = {
  primary: "bg-gray-900 text-white hover:bg-gray-700",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  neutral: "border border-gray-300 bg-white hover:bg-gray-50",
};

/** Generic action bar for any workflow record. Buttons the user can't use are shown disabled with the reason. */
export function TransitionForm({
  action,
  recordId,
  version,
  transitions,
}: {
  action: (fd: FormData) => Promise<void>;
  recordId: string;
  version: number;
  transitions: AvailableTransition[];
}) {
  if (!transitions.length) return <p className="text-sm text-gray-500">No actions available to you in this state.</p>;
  const needsReason = transitions.some((t) => t.requiresReason && !t.blockedReason);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={recordId} />
      <input type="hidden" name="version" value={version} />
      {needsReason && (
        <textarea name="reason" rows={2} placeholder="Reason / note (required for some actions; saved to the audit log)"
          className="w-full rounded-md border border-gray-300 p-2 text-sm" />
      )}
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button key={t.id} name="transition" value={t.id} disabled={!!t.blockedReason} title={t.blockedReason ?? undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${TONE[t.tone]}`}>
            {t.label}{t.requiresReason ? " *" : ""}
          </button>
        ))}
      </div>
      {transitions.filter((t) => t.blockedReason).map((t) => (
        <p key={t.id} className="text-xs text-gray-500">🔒 {t.label}: {t.blockedReason}</p>
      ))}
    </form>
  );
}
