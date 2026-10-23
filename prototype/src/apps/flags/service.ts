import type { DB, User } from "@/platform/types";
import { ConflictError, PolicyError } from "@/platform/types";
import { assertCan } from "@/platform/auth";
import { writeAudit } from "@/platform/audit";
import { applyTransition } from "@/platform/workflow";
import { ENVS, flagChangeWorkflow, type Env, type EnvState, type FlagChangeRequest } from "./workflow";

export interface Flag {
  key: string;
  description: string;
  owner: string;
  created_at: string;
  version: number;
  updated_at: string;
}

interface EnvRow {
  id: string;
  flag_key: string;
  env: Env;
  enabled: number;
  rollout_pct: number;
  targets_json: string;
  version: number;
  updated_at: string;
}

export type FlagEnv = EnvState & { env: Env; version: number; updated_at: string };
export type FlagWithEnvs = Flag & { envs: Record<Env, FlagEnv> };

const toState = (r: EnvRow): FlagEnv => ({
  env: r.env, enabled: !!r.enabled, rollout_pct: r.rollout_pct, targets: JSON.parse(r.targets_json) as string[],
  version: r.version, updated_at: r.updated_at,
});
const pickState = (s: EnvState): EnvState => ({ enabled: s.enabled, rollout_pct: s.rollout_pct, targets: s.targets });
const sameState = (a: EnvState, b: EnvState) => JSON.stringify(pickState(a)) === JSON.stringify(pickState(b));

/** Validates and normalises user input. Throws PolicyError with a message the UI can show. */
export function parseState(input: { enabled: boolean; rolloutPct: number; targets: string[] | string }): EnvState {
  const pct = Number(input.rolloutPct);
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw new PolicyError("Rollout must be a whole number from 0 to 100");
  const raw = Array.isArray(input.targets) ? input.targets : input.targets.split(/[\s,]+/);
  const targets = [...new Set(raw.map((t) => t.trim()).filter(Boolean))];
  const bad = targets.find((t) => !/^acct_[A-Za-z0-9]{4,32}$/.test(t));
  if (bad) throw new PolicyError(`"${bad}" is not a merchant id (expected acct_...)`);
  if (targets.length > 50) throw new PolicyError("At most 50 targeted merchants; use rollout % for more");
  return { enabled: !!input.enabled, rollout_pct: pct, targets };
}

function loadEnv(db: DB, key: string, env: Env): FlagEnv {
  const row = db.prepare("SELECT * FROM flag_envs WHERE flag_key = ? AND env = ?").get(key, env) as EnvRow | undefined;
  if (!row) throw new PolicyError(`Flag ${key} not found`);
  return toState(row);
}

/** Writes an env state and its audit entry. Caller must be inside a DB transaction. */
function writeEnv(db: DB, actor: User, key: string, env: Env, next: EnvState, expectedVersion: number | undefined, meta?: object, reason?: string) {
  const before = loadEnv(db, key, env);
  if (expectedVersion !== undefined && before.version !== expectedVersion) throw new ConflictError();
  const res = db
    .prepare(
      `UPDATE flag_envs SET enabled = ?, rollout_pct = ?, targets_json = ?, version = version + 1,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE flag_key = ? AND env = ? AND version = ?`,
    )
    .run(next.enabled ? 1 : 0, next.rollout_pct, JSON.stringify(next.targets), key, env, before.version);
  if (res.changes !== 1) throw new ConflictError();
  const b = pickState(before);
  writeAudit(db, {
    actorId: actor.id, app: "flags", action: `flag.update_${env}`, entityType: "flag", entityId: key, reason,
    before: { [`${env}.enabled`]: b.enabled, [`${env}.rollout_pct`]: b.rollout_pct, [`${env}.targets`]: b.targets },
    after: { [`${env}.enabled`]: next.enabled, [`${env}.rollout_pct`]: next.rollout_pct, [`${env}.targets`]: next.targets },
    metadata: meta,
  });
}

export function listFlags(db: DB, user: User): FlagWithEnvs[] {
  assertCan(user, "flags.view");
  const flags = db.prepare("SELECT * FROM flags ORDER BY key").all() as Flag[];
  const envs = db.prepare("SELECT * FROM flag_envs").all() as EnvRow[];
  return flags.map((f) => ({
    ...f,
    envs: Object.fromEntries(envs.filter((e) => e.flag_key === f.key).map((e) => [e.env, toState(e)])) as Record<Env, FlagEnv>,
  }));
}

export function getFlag(db: DB, user: User, key: string): FlagWithEnvs | null {
  return listFlags(db, user).find((f) => f.key === key) ?? null;
}

/** dev/staging: applied immediately by any engineer, audited with before/after. */
export function updateNonProd(
  db: DB, user: User, input: { key: string; env: Env; state: EnvState; expectedVersion?: number },
): FlagEnv {
  assertCan(user, "flags.edit_nonprod");
  if (!(ENVS as readonly string[]).includes(input.env)) throw new PolicyError("Unknown environment");
  if (input.env === "prod") throw new PolicyError("Prod changes need a change request and a second approver");
  db.transaction(() => writeEnv(db, user, input.key, input.env, input.state, input.expectedVersion))();
  return loadEnv(db, input.key, input.env);
}

function nextId(db: DB): string {
  const row = db.prepare("SELECT COUNT(*) AS n FROM flag_change_requests").get() as { n: number };
  return `FC-${1001 + row.n}`;
}

