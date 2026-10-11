import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261011010000_rc456_smm_service_role_access_boundary.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc456_smm_service_role_integration.sql", "utf8");

const adminStart = edge.indexOf("async function isAdmin");
const secretStart = edge.indexOf("async function secret", adminStart);
assert.ok(adminStart >= 0 && secretStart > adminStart, "server-side SMM admin guard must exist");
const adminGuard = edge.slice(adminStart, secretStart);
assert.match(adminGuard, /smm_admins/, "explicit SMM admin allowlist must be supported");
assert.match(adminGuard, /from\("smm_admins"\)/, "SMM administration must use the dedicated allowlist");
assert.match(adminGuard, /if\(a\.error\)throw new Error\("SMM_ADMIN_CHECK_FAILED"\)/, "admin lookup errors must fail closed");
assert.match(adminGuard, /return !!a\.data/, "only an explicit SMM allowlist entry grants administration");
assert.doesNotMatch(adminGuard, /user_memberships|SUPER_ADMIN|MNTY-PLATFORM/, "generic tenant roles must not grant global SMM administration");

assert.match(edge, /user\.is_anonymous/, "anonymous Auth sessions must be rejected");
assert.match(edge, /["']cache-control["']\s*:\s*["']no-store["']/i, "personal account responses must not be cached");
const catalogStart = edge.indexOf('if(a==="catalog")');
const accountStart = edge.indexOf('if(a==="my_data")', catalogStart);
const configureStart = edge.indexOf('if(a==="configure_provider")', accountStart);
assert.ok(catalogStart >= 0 && accountStart > catalogStart && configureStart > accountStart, "trusted read actions must precede mutation routing");
const catalog = edge.slice(catalogStart, accountStart);
const account = edge.slice(accountStart, configureStart);
assert.match(catalog, /select\("id,provider_id,platform,category,name,description,selling_price,min_quantity,max_quantity,refill,cancel,dripfeed"\)/, "catalog query must select an explicit internal allowlist");
assert.match(catalog, /admin\.from\("smm_providers"\)\.select\("id"\)\.eq\("active",true\)/, "catalog must filter to active providers");
assert.match(catalog, /activeProviders\.has\(String\(x\.provider_id\)\)/, "services from inactive providers must be excluded");
assert.match(catalog, /id:x\.id,platform:x\.platform,category:x\.category,name:x\.name,description:x\.description/, "catalog response must map fields explicitly");
assert.doesNotMatch(catalog, /provider_cost|external_service_id|metadata/, "catalog must not expose provider costs, provider IDs, external IDs, or raw metadata");
assert.match(account, /\.eq\("user_id",user\.id\)/g, "both order and wallet reads must be scoped to the verified bearer user");
assert.match(account, /select\("id,service_id,quantity,selling_price,status,provider_order_id,created_at,updated_at"\)/, "account orders must use an explicit field allowlist");
assert.match(account, /if\(o\.error\|\|w\.error\)/, "failed reads must return an error, not a successful empty/zero response");

assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/i, "direct client table access must be revoked");
assert.match(migration, /grant select on table[\s\S]*public\.smm_admins[\s\S]*public\.smm_providers[\s\S]*public\.smm_wallets[\s\S]*to service_role/i, "trusted read grants must be limited to the required tables");
assert.match(migration, /grant select, insert, update on table[\s\S]*public\.smm_services[\s\S]*public\.smm_orders[\s\S]*to service_role/i, "service and order mutations need only select/insert/update");
assert.match(migration, /grant insert on table public\.smm_order_events to service_role/i, "order event table must be insert-only for the gateway");
assert.match(migration, /revoke all on table public\.smm_provider_credentials, public\.smm_wallet_transactions[\s\S]*service_role/i, "secrets and wallet ledger remain RPC-only");
assert.match(integration, /RC456 SMM service-role access boundary: PASS/, "isolated PostgreSQL ACL integration test must report success");
assert.match(integration, /direct client privilege unexpectedly present/, "integration must reject direct client table access");
assert.match(integration, /provider credentials must remain RPC-only/, "integration must keep provider credentials inaccessible to the service role");

console.log("SMM service-role access boundary contract: PASS");
