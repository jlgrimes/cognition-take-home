import type { Workflow, WorkflowRecord } from "@/platform/workflow";

export const ENVS = ["dev", "staging", "prod"] as const;
export type Env = (typeof ENVS)[number];

export interface EnvState {
  enabled: boolean;
  rollout_pct: number;
  targets: string[];
}

export interface FlagChangeRequest extends WorkflowRecord {
  id: string;
  flag_key: string;
  env: "prod";
  kind: "change" | "rollback";
  rollback_of: string | null;
  /** JSON EnvState: prod state when proposed. Also what a rollback of this change restores. */
  previous_json: string;
  /** JSON EnvState to apply. */
  proposed_json: string;
  reason: string;
  status: "pending_approval" | "approved" | "applied" | "rejected";
  requested_by: string;
  reviewed_by: string | null;
  applied_at: string | null;
  created_at: string;
  version: number;
  updated_at: string;
}

export const flagChangeWorkflow: Workflow<FlagChangeRequest> = {
  app: "flags",
  entityType: "flag_change_request",
  table: "flag_change_requests",
  transitions: [
    { id: "approve", label: "Approve & apply to prod", from: ["pending_approval"], to: "approved", permission: "flags.approve",
      tone: "primary",
      guard: ({ record, user }) => (record.requested_by === user.id ? "Maker-checker: you can't approve your own change request" : null),
      set: ({ user }) => ({ reviewed_by: user.id }) },
    { id: "reject", label: "Reject", from: ["pending_approval"], to: "rejected", permission: "flags.approve", tone: "danger",
      requiresReason: true,
      guard: ({ record, user }) => (record.requested_by === user.id ? "Maker-checker: ask another approver to reject your request" : null),
      set: ({ user }) => ({ reviewed_by: user.id }) },
    { id: "mark_applied", label: "Applied to prod", from: ["approved"], to: "applied", permission: "-", internal: true,
      set: () => ({ applied_at: new Date().toISOString() }) },
  ],
};
