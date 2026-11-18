import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261118030000_rc474_payment_intent_business_branch_scope.sql");
const integration = read("../supabase/tests/rc474_payment_intent_business_branch_scope_integration.sql");
const workflow = read("../.github/workflows/rc474-payment-intent-business-branch-scope.yml");
const edge = read("../supabase/functions/payment-intent/index.ts");

const checks = [
  ["migration is transactional and preflights the exact existing RPC", /BEGIN;[\s\S]*?DO \$preflight\$/.test(migration) && migration.includes("RC474_PRECONDITION_FAILED") && /COMMIT;\s*$/.test(migration)],
  ["migration retains SECURITY DEFINER and pins empty search_path", /SECURITY DEFINER\s+SET search_path = ''/i.test(migration)],
  ["non-customer membership is bound to exact business and branch", migration.includes("m.business_id=v_order.business_id") && migration.includes("m.branch_id=v_order.branch_id")],
  ["tenant-wide membership requires both scope columns NULL", migration.includes("m.business_id IS NULL AND m.branch_id IS NULL")],
  ["customer ownership uses IS DISTINCT FROM so NULL customer orders require staff authorization", migration.includes("v_order.customer_id IS DISTINCT FROM v_uid")],
  ["financial role authorization is evaluated within the same business/branch predicate", /upper\(m\.role::text\) IN \('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER'\)[\s\S]*?m\.business_id=v_order\.business_id[\s\S]*?m\.branch_id=v_order\.branch_id/.test(migration)],
  ["all table and auth references are schema-qualified", migration.includes("public.orders") && migration.includes("public.user_memberships") && migration.includes("public.payment_intents") && migration.includes("auth.uid()") && migration.includes("auth.jwt()")],
  ["authenticated and service_role grants remain; anon and PUBLIC are revoked", migration.includes("TO authenticated, service_role") && /FROM PUBLIC, anon/i.test(migration)],
  ["integration covers cross-business, cross-branch and NULL-customer rejection", integration.includes("cross-business finance role authorized payment intent") && integration.includes("cross-branch finance role authorized payment intent") && integration.includes("order with NULL customer_id")],
  ["integration retains customer-owned payment and idempotent replay", integration.includes("customer-owned cross-tenant payment intent") && integration.includes("payment intent replay was not idempotent")],
  ["integration permits exact-branch, business-wide and tenant-wide finance roles", integration.includes("same-branch finance actor was denied") && integration.includes("business-wide finance actor was denied") && integration.includes("tenant-wide finance actor was denied")],
  ["workflow applies the source migration then runs disposable behavioral tests", workflow.includes("20260928190000_rc200_cross_tenant_customer_payment_authorization.sql") && workflow.includes("20261118030000_rc474_payment_intent_business_branch_scope.sql") && workflow.includes("rc474_payment_intent_business_branch_scope_integration.sql")],
  ["Edge endpoint delegates final business/branch authorization to the user-scoped RPC", edge.includes('userClient.rpc("create_payment_intent_backend"') && !edge.includes('admin.from("user_memberships")')],
];

for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
assert.equal(checks.every(([, ok]) => ok), true, "RC474 payment-intent business/branch scope contract failed");
console.log("\n" + checks.length + "/" + checks.length + " RC474 source checks passed.");
