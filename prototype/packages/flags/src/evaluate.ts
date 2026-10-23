import { createHash } from "node:crypto";
import type { DB } from "@internal/platform/types";
import { PolicyError } from "@internal/platform/types";
import { ENVS, type Env, type EnvState } from "./workflow";

export type EvalReason = "disabled" | "targeted" | "in_rollout" | "not_in_rollout";
export interface Evaluation { key: string; env: Env; merchantId: string; enabled: boolean; reason: EvalReason }

/** Stable 0–99 bucket per (flag, merchant), so a merchant stays in or out as the rollout % changes. */
export function bucket(key: string, merchantId: string): number {
  return createHash("sha256").update(`${key}:${merchantId}`).digest().readUInt32BE(0) % 100;
}

/** Off → off. Targeted merchants → on. Otherwise on if the merchant's bucket is below the rollout %. */
export function evaluateFlag(key: string, state: EnvState, merchantId: string): { enabled: boolean; reason: EvalReason } {
  if (!state.enabled) return { enabled: false, reason: "disabled" };
  if (state.targets.includes(merchantId)) return { enabled: true, reason: "targeted" };
  return bucket(key, merchantId) < state.rollout_pct
    ? { enabled: true, reason: "in_rollout" }
    : { enabled: false, reason: "not_in_rollout" };
}

/**
 * What product services would call (via an SDK) to read flags. Read-only and not tied to a user session.
 * MOCK: evaluation reads SQLite on every call and needs no credential. Production: the flag vendor's SDK with
 * per-environment SDK keys, local caching and streaming updates. See docs/MOCKED.md#feature-flags
 */
export function evaluateFlags(db: DB, input: { env: string; merchantId: string; key?: string }): Evaluation[] {
  if (!(ENVS as readonly string[]).includes(input.env)) throw new PolicyError(`env must be one of ${ENVS.join(", ")}`);
  if (!/^acct_[A-Za-z0-9]{4,32}$/.test(input.merchantId)) throw new PolicyError("merchant must be a merchant id (acct_...)");
  const env = input.env as Env;
  const rows = db
    .prepare(`SELECT flag_key, enabled, rollout_pct, targets_json FROM flag_envs WHERE env = ?${input.key ? " AND flag_key = ?" : ""} ORDER BY flag_key`)
    .all(...(input.key ? [env, input.key] : [env])) as { flag_key: string; enabled: number; rollout_pct: number; targets_json: string }[];
  if (input.key && rows.length === 0) throw new PolicyError(`Flag ${input.key} not found`);
  return rows.map((r) => ({
    key: r.flag_key, env, merchantId: input.merchantId,
    ...evaluateFlag(r.flag_key, { enabled: !!r.enabled, rollout_pct: r.rollout_pct, targets: JSON.parse(r.targets_json) as string[] }, input.merchantId),
  }));
}
