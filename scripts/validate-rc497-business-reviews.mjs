import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20261122010000_rc497_verified_business_reviews.sql";
const orderMigrationPath = "supabase/migrations/20261122020000_rc498_authenticated_order_create_rpc.sql";
const reviewPanel = fs.readFileSync("apps/catalog-frontend/src/components/storefront/BusinessReviewsPanel.tsx", "utf8");
const customerReviewPanel = fs.readFileSync("apps/catalog-frontend/src/components/account/CustomerOrderReviews.tsx", "utf8");
const accountPortal = fs.readFileSync("apps/catalog-frontend/src/modules/account/SubscriberAccountPortal.tsx", "utf8");
const ownerReviewPanel = fs.readFileSync("apps/catalog-frontend/src/components/merchant/BusinessReviewManagementPanel.tsx", "utf8");
const adminReviewPanel = fs.readFileSync("apps/catalog-frontend/src/components/admin/BusinessReviewModerationPanel.tsx", "utf8");
const adminDashboard = fs.readFileSync("apps/catalog-frontend/src/components/admin/AdminDashboard.tsx", "utf8");
const merchantDashboard = fs.readFileSync("apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx", "utf8");
const appShell = fs.readFileSync("apps/catalog-frontend/src/App.tsx", "utf8");
const cartDrawer = fs.readFileSync("apps/catalog-frontend/src/components/cart/CartDrawer.tsx", "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");
const orderMigration = fs.readFileSync(orderMigrationPath, "utf8");
const orderCreateEdge = fs.readFileSync("supabase/functions/order-create/index.ts", "utf8");
const apiEdge = fs.readFileSync("supabase/functions/api/index.ts", "utf8");
const orderIntegration = fs.readFileSync("supabase/tests/rc104_order_idempotency_scope_integration.sql", "utf8");
const orderWorkflow = fs.readFileSync(".github/workflows/order-idempotency-scope.yml", "utf8");
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
assert.match(migration, /branch_id varchar REFERENCES public\.branches\(id\)/,
  "review provenance must retain the order branch for scoped owner responses");
assert.match(migration, /v_order\.branch_id/,
  "review submission must bind the review to the order's branch");
assert.match(fixture, /CREATE TABLE public\.branches[\s\S]*?branch-a2/,
  "fixture must cover multiple branches of one business");

assert.match(migration, /v_order\.customer_id IS DISTINCT FROM v_actor[\s\S]*?upper\(coalesce\(v_order\.status, ''\)\) <> 'DELIVERED'[\s\S]*?ORDER_BUSINESS_TENANT_MISMATCH/,
  "review submission must bind the authenticated actor to their own delivered order");
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_customer_business_review_status[\s\S]*?o\.customer_id = v_actor[\s\S]*?r\.customer_id = v_actor/,
  "customer review status RPC must return only the authenticated customer's own review");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_customer_business_review_status\(uuid\) FROM PUBLIC, anon, service_role[\s\S]*?GRANT EXECUTE ON FUNCTION public\.get_customer_business_review_status\(uuid\) TO authenticated/,
  "private customer review status RPC must be authenticated-only");
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_platform_business_review_moderation_queue[\s\S]*?FROM private\.platform_admins pa WHERE pa\.user_id = v_actor/,
  "moderation queue must require direct platform-admin registry membership");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_platform_business_review_moderation_queue\(integer, integer\) FROM PUBLIC, anon, service_role[\s\S]*?GRANT EXECUTE ON FUNCTION public\.get_platform_business_review_moderation_queue\(integer, integer\) TO authenticated/,
  "moderation queue RPC must be authenticated-only with registry authorization");

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
assert.match(migration, /m\.branch_id IS NULL[\s\S]*?v_review\.branch_id IS NOT NULL AND m\.branch_id = v_review\.branch_id/,
  "branch-scoped managers must not answer reviews for another branch");

assert.match(migration, /pp\.status = 'ACTIVE' AND pp\.is_verified = true/,
  "public review reads must be restricted to active verified business profiles");
assert.match(migration, /r\.status = 'PUBLISHED'/,
  "public review reads must be moderation-gated");
assert.match(migration, /least\(greatest\(coalesce\(p_limit, 10\), 1\), 20\)/,
  "public review page size must be clamped to at most 20");
assert.match(migration, /'verifiedInteraction', true/,
  "public review rows must be explicitly marked as delivered-order verified interactions");
assert.match(migration, /customer_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  "account deletion must anonymize reviewer references without deleting review history");
assert.match(migration, /actor_user_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  "account deletion must anonymize event actor references");
assert.match(migration, /anonymize_business_review_on_customer_delete[\s\S]*?NEW\.review_text := NULL/,
  "account deletion must scrub customer-authored review text while retaining the verified rating");

