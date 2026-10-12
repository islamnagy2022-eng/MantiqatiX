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
assert.match(adminGuard, /tenant_id,role,status,business_id,permissions/, "membership lookup must retrieve platform scope fields");
assert.match(adminGuard, /role==="SUPER_ADMIN"/, "only SUPER_ADMIN may use membership-based platform access");
assert.match(adminGuard, /MNTY-PLATFORM/, "membership-based admin must be platform tenant scoped");
assert.match(adminGuard, /m\.business_id==null/, "platform admin membership must not be bound to a business");
assert.match(adminGuard, /p\.scope==="PLATFORM"/, "membership must carry PLATFORM scope");
assert.match(adminGuard, /p\.full_control===true/, "membership must have explicit full control");
assert.doesNotMatch(adminGuard, /includes\(String\(m\.role\)\.toUpperCase\(\)\)/, "tenant OWNER/ADMIN roles must not grant global SMM administration");

assert.match(edge, /user\.is_anonymous\?null:user/, "anonymous Auth sessions must be rejected");
assert.match(edge, /"Cache-Control":"no-store"/, "personal account responses must not be cached");
const providerCallStart = edge.indexOf("async function call(");
const providerCallEnd = edge.indexOf("\nDeno.serve", providerCallStart);
assert.ok(providerCallStart >= 0 && providerCallEnd > providerCallStart, "provider request helper must exist");
const providerCall = edge.slice(providerCallStart, providerCallEnd);
assert.ok(providerCall.includes("new globalThis.URL("), "provider endpoint must be parsed with the global URL constructor");
assert.ok(providerCall.includes('endpoint.protocol!=="https:"'), "provider endpoint must require HTTPS");
assert.match(providerCall, /AbortController/, "provider requests must have an abortable timeout");
assert.match(providerCall, /redirect:"error"/, "provider requests must reject redirects");
const placeOrderStart = edge.indexOf('if(a==="place_order")');
const placeOrderEnd = edge.indexOf('if(a==="', placeOrderStart + 10);
assert.ok(placeOrderStart >= 0 && placeOrderEnd > placeOrderStart, "place_order action must exist");
const placeOrder = edge.slice(placeOrderStart, placeOrderEnd);
assert.ok(placeOrder.includes("Number.isSafeInteger(q)"), "order quantity must be a safe integer");
assert.ok(placeOrder.includes('target.protocol!=="https:"'), "customer target URL must require HTTPS");
assert.match(placeOrder, /SERVICE_CONFIGURATION_INVALID/, "invalid service pricing configuration must fail closed");
assert.match(edge, /provider_status:"submission_unknown"/, "ambiguous provider outcomes must be explicitly marked for reconciliation");
assert.doesNotMatch(edge, /Automatic refund after provider failure/, "provider-call exceptions must not trigger blind automatic refunds");
const orderStatusStart = edge.indexOf('if(a==="order_status")');
const orderStatusEnd = edge.indexOf('return json({error:"UNKNOWN_ACTION"}', orderStatusStart);
assert.ok(orderStatusStart >= 0 && orderStatusEnd > orderStatusStart, "order_status action must exist");
const orderStatus = edge.slice(orderStatusStart, orderStatusEnd);
assert.doesNotMatch(orderStatus, /result:r/, "raw provider status responses must not be returned to customers");
assert.doesNotMatch(orderStatus, /payload:r\}/, "raw provider status responses must not be persisted in order events");
assert.match(orderStatus, /provider_status:String\(r\.status\|\|"unknown"\)/, "status response must expose only a bounded provider status");


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
