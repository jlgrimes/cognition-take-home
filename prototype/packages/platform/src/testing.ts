import { createDb } from "./db";
import { loadUser } from "./auth";
import { MockStripeConnector } from "./connectors/payments";
import type { AppModule } from "./types";
import type { SchemaModule } from "./db";

/** In-memory DB seeded with the demo users plus the given modules. */
export function createTestEnv(modules: Array<SchemaModule | AppModule>) {
  const db = createDb(":memory:", modules);
  return {
    db,
    as: (id: string) => loadUser(db, id)!,
    get payments() {
      return new MockStripeConnector(db);
    },
  };
}
