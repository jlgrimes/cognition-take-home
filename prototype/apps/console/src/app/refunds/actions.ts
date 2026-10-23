"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb, getPayments } from "@/lib/db";
import { runAndRedirect } from "@/lib/actions";
import { applyTransition } from "@internal/platform/workflow";
import { PolicyError } from "@internal/platform/types";
import { refundWorkflow } from "@internal/refunds/workflow";
import { approveRefund, requestRefund } from "@internal/refunds/service";

export async function refundTransition(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const transitionId = String(fd.get("transition"));
  const expectedVersion = Number(fd.get("version"));
  await runAndRedirect(`/refunds/${id}`, () =>
    transitionId === "approve"
      ? approveRefund(getDb(), getPayments(), user, id, expectedVersion)
      : applyTransition(getDb(), refundWorkflow, { id, transitionId, user, expectedVersion, reason: String(fd.get("reason") ?? "") }),
    transitionId === "approve" ? "Approved and sent to Stripe" : "Done");
}

export async function createRefund(fd: FormData) {
  const user = await requireUser();
  const chargeId = String(fd.get("chargeId"));
  await runAndRedirect(`/refunds/new?charge=${chargeId}`, async () => {
    const dollars = Number(String(fd.get("amount")).replace(/[$,]/g, ""));
    if (!Number.isFinite(dollars)) throw new PolicyError("Enter an amount");
    const r = await requestRefund(getDb(), getPayments(), user, {
      chargeId, amountCents: Math.round(dollars * 100), reasonCode: String(fd.get("reasonCode")), note: String(fd.get("note") ?? ""),
    });
    // Redirect target is decided after success; runAndRedirect handles the error path.
    redirect(`/refunds/${r.id}?ok=${encodeURIComponent(r.status === "pending_approval" ? "Over your limit: sent for approval" : "Refund sent")}`);
  });
}
