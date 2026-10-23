import type { AppModule } from "@/platform/types";
import { rng } from "@/platform/connectors/payments";

const NAMES = ["Priya Shah", "Marco Bianchi", "Aisha Bello", "Tomás Herrera", "Yuki Tanaka", "Olga Petrova", "James O'Neil",
  "Fatima Zahra", "Lucas Martin", "Grace Park", "Samuel Adeyemi", "Elena Popescu", "Hassan Ali", "Chloe Dubois",
  "Diego Ramos", "Mei Lin", "Noah Fischer", "Sara Haddad", "Ivan Novak", "Zara Ahmed", "Ethan Wright", "Leila Karimi"];
const REASONS: Array<[string, (r: () => number) => object, number]> = [
  ["Possible sanctions list match", (r) => ({ idCheck: "pass", selfieMatch: 0.93, sanctions: { hit: true, list: "OFAC SDN", score: Math.round(70 + r() * 25) }, address: "pass" }), 78],
  ["Selfie match below threshold", (r) => ({ idCheck: "pass", selfieMatch: +(0.55 + r() * 0.2).toFixed(2), sanctions: { hit: false }, address: "pass" }), 55],
  ["Document image unreadable", () => ({ idCheck: "inconclusive", selfieMatch: 0.88, sanctions: { hit: false }, address: "pass" }), 40],
  ["Address could not be verified", () => ({ idCheck: "pass", selfieMatch: 0.91, sanctions: { hit: false }, address: "fail" }), 35],
  ["PEP (politically exposed person) match", (r) => ({ idCheck: "pass", selfieMatch: 0.95, sanctions: { hit: true, list: "PEP", score: Math.round(60 + r() * 30) }, address: "pass" }), 72],
  ["Document possibly altered", () => ({ idCheck: "fail", selfieMatch: 0.8, sanctions: { hit: false }, address: "pass" }), 85],
];

export const kycModule: AppModule = {
  id: "kyc",
  name: "KYC Review Queue",
  description: "Triage identity checks the vendor couldn't auto-decide. Claim, review, decide, escalate.",
  href: "/kyc",
  navPermission: "kyc.view",
  roles: {
    kyc_analyst: ["kyc.view", "kyc.claim", "kyc.decide"],
    kyc_senior: ["kyc.view", "kyc.decide_escalated", "kyc.pii.reveal"],
    admin: ["kyc.view"],
    auditor: ["kyc.view"],
  },
  migrate(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS kyc_cases (
        id TEXT PRIMARY KEY,
        applicant_name TEXT NOT NULL, email TEXT NOT NULL, dob TEXT NOT NULL, ssn TEXT NOT NULL, country TEXT NOT NULL,
        doc_type TEXT NOT NULL, doc_number TEXT NOT NULL,
        vendor_result TEXT NOT NULL, risk_score INTEGER NOT NULL, review_reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        assignee_id TEXT REFERENCES users(id), escalated_by TEXT REFERENCES users(id), decided_by TEXT REFERENCES users(id),
        submitted_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS kyc_status ON kyc_cases(status);
    `);
  },
  seed(db) {
    const r = rng(7);
    const ins = db.prepare(
      `INSERT INTO kyc_cases (id, applicant_name, email, dob, ssn, country, doc_type, doc_number, vendor_result, risk_score, review_reason, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const now = Date.now();
    NAMES.forEach((name, i) => {
      const [reason, result, baseRisk] = REASONS[Math.floor(r() * REASONS.length)];
      const pad = (n: number, w: number) => String(n).padStart(w, "0");
      ins.run(
        `KYC-${1001 + i}`,
        name,
        name.toLowerCase().replace(/[^a-z]+/g, ".") + "@mail.example",
        `${1960 + Math.floor(r() * 40)}-${pad(1 + Math.floor(r() * 12), 2)}-${pad(1 + Math.floor(r() * 28), 2)}`,
        `${pad(100 + Math.floor(r() * 800), 3)}-${pad(10 + Math.floor(r() * 89), 2)}-${pad(Math.floor(r() * 10000), 4)}`,
        ["US", "US", "US", "GB", "MX", "NG", "DE"][Math.floor(r() * 7)],
        ["Driver's license", "Passport", "State ID"][Math.floor(r() * 3)],
        "D" + Math.floor(1e7 + r() * 9e7),
        JSON.stringify({ vendor: "Persona (mock)", ...result(r) }),
        Math.min(99, Math.max(5, Math.round(baseRisk + (r() - 0.5) * 20))),
        reason,
        new Date(now - Math.floor(r() * 5 * 86400000)).toISOString(),
      );
    });
  },
};