assert.match(migration, /ALTER TABLE public\.business_reviews ENABLE ROW LEVEL SECURITY;[\s\S]*?FORCE ROW LEVEL SECURITY/,
  "review table must enforce RLS");
assert.match(migration, /ALTER TABLE public\.business_review_events ENABLE ROW LEVEL SECURITY;[\s\S]*?FORCE ROW LEVEL SECURITY/,
  "review event ledger must enforce RLS");
assert.match(migration, /REVOKE ALL ON TABLE public\.business_reviews FROM PUBLIC, anon, authenticated, service_role/,
  "review table must not grant direct API-role access");
assert.match(migration, /REVOKE ALL ON TABLE public\.business_review_events FROM PUBLIC, anon, authenticated, service_role/,
  "review event ledger must not grant direct API-role access");
assert.equal((migration.match(/SECURITY DEFINER/g) ?? []).length, 6,
  "only the six intentional review RPCs should be SECURITY DEFINER");
assert.equal((migration.match(/SET search_path TO ''/g) ?? []).length, 7,
  "all six review SECURITY DEFINER RPCs and the trigger function must use an empty search_path");
assert.match(fixture, /CREATE TABLE public\.orders[\s\S]*?customer_id uuid REFERENCES auth\.users\(id\) ON DELETE SET NULL/,
  "fixture must model customer account deletion without blocking order retention");
for (const token of [
  "ORDER_NOT_DELIVERED",
  "ORDER_BUSINESS_TENANT_MISMATCH",
  "RC497_CUSTOMER_REVIEW_STATUS_LOOKUP_FAILED",
  "RC497_CUSTOMER_READS_FOREIGN_REVIEW_STATUS",
  "RC497_ADMIN_QUEUE_LOOKUP_FAILED",
  "RC497_ADMIN_QUEUE_DISCLOSED_CUSTOMER",
  "RC497_ADMIN_QUEUE_MISSING_PENDING_REVIEW",
  "RC497_ADMIN_QUEUE_PAGINATION_METADATA_INVALID",
  "RC497_ADMIN_QUEUE_PAGINATION_FAILED",
  "RC497_TENANT_OWNER_ACCESSED_MODERATION_QUEUE",
  "BUSINESS_REVIEW_FORBIDDEN",
  "REVIEW_ALREADY_SUBMITTED",
  "MODERATION_REASON_REQUIRED",
  "PLATFORM_ADMIN_REQUIRED",
  "BUSINESS_REVIEW_RESPONSE_FORBIDDEN",
  "RC497_CROSS_BRANCH_MANAGER_RESPONDED",
  "BUSINESS_REVIEW_ALREADY_ANSWERED",
  "RC497_PUBLIC_REVIEW_DISCLOSES_PRIVATE_IDENTITY",
  "RC497_DIRECT_TABLE_READ_GRANT_FOUND",
  "RC497_ACCOUNT_DELETION_REMOVED_REVIEWS",
  "RC497_ACCOUNT_DELETION_DID_NOT_ANONYMIZE_REVIEW",
  "RC497_ACCOUNT_DELETION_DID_NOT_SCRUB_REVIEW_TEXT",
]) assert.ok(integration.includes(token), `integration suite must cover ${token}`);

assert.match(orderMigration, /create or replace function public\.create_order_backend[\s\S]*?set search_path=pg_catalog, public, extensions, pg_temp/i,
  "RC498 must restore the canonical order function and harden its SECURITY DEFINER search_path");
assert.match(orderMigration, /REVOKE ALL ON FUNCTION public\.create_order_backend[\s\S]*?FROM PUBLIC, anon, authenticated[\s\S]*?GRANT EXECUTE ON FUNCTION public\.create_order_backend[\s\S]*?TO authenticated/,
  "RC498 must deny PUBLIC/anon, reset authenticated ACL and grant authenticated execution");
assert.ok(["auth.uid()", "auth.role()", "IDEMPOTENCY_KEY_CONFLICT", "catalog_item_prices", "CUSTOMER_REQUIRED"].every((token) => orderMigration.includes(token)),
  "RC498 must retain identity, service-role verification, idempotency-scope and server-pricing guards");
assert.ok(orderCreateEdge.includes("Authorization: `Bearer ${token}`") && orderCreateEdge.includes('userClient.rpc("create_order_backend"'),
  "order-create must invoke the backend RPC with the verified customer JWT");
