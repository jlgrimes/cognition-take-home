import type { DB, User } from "./types";
import { PolicyError } from "./types";

export function loadUser(db: DB, id: string): User | null {
  const row = db.prepare("SELECT id, name, email, title FROM users WHERE id = ?").get(id) as
    | Omit<User, "roles" | "permissions">
    | undefined;
  if (!row) return null;
  const roles = (db.prepare("SELECT role FROM user_roles WHERE user_id = ? ORDER BY role").all(id) as { role: string }[]).map(
    (r) => r.role,
  );
  const permissions = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT rp.permission FROM role_permissions rp
           JOIN user_roles ur ON ur.role = rp.role WHERE ur.user_id = ?`,
        )
        .all(id) as { permission: string }[]
    ).map((r) => r.permission),
  );
  return { ...row, roles, permissions };
}

export function listUsers(db: DB): User[] {
  const ids = db.prepare("SELECT id FROM users ORDER BY name").all() as { id: string }[];
  return ids.map((r) => loadUser(db, r.id)!).filter(Boolean);
}

export function can(user: User, permission: string): boolean {
  return user.permissions.has(permission);
}

export function assertCan(user: User, permission: string): void {
  if (!can(user, permission)) throw new PolicyError(`${user.name} lacks permission "${permission}"`);
}
