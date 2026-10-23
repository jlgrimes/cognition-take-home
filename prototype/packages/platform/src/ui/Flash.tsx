export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (error)
    return <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800">⛔ {error}</div>;
  if (ok) return <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">✓ {ok}</div>;
  return null;
}
