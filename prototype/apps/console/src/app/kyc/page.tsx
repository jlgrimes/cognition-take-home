import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { can } from "@internal/platform/auth";
import { listCases, statusCounts } from "@internal/kyc/data";
import { HIGH_RISK } from "@internal/kyc/workflow";
import { StatusBadge } from "@internal/platform/ui/StatusBadge";
import { when } from "@internal/platform/format";

const FILTERS = ["pending", "in_review", "escalated", "needs_info", "approved", "rejected"];

export default async function KycQueue({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  const user = await requireUser();
  if (!can(user, "kyc.view")) notFound();
  const { status, mine } = await searchParams;
  const db = getDb();
  const rows = listCases(db, user, { status, mine: mine === "1" });
  const counts = statusCounts(db);
  return (
    <div>
      <h1 className="text-2xl font-semibold">KYC review queue</h1>
      <p className="mt-1 text-sm text-gray-600">Identity checks the vendor couldn&apos;t auto-decide. Escalated and high-risk first.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/kyc" className={`rounded-full border px-3 py-1 ${!status && !mine ? "border-gray-900 bg-gray-900 text-white" : "bg-white"}`}>All</Link>
        <Link href="/kyc?mine=1" className={`rounded-full border px-3 py-1 ${mine ? "border-gray-900 bg-gray-900 text-white" : "bg-white"}`}>Assigned to me</Link>
        {FILTERS.map((f) => (
          <Link key={f} href={`/kyc?status=${f}`} className={`rounded-full border px-3 py-1 ${status === f ? "border-gray-900 bg-gray-900 text-white" : "bg-white"}`}>
            {f.replace("_", " ")} <span className="text-gray-400">{counts[f] ?? 0}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr><th className="px-4 py-2">Case</th><th>Applicant</th><th>Why it&apos;s here</th><th>Risk</th><th>Status</th><th>Assignee</th><th>Submitted</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-mono"><Link href={`/kyc/${r.id}`} className="underline">{r.id}</Link></td>
                <td>{r.applicant_name} <span className="text-gray-400">{r.country}</span></td>
                <td className="text-gray-600">{r.review_reason}</td>
                <td className={r.risk_score >= HIGH_RISK ? "font-semibold text-rose-600" : ""}>{r.risk_score}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="text-gray-600">{r.assignee_name ?? "—"}</td>
                <td className="text-gray-500">{when(r.submitted_at)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
