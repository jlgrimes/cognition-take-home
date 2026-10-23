import path from "node:path";
import { createDb } from "@internal/platform/db";
import type { DB } from "@internal/platform/types";
import { mockStripeSchema, MockStripeConnector, type PaymentsConnector } from "@internal/platform/connectors/payments";
import { APPS } from "@/apps";

const g = globalThis as unknown as { __db?: DB };

export const ALL_MODULES = [mockStripeSchema, ...APPS];

export function getDb(): DB {
  if (!g.__db) g.__db = createDb(process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.db"), ALL_MODULES);
  return g.__db;
}

export function getPayments(): PaymentsConnector {
  return new MockStripeConnector(getDb());
}
