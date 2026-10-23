import type { DB, User } from "@/platform/types";
import { assertCan } from "@/platform/auth";
import { applyMasking, masks, type MaskRules } from "@/platform/masking";
import type { KycCase } from "./workflow";

export const kycMaskRules: MaskRules<KycCase> = {
  ssn: masks.ssn,
  dob: masks.year,
  doc_number: masks.last4,
  email: masks.email,
};

export type KycListRow = Pick<KycCase, "id" | "applicant_name" | "country" | "risk_score" | "review_reason" | "status" | "submitted_at"> & {
  assignee_name: string | null;
};

export function listCases(db: DB, user: User, filter: { status?: string; mine?: boolean }): KycListRow[] {
  assertCan(user, "kyc.view");
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter.status) {
    where.push("c.status = ?");
    args.push(filter.status);
  }
  if (filter.mine) {
    where.push("c.assignee_id = ?");
    args.push(user.id);
  }
  return db
    .prepare(
      `SELECT c.id, c.applicant_name, c.country, c.risk_score, c.review_reason, c.status, c.submitted_at, u.name AS assignee_name
       FROM kyc_cases c LEFT JOIN users u ON u.id = c.assignee_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY CASE c.status WHEN 'escalated' THEN 0 WHEN 'pending' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END,
                c.risk_score DESC, c.submitted_at`,
    )
    .all(...args) as KycListRow[];
}

export function statusCounts(db: DB): Record<string, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM kyc_cases GROUP BY status").all() as { status: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export function getCase(db: DB, user: User, id: string, reveal = false) {
  assertCan(user, "kyc.view");
  const raw = db.prepare("SELECT * FROM kyc_cases WHERE id = ?").get(id) as KycCase | undefined;
  if (!raw) return null;
  return applyMasking(db, {
    record: raw,
    rules: kycMaskRules,
    user,
    reveal,
    revealPermission: "kyc.pii.reveal",
    audit: { app: "kyc", entityType: "kyc_case", entityId: id },
  });
}
