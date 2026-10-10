import fs from "node:fs";
import assert from "node:assert/strict";

const web = fs.readFileSync("web/smm.js", "utf8");
const app = fs.readFileSync("web/app.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");
const html = fs.readFileSync("web/smm.html", "utf8");
const gateway = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");

assert.match(web, /fn\(\{action:'catalog'\}\)/, "SMM catalog must use the trusted gateway");
assert.match(web, /fn\(\{action:'my_data'\}\)/, "SMM account reads must use the trusted gateway");
assert.doesNotMatch(web, /sb\.from\(['"]smm_(services|orders|wallets|providers|provider_credentials|order_events|wallet_transactions)['"]\)/, "browser must not directly read restricted SMM tables");
assert.doesNotMatch(web, /sb\.from\(['"]user_memberships['"]\)/, "SMM page must not read membership rows directly");
assert.match(app, /iframe src="smm\.html\?v=smm9"/, "embedded SMM module must use the current cache key");
assert.match(index, /app\.js\?v=rc457-smm-ui-20261011/, "main app bundle cache key must be bumped");
assert.match(html, /src="smm\.js\?v=smm9"/, "SMM module script must use the current cache key");

const catalogStart = gateway.indexOf('if(a==="catalog")');
const accountStart = gateway.indexOf('if(a==="my_data")');
const configureStart = gateway.indexOf('if(a==="configure_provider")');
assert.ok(catalogStart >= 0 && accountStart > catalogStart && configureStart > accountStart, "read actions must exist before mutation routing");
const catalog = gateway.slice(catalogStart, accountStart);
const account = gateway.slice(accountStart, configureStart);
assert.match(catalog, /select\("id,provider_id,platform,category,name,description,selling_price,min_quantity,max_quantity,refill,cancel,dripfeed"\)/, "catalog query must use an explicit internal field allowlist");
assert.match(catalog, /activeProviders\.has\(String\(x\.provider_id\)\)/, "catalog must exclude services from inactive providers");
assert.doesNotMatch(catalog, /provider_cost|external_service_id|metadata/, "catalog must not expose provider costs, external IDs, or raw metadata");
assert.match(account, /\.eq\("user_id",user\.id\)/g, "personal order and wallet reads must use the verified bearer user");
assert.match(account, /select\("id,service_id,quantity,selling_price,status,provider_order_id,created_at,updated_at"\)/, "account orders must use an explicit field allowlist");
assert.match(account, /if\(o\.error\|\|w\.error\)/, "read errors must not be shown as successful empty data");

const adminStart = gateway.indexOf("async function isAdmin");
const secretStart = gateway.indexOf("async function secret", adminStart);
assert.ok(adminStart >= 0 && secretStart > adminStart, "SMM admin guard must exist");
const adminGuard = gateway.slice(adminStart, secretStart);
assert.match(adminGuard, /smm_admins/, "explicit SMM admin allowlist must be supported");
assert.match(adminGuard, /MNTY-PLATFORM/, "membership-based admin must be platform scoped");
assert.match(adminGuard, /p\.scope==="PLATFORM"/, "membership-based admin must have PLATFORM scope");
assert.match(adminGuard, /p\.full_control===true/, "membership-based admin must have full control");
assert.doesNotMatch(adminGuard, /includes\(String\(m\.role\)\.toUpperCase\(\)\)/, "tenant OWNER/ADMIN roles must not grant global SMM admin");
assert.match(gateway, /user\.is_anonymous\?null:user/, "anonymous Auth sessions must be rejected");
assert.match(gateway, /"Cache-Control":"no-store"/, "personal account responses must not be cached");

console.log("SMM trusted UI gateway contract: PASS");
