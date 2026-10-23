import type Database from "better-sqlite3";

export type DB = Database.Database;

export interface User {
  id: string;
  name: string;
  email: string;
  title: string;
  roles: string[];
  permissions: Set<string>;
}

/**
 * Everything an internal app contributes to the platform. Adding an app = one
 * package under packages/<id> exporting one of these, plus a line in apps/console/src/apps.ts.
 */
export interface AppModule {
  id: string;
  name: string;
  description: string;
  href: string;
  /** Permission required to see the app on the home page / nav. */
  navPermission: string;
  /** role -> permissions this app grants. Roles can be shared across apps. */
  roles: Record<string, string[]>;
  migrate(db: DB): void;
  seed(db: DB): void;
}

export class PolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyError";
  }
}

export class ConflictError extends PolicyError {
  constructor(message = "This record was changed by someone else. Reload and try again.") {
    super(message);
    this.name = "ConflictError";
  }
}