function pendingFor(db: DB, key: string): string | null {
  const row = db.prepare("SELECT id FROM flag_change_requests WHERE flag_key = ? AND status IN ('pending_approval','approved')").get(key) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

function insertRequest(
  db: DB, user: User, key: string, proposed: EnvState, reason: string, kind: FlagChangeRequest["kind"], rollbackOf: string | null,
): FlagChangeRequest {
  const id = db.transaction(() => {
    const current = loadEnv(db, key, "prod");
    const pending = pendingFor(db, key);
    if (pending) throw new PolicyError(`${pending} is already waiting for approval on this flag; approve or reject it first`);
    if (sameState(current, proposed)) throw new PolicyError("That's already the prod state; nothing to change");
    const id = nextId(db);
    db.prepare(
      `INSERT INTO flag_change_requests (id, flag_key, kind, rollback_of, previous_json, proposed_json, reason, status, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)`,
    ).run(id, key, kind, rollbackOf, JSON.stringify(pickState(current)), JSON.stringify(proposed), reason, user.id);
    writeAudit(db, {
      actorId: user.id, app: "flags", action: `flag_change_request.${kind === "rollback" ? "propose_rollback" : "propose"}`,
      entityType: "flag_change_request", entityId: id, reason,
      before: pickState(current), after: proposed, metadata: { flag: key, rollbackOf },
    });
    return id;
  })();
  return getChangeRequest(db, user, id)!;
}

/** prod: an engineer proposes; nothing changes until a different flag_approver approves. */
export function proposeProdChange(db: DB, user: User, input: { key: string; state: EnvState; reason: string }): FlagChangeRequest {
  assertCan(user, "flags.propose_prod");
  const reason = input.reason?.trim();
  if (!reason) throw new PolicyError("A reason is required for prod changes");
  return insertRequest(db, user, input.key, input.state, reason, "change", null);
}

/** Proposes restoring prod to what it was before the last applied change. Still needs approval. */
export function proposeRollback(db: DB, user: User, input: { key: string; reason?: string }): FlagChangeRequest {
  assertCan(user, "flags.propose_prod");
  const last = lastApplied(db, input.key);
  if (!last) throw new PolicyError("No applied prod change to roll back");
  const reason = input.reason?.trim() || `Roll back ${last.id}`;
  return insertRequest(db, user, input.key, JSON.parse(last.previous_json) as EnvState, reason, "rollback", last.id);
}

/** Approve and apply atomically: the request can't end up approved with prod unchanged. */
export function approveChange(db: DB, user: User, id: string, expectedVersion?: number): FlagChangeRequest {
  return db.transaction(() => {
    const cr = applyTransition(db, flagChangeWorkflow, { id, transitionId: "approve", user, expectedVersion });
    const current = loadEnv(db, cr.flag_key, "prod");
    if (!sameState(current, JSON.parse(cr.previous_json) as EnvState)) {
      throw new ConflictError("Prod changed since this was proposed. Reject it and propose again.");
    }
    writeEnv(db, user, cr.flag_key, "prod", JSON.parse(cr.proposed_json) as EnvState, current.version,
      { changeRequest: cr.id, requestedBy: cr.requested_by, kind: cr.kind }, cr.reason);
    return applyTransition(db, flagChangeWorkflow, { id, transitionId: "mark_applied", user, internal: true });
  })();
}

export function lastApplied(db: DB, key: string): FlagChangeRequest | null {
  return (db
    .prepare("SELECT * FROM flag_change_requests WHERE flag_key = ? AND status = 'applied' ORDER BY applied_at DESC, id DESC LIMIT 1")
    .get(key) as FlagChangeRequest) ?? null;
}

export type ChangeRequestRow = FlagChangeRequest & { requester_name: string; reviewer_name: string | null };

export function getChangeRequest(db: DB, user: User, id: string): ChangeRequestRow | null {
  assertCan(user, "flags.view");
  return (db
    .prepare(
      `SELECT c.*, ru.name AS requester_name, vu.name AS reviewer_name FROM flag_change_requests c
       JOIN users ru ON ru.id = c.requested_by LEFT JOIN users vu ON vu.id = c.reviewed_by WHERE c.id = ?`,
    )
    .get(id) as ChangeRequestRow) ?? null;
}

export function listChangeRequests(db: DB, user: User, filter: { key?: string; status?: string } = {}): ChangeRequestRow[] {
  assertCan(user, "flags.view");
  const where: string[] = [];
  const args: string[] = [];
  if (filter.key) {
    where.push("c.flag_key = ?");
    args.push(filter.key);
  }
  if (filter.status) {
    where.push("c.status = ?");
    args.push(filter.status);
  }
  return db
    .prepare(
      `SELECT c.*, ru.name AS requester_name, vu.name AS reviewer_name FROM flag_change_requests c
       JOIN users ru ON ru.id = c.requested_by LEFT JOIN users vu ON vu.id = c.reviewed_by
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.created_at DESC, c.id DESC LIMIT 50`,
    )
    .all(...args) as ChangeRequestRow[];
}

export const describeState = (s: EnvState) =>
  !s.enabled ? "off" : `on · ${s.rollout_pct}%${s.targets.length ? ` + ${s.targets.length} merchant${s.targets.length > 1 ? "s" : ""}` : ""}`;
