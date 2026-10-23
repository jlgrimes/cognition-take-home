import type { Workflow, WorkflowRecord } from "@/platform/workflow";

export interface KycCase extends WorkflowRecord {
  id: string;
  applicant_name: string;
  email: string;
  dob: string;
  ssn: string;
  country: string;
  doc_type: string;
  doc_number: string;
  vendor_result: string;
  risk_score: number;
  review_reason: string;
  status: "pending" | "in_review" | "needs_info" | "escalated" | "approved" | "rejected";
  assignee_id: string | null;
  escalated_by: string | null;
  decided_by: string | null;
  submitted_at: string;
  version: number;
  updated_at: string;
}

export const HIGH_RISK = 70;

const mustBeAssignee = ({ record, user }: { record: KycCase; user: { id: string } }) =>
  record.assignee_id === user.id ? null : "Only the assigned analyst can act on this case";

export const kycWorkflow: Workflow<KycCase> = {
  app: "kyc",
  entityType: "kyc_case",
  table: "kyc_cases",
  transitions: [
    { id: "claim", label: "Claim", from: ["pending"], to: "in_review", permission: "kyc.claim", tone: "primary",
      set: ({ user }) => ({ assignee_id: user.id }) },
    { id: "release", label: "Release to queue", from: ["in_review"], to: "pending", permission: "kyc.claim",
      guard: mustBeAssignee, set: () => ({ assignee_id: null }) },
    { id: "approve", label: "Approve", from: ["in_review"], to: "approved", permission: "kyc.decide", tone: "primary",
      guard: (ctx) =>
        mustBeAssignee(ctx) ??
        (ctx.record.risk_score >= HIGH_RISK ? `Risk score ≥ ${HIGH_RISK}: must be escalated to a senior reviewer` : null),
      set: ({ user }) => ({ decided_by: user.id }) },
    { id: "reject", label: "Reject", from: ["in_review"], to: "rejected", permission: "kyc.decide", tone: "danger",
      requiresReason: true, guard: mustBeAssignee, set: ({ user }) => ({ decided_by: user.id }) },
    { id: "request_info", label: "Request more info", from: ["in_review"], to: "needs_info", permission: "kyc.decide",
      requiresReason: true, guard: mustBeAssignee },
    { id: "escalate", label: "Escalate", from: ["in_review"], to: "escalated", permission: "kyc.decide",
      requiresReason: true, guard: mustBeAssignee, set: ({ user }) => ({ escalated_by: user.id, assignee_id: null }) },
    { id: "senior_approve", label: "Senior approve", from: ["escalated"], to: "approved", permission: "kyc.decide_escalated",
      tone: "primary", requiresReason: true,
      guard: ({ record, user }) => (record.escalated_by === user.id ? "Four-eyes: you escalated this case, another senior must decide" : null),
      set: ({ user }) => ({ decided_by: user.id }) },
    { id: "senior_reject", label: "Senior reject", from: ["escalated"], to: "rejected", permission: "kyc.decide_escalated",
      tone: "danger", requiresReason: true,
      guard: ({ record, user }) => (record.escalated_by === user.id ? "Four-eyes: you escalated this case, another senior must decide" : null),
      set: ({ user }) => ({ decided_by: user.id }) },
    // MOCK: in production this fires from the KYC vendor webhook when the applicant uploads new documents.
    { id: "resubmitted", label: "Simulate applicant resubmission", from: ["needs_info"], to: "pending", permission: "kyc.claim",
      set: () => ({ assignee_id: null }) },
  ],
};
