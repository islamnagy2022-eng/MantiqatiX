import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261122030000_rc499_cash_confirmation_business_branch_scope.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc499_cash_confirmation_business_branch_scope_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc499_cash_confirmation_business_branch_scope_integration.sql", "utf8");
const api = fs.readFileSync("supabase/functions/api/index.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/rc499-cash-confirmation-business-branch-scope.yml", "utf8");

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.confirm_cash_payment\(\s*p_payment_intent_id character varying,\s*p_user_id uuid\s*\)/,
  "RC499 must replace the existing cash confirmation RPC signature without introducing a parallel callable path");
assert.match(migration, /SECURITY DEFINER\s+SET search_path TO pg_catalog, public, pg_temp/,
  "cash confirmation must remain SECURITY DEFINER with a fixed safe search_path");
assert.match(migration, /m\.user_id = p_user_id[\s\S]*?m\.tenant_id = v_intent\.tenant_id[\s\S]*?m\.status = 'ACTIVE'/,
  "cash confirmation must use the caller's own active membership in the intent tenant");
assert.match(migration, /m\.business_id = v_order\.business_id[\s\S]*?m\.branch_id IS NULL OR m\.branch_id IS NOT DISTINCT FROM v_order\.branch_id/,
  "business memberships must be scoped to the order's business and either its branch or business-wide scope");
assert.match(migration, /m\.business_id IS NULL[\s\S]*?m\.branch_id IS NULL[\s\S]*?upper\(m\.role::text\) IN \('OWNER', 'ADMIN'\)/,
  "only fully unscoped OWNER/ADMIN memberships may receive tenant-wide cash confirmation");
assert.match(migration, /upper\(coalesce\(m\.role::text, ''\)\) <> 'CUSTOMER'/,
  "CUSTOMER memberships must never confirm cash even when permission metadata exists");
assert.match(migration, /jsonb_typeof\(coalesce\(m\.permissions, '\{\}'::jsonb\)\) = 'array'[\s\S]*?m\.permissions \? 'PAYMENT_CONFIRM_CASH'/,
  "explicit array payment-confirmation permissions must be supported");
assert.match(migration, /jsonb_typeof\(coalesce\(m\.permissions, '\{\}'::jsonb\)\) = 'object'[\s\S]*?m\.permissions -> 'PAYMENT_CONFIRM_CASH' = 'true'::jsonb/,
  "explicit boolean-object payment-confirmation permissions must require true");
assert.match(migration, /ORDER BY[\s\S]*?m\.branch_id IS NOT DISTINCT FROM v_order\.branch_id THEN 0[\s\S]*?m\.id\s+LIMIT 1/,
  "the exact matching membership must be deterministically preferred");
assert.ok(migration.indexOf("IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'") < migration.indexOf("IF v_intent.status = 'SUCCEEDED'"),
  "membership authorization must occur before returning an already-succeeded payment");
assert.match(migration, /CASH_PAYMENT_EVENT_CONFLICT/,
  "a conflicting pre-existing cash event must fail closed");
assert.match(migration, /CASH_COMMISSION_OBLIGATION_CONFLICT/,
  "a conflicting pre-existing commission obligation must fail closed");
assert.match(migration, /v_existing_obligation\.gross_amount IS DISTINCT FROM v_intent\.amount[\s\S]*?v_existing_obligation\.amount IS DISTINCT FROM v_commission_amount/,
  "an existing cash commission obligation must match both gross and commission amounts");
assert.match(migration, /IF v_existing_event\.id IS NULL THEN[\s\S]*?INSERT INTO public\.payment_events[\s\S]*?END IF;/,
  "an exact pre-existing event must not be duplicated");
assert.match(migration, /IF v_existing_obligation\.id IS NULL THEN[\s\S]*?INSERT INTO public\.financial_obligations[\s\S]*?END IF;/,
  "an exact pre-existing obligation must not be duplicated");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.confirm_cash_payment\(character varying, uuid\) FROM PUBLIC, anon, authenticated;[\s\S]*?GRANT EXECUTE ON FUNCTION public\.confirm_cash_payment\(character varying, uuid\) TO service_role;/,
  "cash confirmation must remain service-role-only");
assert.match(fixture, /CREATE TABLE public\.user_memberships[\s\S]*?CREATE TABLE public\.orders[\s\S]*?CREATE TABLE public\.payment_intents[\s\S]*?CREATE TABLE public\.commission_rules[\s\S]*?CREATE TABLE public\.payment_events[\s\S]*?CREATE TABLE public\.financial_obligations/,
  "fixture must model all tables required by the cash confirmation transaction");
assert.ok(integration.includes("unrelated membership is inserted before the authorized membership"),
  "integration must cover an unrelated same-tenant membership preceding the correct membership");
assert.ok(integration.includes("cross-branch manager confirmed cash payment"),
  "integration must reject a manager scoped to another branch");
assert.ok(integration.includes("business-wide manager was denied"),
  "integration must allow a branchless manager within the same business");
assert.ok(integration.includes("tenant-wide OWNER was denied"),
  "integration must retain tenant-wide OWNER authority");
assert.ok(integration.includes("false boolean permission authorized"),
  "integration must reject a false boolean permission");
assert.ok(integration.includes("CUSTOMER role with permission confirmed cash"),
  "integration must reject CUSTOMER even when the JSONB permission key is true");
assert.ok(integration.includes("tenant-wide MANAGER received OWNER/ADMIN-only scope"),
  "integration must reject an unscoped MANAGER");
assert.ok(integration.includes("Already confirmed"),
  "integration must retain idempotent retry behavior after authorization");
assert.ok(integration.includes("conflicting cash commission obligation was accepted"),
  "integration must reject a conflicting pre-existing commission obligation");
assert.ok(integration.includes("conflicting cash payment event was accepted"),
  "integration must reject a conflicting pre-existing payment event");
assert.match(api, /const hasPermission = \(permissions: unknown, permission: string\): boolean => \{[\s\S]*?Array\.isArray\(permissions\)[\s\S]*?\[permission\] === true/,
  "API permission decoder must recognize arrays and boolean-object grants only when true");
assert.ok(api.includes('businessBranchScope && (scopedFinanceRole || hasPermission(membership.permissions, "PAYMENT_READ_ALL"))'),
  "payment-intent read must use same-business branchless scope and the permission decoder");
assert.ok(api.includes('businessBranchScope && (allowedRole || hasPermission(membership.permissions, "PAYMENT_CONFIRM_CASH"))'),
  "cash confirmation API must apply order business/branch scope before role/permission authorization");
assert.ok(workflow.includes("image: postgres:17") && workflow.includes("ancestor=postgres:17") && !workflow.includes("postgres:16"),
  "RC499 integration must execute against PostgreSQL 17");
assert.ok(workflow.includes("workflow_dispatch: {}"),
  "RC499 integration workflow must support explicit manual dispatch");

console.log("RC499 cash confirmation scope, membership selection, permission shape and PostgreSQL 17 workflow: PASS");
