import { createDb } from "@/platform/db";
import { loadUser } from "@/platform/auth";
import { ALL_MODULES } from "@/lib/db";
import { MockStripeConnector } from "@/platform/connectors/payments";

export function freshEnv() {
  const db = createDb(":memory:", ALL_MODULES);
  const as = (id: string) => loadUser(db, id)!;
  return { db, as, payments: new MockStripeConnector(db) };
}