assert.doesNotMatch(orderCreateEdge, /admin\.rpc\("create_order_backend"/,
  "order-create must not invoke the auth.uid()-enforcing RPC through service_role");
assert.ok(apiEdge.includes("Authorization: `Bearer ${token}`") && apiEdge.includes('supabaseUser.rpc("create_order_backend"'),
  "legacy authenticated Orders API must invoke the backend RPC with the verified customer JWT");
assert.doesNotMatch(apiEdge, /supabaseAdmin\.rpc\("create_order_backend"/,
  "legacy Orders API must not invoke the auth.uid()-enforcing RPC through service_role");
assert.match(orderIntegration, /RC498_AUTHENTICATED_EXECUTE_MISSING[\s\S]*?RC498_ANON_EXECUTE_PRESENT[\s\S]*?RC498 authenticated order RPC ACL, identity and pricing: PASS/,
  "order integration suite must cover authenticated execution, anon denial, identity and authoritative pricing");
assert.ok(orderWorkflow.includes(orderMigrationPath), "order workflow must apply RC498 after RC105");
assert.ok(orderWorkflow.includes("supabase/functions/order-create/index.ts") && orderWorkflow.includes("supabase/functions/api/index.ts"),
  "order workflow must trigger for both JWT-scoped order entry points");
assert.ok(gate.includes(JSON.stringify("20261122020000_rc498_authenticated_order_create_rpc.sql")), "exact release gate must track RC498");
assert.match(gate, /required\.length, 78/, "exact release gate must count all 78 required migrations");
assert.ok(verifier.includes(JSON.stringify("20261122020000_rc498_authenticated_order_create_rpc.sql")), "Production verifier must track RC498");
assert.ok(liveContract.includes('"20261122020000"'), "live reconciliation contract must include RC498");
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 78,
  "release manifest must track all 78 required versions");
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261122020000"),
  "release manifest required version list must include RC498");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261122020000"),
  "Production must remain blocked until RC498 is explicitly reconciled");
assert.equal(manifest.rc498_authenticated_order_create_rpc.status, "SOURCE_CANDIDATE_NOT_APPLIED",
  "manifest must not claim RC498 is deployed");

assert.match(reviewPanel, /get_public_business_review_summary/,
  "public storefront must read reviews only through the bounded public RPC");
assert.match(reviewPanel, /currentBusiness\?\.isVerified[\s\S]*?operationalStatus !== 'ACTIVE'/,
  "public review panel must be restricted to active verified businesses");
assert.match(reviewPanel, /verifiedInteraction === true/,
  "public storefront must reject review rows without verified-order provenance");
assert.match(cartDrawer, /functions\\.invoke\\('order-create'/,
  "authenticated catalog checkout must persist orders through the existing order-create Edge Function");
assert.match(cartDrawer, /authSession\\.isAuthenticated[\\s\\S]*?catalogItemId: product\\.id[\\s\\S]*?clientIdempotencyKey/,
  "tracked checkout must use the authenticated session, canonical catalog item IDs and an idempotency key");
assert.doesNotMatch(cartDrawer, /p_subtotal:|p_total_amount:|p_tax:/,
  "browser checkout must not submit authoritative financial totals");
assert.match(cartDrawer, /completedOrderDetails\\.tracked && completedOrderDetails\\.orderId/,
  "checkout confirmation must display the persisted order reference");
assert.match(cartDrawer, /completedOrderDetails\\.whatsappUrl &&[\\s\\S]*?rel="noopener noreferrer"/,
  "checkout confirmation must provide a safe manual WhatsApp fallback when popup navigation is blocked");
assert.match(customerReviewPanel, /get_customer_business_review_status[\s\S]*?submit_business_review/,
  "customer order portal must check owned review status before submission");
assert.match(customerReviewPanel, /\.eq\('customer_id', userId\)/,
  "customer order list must scope every order query to the authenticated identity");
assert.match(customerReviewPanel, /order\.status\.toUpperCase\(\) === 'DELIVERED'/,
  "customer review form must only be offered for delivered orders");
assert.match(ownerReviewPanel, /supabase\.rpc\('respond_to_business_review'[\s\S]*?p_review_id:[\s\S]*?p_response:/,
  "business owner UI must use the scoped response RPC rather than direct table writes");
assert.match(adminReviewPanel, /p_offset: offset[\s\S]*?nextOffset < totalCount[\s\S]*?loadMore/,
  "platform moderation queue must paginate older pending reviews without unbounded reads");
assert.match(adminReviewPanel, /supabase\.rpc\('get_platform_business_review_moderation_queue'[\s\S]*?supabase\.rpc\('moderate_business_review'/,
  "platform moderation UI must use only the registry-protected queue and moderation RPCs");
assert.match(adminDashboard, /BusinessReviewModerationPanel[\s\S]*?activeAdminTab === 'business_reviews'/,
  "platform moderation panel must be mounted in the admin dashboard");
assert.match(merchantDashboard, /BusinessReviewManagementPanel[\s\S]*?activeTab === 'reviews'/,
  "business owner review-response panel must be mounted behind the merchant dashboard tab");
assert.match(accountPortal, /<CustomerOrderReviews \/>/,
  "customer order history and review form must be mounted in the account portal");
assert.match(appShell, /<BusinessReviewsPanel \/>/,
  "verified public review panel must be mounted in the business storefront");
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
