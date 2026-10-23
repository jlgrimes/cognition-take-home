// MOCK: user directory. Production: users + group membership come from the IdP
// (Entra ID / Okta) via OIDC claims or SCIM; roles map to IdP groups. See docs/MOCKED.md#identity
export const DEMO_USERS = [
  { id: "u_ana", name: "Ana Ruiz", email: "ana@fintech.example", title: "KYC Analyst", roles: ["kyc_analyst"] },
  { id: "u_ben", name: "Ben Okafor", email: "ben@fintech.example", title: "KYC Analyst", roles: ["kyc_analyst"] },
  { id: "u_cara", name: "Cara Lindqvist", email: "cara@fintech.example", title: "Compliance Lead", roles: ["kyc_analyst", "kyc_senior"] },
  { id: "u_dev", name: "Dev Patel", email: "dev@fintech.example", title: "Support Agent", roles: ["support_agent"] },
  { id: "u_eli", name: "Eli Moreau", email: "eli@fintech.example", title: "Support Agent", roles: ["support_agent"] },
  { id: "u_fay", name: "Fay Chen", email: "fay@fintech.example", title: "Finance Manager", roles: ["finance_manager"] },
  { id: "u_gus", name: "Gus Admin", email: "gus@fintech.example", title: "Platform Admin", roles: ["admin"] },
];
