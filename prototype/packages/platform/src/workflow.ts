import type { DB, User } from "./types";
import { ConflictError, PolicyError } from "./types";
import { can } from "./auth";
import { writeAudit } from "./audit";

export interface WorkflowRecord {
  id: string;
  status: string;
  version: number;
  [key: string]: unknown;
}

export interface TransitionCtx<R> {
  record: R;
  user: User;
  reason: string | null;
}

export interface Transition<R extends WorkflowRecord> {
  id: string;
  label: string;
  from: string[];
  to: string;
  permission: string;
  requiresReason?: boolean;
  tone?: "primary" | "danger" | "neutral";
  /** System-only transitions (e.g. connector callbacks) never appear in the UI. */
  internal?: boolean;
  /** Return a human-readable reason to block the transition, or null to allow. */
  guard?: (ctx: TransitionCtx<R>) => string | null;
  /** Extra columns to write alongside the status change. */
  set?: (ctx: TransitionCtx<R>) => Record<string, unknown>;
}

export interface Workflow<R extends WorkflowRecord> {
  app: string;
  entityType: string;
  /** Trusted, code-defined table name. Must have id, status, version, updated_at. */
  table: string;
  transitions: Transition<R>[];
}

export interface AvailableTransition {
  id: string;
  label: string;
  tone: "primary" | "danger" | "neutral";
  requiresReason: boolean;
  blockedReason: string | null;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

export function availableTransitions<R extends WorkflowRecord>(wf: Workflow<R>, record: R, user: User): AvailableTransition[] {
  return wf.transitions
    .filter((t) => !t.internal && t.from.includes(record.status) && can(user, t.permission))
    .map((t) => ({
      id: t.id,
      label: t.label,
      tone: t.tone ?? "neutral",
      requiresReason: !!t.requiresReason,
      blockedReason: t.guard?.({ record, user, reason: null }) ?? null,
    }));
}

export function applyTransition<R extends WorkflowRecord>(
  db: DB,
  wf: Workflow<R>,
  args: { id: string; transitionId: string; user: User; expectedVersion?: number; reason?: string | null; internal?: boolean },
): R {
  if (!IDENT.test(wf.table)) throw new Error(`invalid table ${wf.table}`);
  const t = wf.transitions.find((x) => x.id === args.transitionId);
  if (!t) throw new PolicyError(`Unknown action "${args.transitionId}"`);
  if (t.internal && !args.internal) throw new PolicyError(`"${t.label}" is a system action`);
  if (!t.internal && !can(args.user, t.permission)) {
    throw new PolicyError(`${args.user.name} lacks permission "${t.permission}"`);
  }
  const reason = args.reason?.trim() || null;
  if (t.requiresReason && !reason) throw new PolicyError(`"${t.label}" requires a reason`);

  return db.transaction(() => {
    const before = db.prepare(`SELECT * FROM ${wf.table} WHERE id = ?`).get(args.id) as R | undefined;
    if (!before) throw new PolicyError(`${wf.entityType} ${args.id} not found`);
    if (args.expectedVersion !== undefined && before.version !== args.expectedVersion) throw new ConflictError();
    if (!t.from.includes(before.status)) {
      throw new ConflictError(`Can't "${t.label}" a ${wf.entityType} that is ${before.status}`);
    }
    const ctx = { record: before, user: args.user, reason };
    const blocked = t.guard?.(ctx);
    if (blocked) throw new PolicyError(blocked);

    const extra = t.set?.(ctx) ?? {};
    for (const k of Object.keys(extra)) if (!IDENT.test(k)) throw new Error(`invalid column ${k}`);
    const cols = ["status", ...Object.keys(extra)];
    const vals = [t.to, ...Object.values(extra)];
    const res = db
      .prepare(
        `UPDATE ${wf.table} SET ${cols.map((c) => `${c} = ?`).join(", ")},
         version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND version = ?`,
      )
      .run(...vals, args.id, before.version);
    if (res.changes !== 1) throw new ConflictError();
    const after = db.prepare(`SELECT * FROM ${wf.table} WHERE id = ?`).get(args.id) as R;

    // Store only changed fields so unrelated PII on the record never lands in the audit log.
    const changed = Object.keys(after).filter(
      (k) => k !== "updated_at" && JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    );
    writeAudit(db, {
      actorId: args.user.id,
      app: wf.app,
      action: `${wf.entityType}.${t.id}`,
      entityType: wf.entityType,
      entityId: args.id,
      reason,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, after[k]])),
    });
    return after;
  })();
}
