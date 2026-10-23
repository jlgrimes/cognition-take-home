import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getPayments } from "@/lib/db";
import { can } from "@/platform/auth";
import { masks } from "@/platform/masking";
import { REASON_CODES, refundLimitCents } from "@/apps/refunds/workflow";
import { Flash } from "@/platform/ui/Flash";
import { money, when } from "@/lib/format";
import { createRefund } from "../actions";

export default async function NewRefund({ searchParams }: { searchParams: Promise<{ q?: string; charge?: string; error?: string }> }) {
  const user = await requireUser();
  if (!can(user, "refunds.create")) notFound();
  const { q = "", charge: chargeId, error } = await searchParams;
  const payments = getPayments();
  const results = await payments.searchCharges(q, 15);
  const charge = chargeId ? await payments.getCharge(chargeId) : null;
  const limit = refundLimitCents(user);
  return (
    <div>
      <Link href="/refunds" className="text-sm text-gray-500 underline">← Refunds</Link>
      <h1 className="mt-2 text-2xl font-semibold">New refund</h1>
      <div className="mt-4"><Flash error={error} /></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search by email, name or charge id" className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
            <button className="rounded-md border border-gray-300 px-3 text-sm">Search</button>
          </form>
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {results.map((c) => (
              <li key={c.id}>
                <Link href={`/refunds/new?q=${encodeURIComponent(q)}&charge=${c.id}`}
                  className={`flex justify-between px-2 py-2 hover:bg-gray-50 ${c.id === chargeId ? "bg-gray-100" : ""}`}>
                  <span>{c.customer_name} <span className="text-gray-400">{c.description}</span></span>
                  <span>{money(c.amount_cents)}{c.amount_refunded_cents ? <span className="text-rose-600"> (−{money(c.amount_refunded_cents)})</span> : null}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          {charge ? (
            <>
              <h2 className="font-medium">{charge.customer_name}</h2>
              <p className="text-sm text-gray-600">
                {charge.customer_email} · card {masks.last4(charge.card_last4)} · {when(charge.created_at)}
              </p>
              <p className="mt-2 font-mono text-xs text-gray-500">{charge.id}</p>
              <p className="mt-2 text-sm">Charged {money(charge.amount_cents)}, refundable <b>{money(charge.amount_cents - charge.amount_refunded_cents)}</b></p>
              <form action={createRefund} className="mt-4 space-y-3">
                <input type="hidden" name="chargeId" value={charge.id} />
                <label className="block text-sm">Amount (USD)
                  <input name="amount" defaultValue={((charge.amount_cents - charge.amount_refunded_cents) / 100).toFixed(2)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5" />
                </label>
                <label className="block text-sm">Reason
                  <select name="reasonCode" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5">
                    {REASON_CODES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label className="block text-sm">Note
                  <input name="note" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5" />
                </label>
                <p className="text-xs text-gray-500">Up to {money(limit)} is sent immediately. Above that, it goes to a finance approver.</p>
                <button className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white">Submit refund</button>
              </form>
            </>
          ) : <p className="text-sm text-gray-500">Pick a charge on the left.</p>}
        </section>
      </div>
    </div>
  );
}
