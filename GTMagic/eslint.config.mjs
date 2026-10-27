import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "prototype/**", "next-env.d.ts", ".superpowers/**", ".impeccable/**", ".playwright-mcp/**"] },
];

export default config;
