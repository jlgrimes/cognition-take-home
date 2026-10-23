import type { DB } from "./types";

export interface AuditEntry {
  actorId: string;
  app: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

export interface AuditRow {
  id: number;
  at: string;
  actor_id: string;
  actor_name: string | null;
  app: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
  before_json: string | null;
  after_json: string | null;
  metadata_json: string | null;
}

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));

export function writeAudit(db: DB, e: AuditEntry): void {
  db.prepare(
    `INSERT INTO audit_log (actor_id, app, action, entity_type, entity_id, reason, before_json, after_json, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(e.actorId, e.app, e.action, e.entityType, e.entityId, e.reason ?? null, json(e.before), json(e.after), json(e.metadata));
}

export function listAudit(
  db: DB,
  filter: { entityType?: string; entityId?: string; app?: string; limit?: number } = {},
): AuditRow[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.entityType) {
    where.push("a.entity_type = ?");
    args.push(filter.entityType);
  }
  if (filter.entityId) {
    where.push("a.entity_id = ?");
    args.push(filter.entityId);
  }
  if (filter.app) {
    where.push("a.app = ?");
    args.push(filter.app);
  }
  const sql = `SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.id DESC LIMIT ?`;
  return db.prepare(sql).all(...args, filter.limit ?? 200) as AuditRow[];
}

/** Field-level diff for display: only keys whose value changed. */
export function diffKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}
