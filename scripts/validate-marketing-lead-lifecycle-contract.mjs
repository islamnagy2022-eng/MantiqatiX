import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("web/app.js");
const createFunction = read("supabase/functions/marketing-lead-create/index.ts");
const scopeMigration = read("supabase/migrations/20261010210000_rc452_marketing_crm_tenant_scope.sql");
const contract = read("docs/engineering/CRM_MARKETING_LEAD_LIFECYCLE_CONTRACT.md");

// Browser reads may use RLS, but lifecycle writes must remain server-authoritative.
assert.doesNotMatch(
  app,
  /\.from\(\s*["']marketing_leads["']\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/,
  "browser code must not directly mutate marketing_leads"
);
assert.match(app, /sb\.functions\.invoke\(['"]marketing-lead-create['"]/,
  "lead creation must continue through the protected Edge Function");

// Creation derives ownership from the authenticated JWT and currently uses OPEN as its initial status.
assert.match(createFunction, /requester_user_id:\s*actor\.id/,
  "lead requester identity must be derived from the validated JWT actor");
assert.match(createFunction, /status:\s*["']OPEN["']/,
  "the current lead creation status vocabulary must remain explicit until lifecycle design is approved");
assert.match(createFunction, /\.from\(["']marketing_leads["']\)\s*\.insert\(lead\)/,
  "the protected backend remains the lead creation path");

// CRM manager reads must bind membership to tenant/business scope.
assert.match(scopeMigration, /um\.tenant_id\s*=\s*b\.tenant_id/,
  "CRM manager policy must enforce tenant equality");
assert.match(scopeMigration, /um\.business_id\s+is\s+null\s+or\s+um\.business_id\s*=\s*b\.id/i,
  "CRM manager policy must enforce business scope");
assert.match(scopeMigration, /platform_admin\.tenant_id\s*=\s*'MNTY-PLATFORM'[\s\S]*?permissions\s*->>\s*'full_control'\s*=\s*'true'/,
  "platform-wide access must require explicit platform full-control membership");

// The OPEN vs NEW discrepancy remains a blocker; do not silently normalize legacy values.
assert.match(contract, /writes\s*OPEN[\s\S]*?fixture\s*uses\s*NEW/i,
  "contract must retain the OPEN vs NEW status discrepancy until reconciled");
assert.match(contract, /BLOCKED\s*\/\s*NOT CERTIFIED/,
  "release must remain blocked pending final evidence");

console.log("Marketing lead lifecycle safety contract: PASS (static source guard only)");
