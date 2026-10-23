"use server";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { runAndRedirect } from "@/lib/actions";
import { applyTransition } from "@/platform/workflow";
import { kycWorkflow } from "@/apps/kyc/workflow";

export async function kycTransition(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const transitionId = String(fd.get("transition"));
  await runAndRedirect(`/kyc/${id}`, () =>
    applyTransition(getDb(), kycWorkflow, {
      id, transitionId, user, expectedVersion: Number(fd.get("version")), reason: String(fd.get("reason") ?? ""),
    }), `Done: ${transitionId.replace(/_/g, " ")}`);
}
