import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/console" } },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "out/**",
      "build/**",
      "**/next-env.d.ts",
    ],
  },
];

export default eslintConfig;
