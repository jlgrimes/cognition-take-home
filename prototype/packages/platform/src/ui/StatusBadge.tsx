const TONES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  pending_approval: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  needs_info: "bg-purple-100 text-purple-800",
  escalated: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  succeeded: "bg-emerald-100 text-emerald-800",
  applied: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  failed: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONES[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
