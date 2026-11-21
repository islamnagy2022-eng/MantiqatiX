import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/catalog-admin/index.ts", "utf8");

assert.match(source, /const allowedOrigin = "https:\/\/islamnagy2022-eng\.github\.io"/, "only the production GitHub Pages origin should be allowed");
assert.doesNotMatch(source, /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/, "wildcard CORS must not return");
assert.match(source, /["']Access-Control-Allow-Origin["']\s*:\s*allowedOrigin/, "CORS must use the exact allowlisted origin");
assert.match(source, /["']Access-Control-Allow-Headers["']\s*:\s*["']authorization, x-client-info, apikey, content-type["']/, "required Supabase request headers must remain allowed");
assert.match(source, /["']Access-Control-Allow-Methods["']\s*:\s*["']POST, OPTIONS["']/, "only POST and preflight should be allowed");
assert.match(source, /["']Vary["']\s*:\s*["']Origin["']/, "cache behavior must vary by origin");
assert.match(source, /const origin = req\.headers\.get\("Origin"\);[\s\S]*?if \(origin && origin !== allowedOrigin\)[\s\S]*?ORIGIN_NOT_ALLOWED[\s\S]*?if \(req\.method === "OPTIONS"\)/, "reject disallowed browser origins before preflight or request routing");
assert.match(source, /if \(req\.method !== "POST"\)/, "non-POST requests must remain rejected");
assert.match(source, /await service\.auth\.getUser\(token\)/, "bearer token must still be verified");
assert.match(source, /user\.is_anonymous/, "anonymous sessions must remain rejected");
assert.match(source, /if \(!tenantId \|\| tenantId\.length > 80\)/, "tenant identifier must remain bounded");
assert.match(source, /if \(!isUuid\(businessId\)\)/, "business identifier must be a UUID");
assert.match(source, /upsert_catalog_item_backend/);
assert.match(source, /upsert_catalog_price_backend/);
assert.match(source, /upsert_catalog_settings_backend/);
assert.match(source, /SUBSCRIPTION_FROZEN/, "frozen subscriptions must be blocked by the server");
assert.match(source, /BUSINESS_INACTIVE/, "inactive businesses must be blocked by the server");
assert.match(source, /String\(m\.branch_id\) === String\(branchId \|\| ""\)/, "branch-scoped memberships must require an exact branch match");
assert.match(source, /bizcatalog: business\.settings\?\.bizcatalog/, "catalog reads must return persisted subscription state");
assert.match(source, /const mutationActions = new Set\(\[/, "catalog mutation actions must be enumerated for subscription enforcement");
assert.match(source, /mutationActions\.has\(action\) && !scopedPlatformMembership/, "platform admins may recover frozen or inactive businesses");
assert.match(source, /catalogSettings\.isFrozen === true/, "frozen subscription state must be enforced server-side");
assert.match(source, /paymentStatus \|\| ""\)\.toLowerCase\(\) === "frozen"/, "legacy frozen billing state must be enforced server-side");
assert.match(source, /BUSINESS_INACTIVE/, "inactive businesses must not accept merchant mutations");
assert.match(source, /SUBSCRIPTION_FROZEN/, "frozen subscriptions must reject merchant mutations");

assert.doesNotMatch(source, /m\.permissions\?\.scope\s*===\s*"PLATFORM"/, "membership metadata must never confer platform-root authority");

assert.match(source, /await userClient\.rpc\("mnty_can_platform_admin"\)/, "platform-root authorization must consult the caller-context canonical registry guard");
assert.match(source, /hasRegisteredPlatformRoot = !registryError && registryResult === true/, "registry lookup errors and false results must fail closed");
assert.match(source, /hasPlatformScope = hasRegisteredPlatformRoot/, "the private registry alone must confer platform-root scope");
assert.match(source, /scopedPlatformMembership = hasRegisteredPlatformRoot/, "registered roots must recover businesses without a tenant membership row");
assert.doesNotMatch(source, /isPlatformAdmin|hasPlatformAdminMembership|platformTenants/, "platform scope must not depend on membership-derived root claims or tenant lists");
assert.match(source, /service\.from\("tenants"\)[\s\S]*?select\("id,name,code,settings"\)[\s\S]*?eq\("status", "ACTIVE"\)/, "root tenant enumeration must come from active persisted tenants");
assert.match(source, /const productionTenants = \(activeTenants \|\| \[\]\)\.filter/);
assert.match(source, /testIdentity/, "platform root must not expose test or isolation tenants in the production catalog");

console.log("Catalog admin CORS, authorization, and subscription enforcement source contract: PASS");
