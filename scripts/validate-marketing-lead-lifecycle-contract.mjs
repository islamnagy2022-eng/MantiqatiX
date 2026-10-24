import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("web/app.js");
const operations = read("web/operations-modules.js");
const campaignMigration = read("supabase/migrations/20261010220000_rc453_marketing_campaign_backend.sql");
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

assert.match(app, /q\.eq\('requester_business_id',live\.businessId\)/,
  "internal CRM lead list must filter by active business");
assert.match(app, /live\.businessId&&\['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'\]\.includes\(String\(live\.role\|\|''\)\.toUpperCase\(\)\)/,
  "active-business filtering must apply only to internal business-management roles");

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
assert.match(contract, /writes\s*.OPEN.[\s\S]*?fixture\s*uses\s*.NEW./i,
  "contract must retain the OPEN vs NEW status discrepancy until reconciled");
assert.match(contract, /BLOCKED\s*\/\s*NOT CERTIFIED/,
  "release must remain blocked pending final evidence");


const appLifecycle = app.slice(app.indexOf("const LEAD_NEXT_STATUSES="), app.indexOf("const ORDER_STAFF_ROLES="));
assert.ok(appLifecycle.length > 0, "lead lifecycle UI contract must exist before order helpers");
assert.match(appLifecycle, /sb\.rpc\(['"]transition_marketing_lead_backend['"]/,
  "status changes must call the server-authoritative lifecycle RPC");
assert.match(appLifecycle, /p_actor:\s*user\.id[\s\S]*?p_expected_status:\s*expected[\s\S]*?p_new_status:\s*next[\s\S]*?p_request_id:\s*crypto\.randomUUID\(\)/,
  "lifecycle RPC must pass actor, expected state, next state, and a fresh idempotency key");
assert.match(app, /marketing_leads[\s\S]*?requester_business_id,created_at/,
  "lead list must retain the business scope needed for authorized lifecycle actions");
assert.match(appLifecycle, /requester_business_id',live\.businessId/,
  "internal lead detail reads must be constrained to the active business");
assert.match(appLifecycle, /requester_user_id',user\.id/,
  "customer lead detail reads must remain owner-scoped");
assert.match(appLifecycle, /LEAD_STATUS_CONFLICT/,
  "the UI must present a safe concurrency-conflict path");
assert.match(appLifecycle, /LEAD_NOT_FOUND_OR_FORBIDDEN/,
  "the UI must avoid exposing cross-scope lead existence");

// Marketing campaign UI must use the migration's server-authoritative RPCs and exact business scope.
assert.match(operations, /'campaigns','projects'/,
  "marketing workspace must expose the campaigns tab");
assert.match(operations, /t==='marketing_campaigns'[\s\S]*?q=q\.eq\('business_id',membership\.business_id\)/,
  "campaign reads must be scoped to the selected business");
assert.match(operations, /sb\.rpc\('create_marketing_campaign_backend'/,
  "campaign creation must use the server-authoritative creation RPC");
assert.match(operations, /sb\.rpc\('update_marketing_campaign_status_backend'/,
  "campaign status changes must use the server-authoritative status RPC");
assert.match(operations, /p_actor:user\.id[\s\S]*?p_business_id:membership\.business_id/,
  "campaign creation must pass the current actor and selected business for server validation");
assert.match(operations, /const canManage=Boolean[\s\S]*?membership\?\.business_id[\s\S]*?BUSINESS_OWNER/,
  "campaign management actions must be limited in the UI to an authenticated business manager");
assert.doesNotMatch(
  operations,
  /\.from\(\s*["']marketing_campaigns["']\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/,
  "campaign mutations must not bypass the backend RPC boundary"
);
assert.match(campaignMigration, /create or replace function public\.create_marketing_campaign_backend/,
  "campaign creation RPC must exist in the forward migration");
assert.match(campaignMigration, /create or replace function public\.update_marketing_campaign_status_backend/,
  "campaign status RPC must exist in the forward migration");
assert.match(campaignMigration, /revoke all on table public\.marketing_campaigns, public\.marketing_campaign_participants from anon, authenticated/,
  "campaign table writes must not be granted directly to browser roles");
assert.match(campaignMigration, /grant execute on function public\.create_marketing_campaign_backend[\s\S]*?to authenticated/,
  "authenticated users must execute only the scoped campaign RPC");
console.log("Marketing lead lifecycle + campaign workspace safety contracts: PASS (static source guard only)");
