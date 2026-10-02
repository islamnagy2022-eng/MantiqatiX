import { readFileSync } from "node:fs";

const webFiles = [
  "web/app.js",
  "web/home.js",
  "web/operations-modules.js",
  "web/marketing-platform-module.js",
  "web/provider-onboarding-module.js",
  "web/reverse-bidding-module.js",
  "web/restaurant-module.js",
  "web/sector-modules.js",
  "web/smm.js"
];

const forbidden = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/i
];

const marketingLeadDirectInsert = /from\s*\(\s*["']marketing_leads["']\s*\)[\s\S]{0,500}\.insert\s*\(/;

for (const file of webFiles) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      throw new Error(`Public web security violation in ${file}: ${pattern}`);
    }
  }
  if (marketingLeadDirectInsert.test(source)) {
    throw new Error(`Marketing lead direct insert detected in ${file}; use the server-authoritative Edge Function.`);
  }
}

console.log("Marketing/public-web boundary validation passed.");
