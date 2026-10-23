import type { User } from "@/platform/types";
import type { Workflow, WorkflowRecord } from "@/platform/workflow";

export interface RefundRequest extends WorkflowRecord {
  id: string;
  charge_id: string;
  amount_cents: number;
  reason_code: string;
  note: string | null;
  status: "pending_approval" | "approved" | "succeeded" | "failed" | "rejected";
  requested_by: string;
  approved_by: string | null;
  stripe_refund_id: string | null;
  error: string | null;
  created_at: string;
  version: number;
  updated_at: string;
}

export const REASON_CODES = ["duplicate", "fraudulent", "requested_by_customer", "service_not_provided"] as const;

/** Per-role single-refund authority, in cents. Highest role wins. */
export const ROLE_LIMITS_CENTS: Record<string, number> = {
  support_agent: 100_00,
  finance_manager: 5_000_00,
};

export function refundLimitCents(user: User): number {
  return Math.max(0, ...user.roles.map((r) => ROLE_LIMITS_CENTS[r] ?? 0));
}

export const refundWorkflow: Workflow<RefundRequest> = {
  app: "refunds",
  entityType: "refund_request",
  table: "refund_requests",
  transitions: [
    { id: "approve", label: "Approve & send refund", from: ["pending_approval"], to: "approved", permission: "refunds.approve",
      tone: "primary",
      guard: ({ record, user }) =>
        record.requested_by === user.id
          ? "Maker-checker: you can't approve your own refund request"
          : record.amount_cents > refundLimitCents(user)
            ? "Amount exceeds your approval limit"
            : null,
      set: ({ user }) => ({ approved_by: user.id }) },
    { id: "reject", label: "Reject", from: ["pending_approval"], to: "rejected", permission: "refunds.approve", tone: "danger",
      requiresReason: true, guard: ({ record, user }) => (record.requested_by === user.id ? "Withdraw is not supported; ask an approver to reject" : null) },
    { id: "mark_succeeded", label: "Refund succeeded", from: ["approved"], to: "succeeded", permission: "-", internal: true },
    { id: "mark_failed", label: "Refund failed", from: ["approved"], to: "failed", permission: "-", internal: true },
  ],
};
