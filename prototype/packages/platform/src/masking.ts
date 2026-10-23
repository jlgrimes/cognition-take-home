import type { DB, User } from "./types";
import { can } from "./auth";
import { writeAudit } from "./audit";
import { PolicyError } from "./types";

export type MaskFn = (value: string) => string;

export const masks = {
  ssn: (v: string) => "•••-••-" + v.slice(-4),
  last4: (v: string) => "•••• " + v.slice(-4),
  email: (v: string) => {
    const [local, domain] = v.split("@");
    return `${local.slice(0, 1)}•••@${domain ?? ""}`;
  },
  year: (v: string) => v.slice(0, 4) + "-••-••",
  full: () => "••••••",
} satisfies Record<string, MaskFn>;

export type MaskRules<T> = Partial<Record<keyof T, MaskFn>>;

/**
 * Masks sensitive fields server-side, before data reaches any component.
 * Unmasking requires `revealPermission` and is itself an audited event.
 */
export function applyMasking<T extends Record<string, unknown>>(
  db: DB,
  opts: {
    record: T;
    rules: MaskRules<T>;
    user: User;
    reveal: boolean;
    revealPermission: string;
    audit: { app: string; entityType: string; entityId: string };
  },
): T & { _masked: boolean } {
  const { record, rules, user, reveal, revealPermission, audit } = opts;
  if (reveal) {
    if (!can(user, revealPermission)) throw new PolicyError(`${user.name} may not reveal sensitive fields`);
    writeAudit(db, {
      actorId: user.id,
      ...audit,
      action: "pii.reveal",
      metadata: { fields: Object.keys(rules) },
    });
    return { ...record, _masked: false };
  }
  const out: Record<string, unknown> = { ...record };
  for (const [k, fn] of Object.entries(rules) as [string, MaskFn][]) {
    if (typeof out[k] === "string" && out[k]) out[k] = fn(out[k] as string);
  }
  return { ...(out as T), _masked: true };
}
