import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261122010000_rc497_verified_business_reviews.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const fixture = fs.readFileSync("supabase/tests/rc497_business_reviews_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc497_business_reviews_integration.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/li2lak-verified-business-reviews.yml", "utf8");
const forwardReplay = fs.readFileSync(".github/workflows/forward-migration-chain-replay.yml", "utf8");
const gate = fs.readFileSync("scripts/validate-production-migration-chain-gate.mjs", "utf8");
const verifier = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const liveContract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const manifest = JSON.parse(fs.readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));

assert.match(migration, /CONSTRAINT business_reviews_one_per_order UNIQUE \(order_id\)/,
  "one immutable review per order must be enforced by a database unique constraint");
assert.match(migration, /v_order\.customer_id IS DISTINCT FROM v_actor[\s\S]*?upper\(coalesce\(v_order\.status, ''\)\) <> 'DELIVERED'[\s\S]*?ORDER_BUSINESS_TENANT_MISMATCH/,
  "review submission must bind the authenticated actor to their own delivered order");
assert.match(migration, /v_existing\.rating = p_rating AND v_existing\.review_text IS NOT DISTINCT FROM v_text[\s\S]*?REVIEW_ALREADY_SUBMITTED/,
  "exact retry must be idempotent while changed duplicate payloads are rejected");
assert.match(migration, /v_decision IN \('REJECTED','HIDDEN'\) AND v_reason IS NULL[\s\S]*?MODERATION_REASON_REQUIRED/,
  "rejected or hidden reviews must carry an auditable moderation reason");
assert.match(migration, /FROM private\.platform_admins pa WHERE pa\.user_id = v_actor/,
  "moderation must depend on the protected platform-admin registry, not tenant roles");
assert.doesNotMatch(migration.match(/CREATE OR REPLACE FUNCTION public\.moderate_business_review[\s\S]*?\$function\$;/)?.[0] ?? "", /mnty_can_platform_admin|is_platform_admin/,
  "tenant-derived global admin helpers must not authorize review moderation");
assert.match(migration, /m\.business_id = v_review\.business_id[\s\S]*?BUSINESS_REVIEW_RESPONSE_FORBIDDEN/,
  "business response must be restricted to the reviewed business");
assert.match(migration, /status = 'PUBLISHED'[\s\S]*?pp\.is_verified = true/,
  "public review reads must be moderation-gated and verified-business-only");
assert.match(migration, /least\(greatest\(coalesce\(p_limit, 10\), 1\), 20\)/,
  "public review page size must be clamped to at most 20");
assert.match(migration, /'verifiedInteraction', true/,
  "public review rows must be explicitly marked as delivered-order verified interactions");
assert.match(migration, /customer_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  "account deletion must anonymize reviewer references without deleting review history");
assert.match(migration, /actor_user_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  "account deletion must anonymize event actor references");
assert.match(migration, /ALTER TABLE public\.business_reviews ENABLE ROW LEVEL SECURITY;[\s\S]*?FORCE ROW LEVEL SECURITY/,
  "review table must enforce RLS");
assert.match(migration, /ALTER TABLE public\.business_review_events ENABLE ROW LEVEL SECURITY;[\s\S]*?FORCE ROW LEVEL SECURITY/,
  "review event ledger must enforce RLS");
assert.match(migration, /REVOKE ALL ON TABLE public\.business_reviews FROM PUBLIC, anon, authenticated, service_role/,
  "review table must not grant direct API-role access");
assert.match(migration, /REVOKE ALL ON TABLE public\.business_review_events FROM PUBLIC, anon, authenticated, service_role/,
  "review event ledger must not grant direct API-role access");
assert.equal((migration.match(/SECURITY DEFINER/g) ?? []).length, 4,
  "only the four intentional review RPCs should be SECURITY DEFINER");
assert.equal((migration.match(/SET search_path TO ''/g) ?? []).length, 4,
  "every review SECURITY DEFINER RPC must use an empty search_path");
assert.match(fixture, /CREATE TABLE public\.orders[\s\S]*?customer_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  "fixture must model customer account deletion without blocking order retention");
for (const token of [
  "ORDER_NOT_DELIVERED",
  "BUSINESS_REVIEW_FORBIDDEN",
  "REVIEW_ALREADY_SUBMITTED",
  "MODERATION_REASON_REQUIRED",
  "PLATFORM_ADMIN_REQUIRED",
  "BUSINESS_REVIEW_RESPONSE_FORBIDDEN",
  "BUSINESS_REVIEW_ALREADY_ANSWERED",
  "RC497_PUBLIC_REVIEW_DISCLOSES_PRIVATE_IDENTITY",
  "RC497_DIRECT_TABLE_READ_GRANT_FOUND",
  "RC497_ACCOUNT_DELETION_REMOVED_REVIEWS",
  "RC497_ACCOUNT_DELETION_DID_NOT_ANONYMIZE_REVIEW",
]) assert.ok(integration.includes(token), `integration suite must cover ${token}`);

assert.ok(workflow.includes(migrationPath), "dedicated workflow must apply RC497 migration");
assert.ok(workflow.includes("supabase/tests/rc497_business_reviews_integration.sql"), "dedicated workflow must execute integration tests");
assert.ok(forwardReplay.includes("node scripts/validate-rc497-business-reviews.mjs"), "full forward replay must run RC497 source validation");
assert.ok(gate.includes(JSON.stringify("20261122010000_rc497_verified_business_reviews.sql")), "exact release gate must track RC497 migration");
assert.match(gate, /required\.length, 77/, "exact release gate must count all 77 required migrations");
assert.ok(verifier.includes(JSON.stringify("20261122010000_rc497_verified_business_reviews.sql")), "Production verifier must track RC497 migration");
assert.ok(liveContract.includes('"20261122010000"'), "live reconciliation contract must include RC497 version");
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 77,
  "release manifest must track all 77 required versions");
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261122010000"),
  "release manifest required version list must include RC497");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261122010000"),
  "Production must remain blocked until RC497 is explicitly applied");
assert.equal(manifest.rc497_verified_business_reviews.status, "SOURCE_CANDIDATE_NOT_APPLIED",
  "manifest must not claim RC497 is deployed");
console.log("RC497_BUSINESS_REVIEWS_SOURCE_CONTRACT=PASS");
