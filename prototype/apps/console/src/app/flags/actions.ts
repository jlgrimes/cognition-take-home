"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { runAndRedirect } from "@/lib/actions";
import { applyTransition } from "@internal/platform/workflow";
import { flagChangeWorkflow, type Env } from "@internal/flags/workflow";
import { approveChange, parseState, proposeProdChange, proposeRollback, updateNonProd } from "@internal/flags/service";

const stateFrom = (fd: FormData) =>
  parseState({ enabled: fd.get("enabled") === "on", rolloutPct: Number(fd.get("rollout")), targets: String(fd.get("targets") ?? "") });

export async function updateEnvAction(fd: FormData) {
  const user = await requireUser();
  const key = String(fd.get("key"));
  const env = String(fd.get("env")) as Env;
  await runAndRedirect(`/flags/${key}`, () =>
    updateNonProd(getDb(), user, { key, env, state: stateFrom(fd), expectedVersion: Number(fd.get("version")) }), `Updated ${env}`);
}

export async function proposeAction(fd: FormData) {
  const user = await requireUser();
  const key = String(fd.get("key"));
  await runAndRedirect(`/flags/${key}`, () => {
    const cr = proposeProdChange(getDb(), user, { key, state: stateFrom(fd), reason: String(fd.get("reason") ?? "") });
    redirect(`/flags/changes/${cr.id}?ok=${encodeURIComponent("Sent for approval")}`);
  });
}

export async function rollbackAction(fd: FormData) {
  const user = await requireUser();
  const key = String(fd.get("key"));
  await runAndRedirect(`/flags/${key}`, () => {
    const cr = proposeRollback(getDb(), user, { key, reason: String(fd.get("reason") ?? "") });
    redirect(`/flags/changes/${cr.id}?ok=${encodeURIComponent("Rollback sent for approval")}`);
  });
}

export async function changeTransition(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const transitionId = String(fd.get("transition"));
  const expectedVersion = Number(fd.get("version"));
  await runAndRedirect(`/flags/changes/${id}`, () =>
    transitionId === "approve"
      ? approveChange(getDb(), user, id, expectedVersion)
      : applyTransition(getDb(), flagChangeWorkflow, { id, transitionId, user, expectedVersion, reason: String(fd.get("reason") ?? "") }),
    transitionId === "approve" ? "Approved and applied to prod" : "Done");
}
