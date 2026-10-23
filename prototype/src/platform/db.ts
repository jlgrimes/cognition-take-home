import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { AppModule, DB } from "./types";
import { DEMO_USERS } from "./demo-users";

const PLATFORM_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_id TEXT NOT NULL,
  app TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS audit_entity ON audit_log(entity_type, entity_id);
CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
`;

const PLATFORM_ROLES: Record<string, string[]> = {
  admin: ["audit.view"],
  auditor: ["audit.view"],
};

export interface SchemaModule {
  migrate(db: DB): void;
  seed(db: DB): void;
  roles?: Record<string, string[]>;
}

export function createDb(file: string, modules: Array<SchemaModule | AppModule>): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(PLATFORM_SCHEMA);
  for (const m of modules) m.migrate(db);

  const grant = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
  db.transaction(() => {
    for (const roles of [PLATFORM_ROLES, ...modules.map((m) => m.roles ?? {})]) {
      for (const [role, perms] of Object.entries(roles)) for (const p of perms) grant.run(role, p);
    }
  })();

  const isFresh = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0;
  if (isFresh) {
    db.transaction(() => {
      const insUser = db.prepare("INSERT INTO users (id, name, email, title) VALUES (?, ?, ?, ?)");
      const insRole = db.prepare("INSERT INTO user_roles (user_id, role) VALUES (?, ?)");
      for (const u of DEMO_USERS) {
        insUser.run(u.id, u.name, u.email, u.title);
        for (const r of u.roles) insRole.run(u.id, r);
      }
      for (const m of modules) m.seed(db);
    })();
  }
  return db;
}
