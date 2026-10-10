import fs from "node:fs";
import assert from "node:assert/strict";

const web = fs.readFileSync("web/smm.js", "utf8");
const gateway = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");

assert.match(web, /fn\(\{action:'catalog'\}\)/, "SMM catalog must use the trusted gateway");
assert.match(web, /fn\(\{action:'my_data'\}\)/, "SMM account reads must use the trusted gateway");
assert.doesNotMatch(web, /sb\.from\(['"]smm_(services|orders|wallets|providers|provider_credentials|order_events|wallet_transactions)['"]\)/, "browser must not directly read restricted SMM tables");
assert.doesNotMatch(web, /sb\.from\(['"]user_memberships['"]\)/, "SMM page should not read membership rows directly");

const catalogStart = gateway.indexOf('if(a==="catalog")');
const accountStart = gateway.indexOf('if(a==="my_data")');
const configureStart = gateway.indexOf('if(a==="configure_provider")');
assert.ok(catalogStart >= 0 && accountStart > catalogStart && configureStart > accountStart, "read actions must exist before mutation routing");
const catalog = gateway.slice(catalogStart, accountStart);
const account = gateway.slice(accountStart, configureStart);
assert.match(catalog, /select\("id,platform,category,name,description,selling_price,min_quantity,max_quantity,refill,cancel,dripfeed"\)/, "catalog response must use an explicit public field allowlist");
assert.doesNotMatch(catalog, /provider_cost|metadata|provider_id|external_service_id/, "catalog must not expose internal provider cost or metadata");
assert.match(account, /\.eq\("user_id",user\.id\)/g, "orders and wallet reads must both be scoped to verified bearer user");
assert.match(account, /select\("id,service_id,quantity,selling_price,status,provider_order_id,created_at,updated_at"\)/, "account response must use an explicit order field allowlist");
assert.match(account, /if\(o\.error\|\|w\.error\)/, "read failures must return an error, not a successful empty/zero response");
assert.match(account, /is_admin:await isAdmin\(user\.id\)/, "admin capability must be derived server-side");

const adminStart = gateway.indexOf("async function isAdmin");
const secretStart = gateway.indexOf("async function secret");
assert.ok(adminStart >= 0 && secretStart > adminStart, "server-side SMM admin guard must exist");
const adminGuard = gateway.slice(adminStart, secretStart);
assert.match(adminGuard, /smm_admins/, "explicit SMM admin allowlist must be supported");
assert.match(adminGuard, /MNTY-PLATFORM/, "membership-based SMM admin must be platform scoped");
assert.match(adminGuard, /p\.scope==="PLATFORM"/, "membership-based SMM admin must carry PLATFORM scope");
assert.match(adminGuard, /p\.full_control===true/, "membership-based SMM admin must have full control");
assert.doesNotMatch(adminGuard, /OWNER.*ADMIN.*SUPER_ADMIN|includes\(String\(m\.role\)\.toUpperCase\(\)\)/, "tenant OWNER/ADMIN roles must not grant global SMM administration");
assert.match(gateway, /user\.is_anonymous\?null:user/, "anonymous Auth sessions must be rejected by the trusted gateway");

console.log("SMM trusted read gateway contract: PASS");
