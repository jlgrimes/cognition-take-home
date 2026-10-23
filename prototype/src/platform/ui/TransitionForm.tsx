import type { AvailableTransition } from "@/platform/workflow";

const TONE: Record<string, string> = {
  primary: "bg-gray-900 text-white hover:bg-gray-700",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  neutral: "border border-gray-300 bg-white hover:bg-gray-50",
};

/**
 * Generic action bar for any workflow record. Buttons the user can't use are shown disabled with the reason.
 * One form per transition with a hidden `transition` input: React's server-action submit drops the clicked
 * button's name/value, so a shared form with `<button name="transition">` posts transition=null.
 */
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
  return (
    <div className="space-y-3">
      {transitions.map((t) => (
        <form key={t.id} action={action} className="space-y-2">
          <input type="hidden" name="id" value={recordId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="transition" value={t.id} />
          {t.requiresReason && !t.blockedReason && (
            <textarea name="reason" rows={2} required placeholder={`Reason for "${t.label}" (saved to the audit log)`}
              className="w-full rounded-md border border-gray-300 p-2 text-sm" />
          )}
          <button disabled={!!t.blockedReason} title={t.blockedReason ?? undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${TONE[t.tone]}`}>
            {t.label}{t.requiresReason ? " *" : ""}
          </button>
        </form>
      ))}
      {transitions.filter((t) => t.blockedReason).map((t) => (
        <p key={t.id} className="text-xs text-gray-500">🔒 {t.label}: {t.blockedReason}</p>
      ))}
    </div>
  );
}
