import fs from "node:fs";
import assert from "node:assert/strict";

const fn = fs.readFileSync("supabase/functions/platform-commercial-overview/index.ts", "utf8");
const app = fs.readFileSync("web/app.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/module-professionalization.yml", "utf8");

assert.match(fn, /req\.method !== "POST"/, "commercial overview must be POST-only");
assert.match(fn, /req\.method === "OPTIONS"/, "commercial overview must handle CORS preflight");
assert.match(fn, /Cache-Control[\s\S]{0,80}no-store/, "commercial overview responses must not be cached");
assert.match(fn, /authorization\.startsWith\("Bearer "\)/, "commercial overview must require a bearer token");
assert.match(fn, /service\.auth\.getUser\(token\)/, "commercial overview must validate the signed-in user server-side");
assert.match(fn, /user\.is_anonymous/, "anonymous Auth users must be rejected");
assert.match(fn, /\.eq\("user_id", user\.id\)[\s\S]{0,90}\.eq\("status", "ACTIVE"\)/, "only the caller's active memberships may be considered");
assert.match(fn, /String\(membership\.role \|\| ""\)\.toUpperCase\(\) === "SUPER_ADMIN"/, "exact SUPER_ADMIN role is required");
assert.match(fn, /!membership\.business_id[\s\S]{0,100}!membership\.branch_id/, "platform administrators must not be business- or branch-scoped");
assert.match(fn, /membership\.permissions\?\.scope === "PLATFORM"/, "PLATFORM scope is required");
assert.match(fn, /membership\.permissions\?\.full_control === true/, "explicit full_control is required");
assert.match(fn, /\.in\("id", tenantIds\)[\s\S]{0,120}\.eq\("status", "ACTIVE"\)/, "tenant reads must remain within active platform membership tenants");
assert.match(fn, /const productionTenants = \(tenantRows \|\| \[\]\)\.filter\(isProductionTenant\)/, "test and isolation tenants must be excluded");
assert.match(fn, /\.from\("businesses"\)[\s\S]{0,200}\.in\("tenant_id", productionTenantIds\)/, "business reads must be tenant-allowlisted");
assert.match(fn, /\.from\("business_subscriptions"\)[\s\S]{0,220}\.in\("business_id", businessIds\)/, "subscription reads must be restricted to businesses in the allowlisted tenants");
assert.match(fn, /\.from\("subscription_payment_intents"\)[\s\S]{0,220}\.in\("business_id", businessIds\)/, "payment-intent reads must be restricted to businesses in the allowlisted tenants");
assert.match(fn, /\.from\("commission_transactions"\)[\s\S]{0,180}\.in\("tenant_id", productionTenantIds\)/, "commission reads must be tenant-allowlisted");
assert.match(fn, /\.from\("financial_obligations"\)[\s\S]{0,180}\.in\("tenant_id", productionTenantIds\)/, "obligation reads must be tenant-allowlisted");
assert.match(fn, /\.from\("settlement_transactions"\)[\s\S]{0,180}\.in\("tenant_id", productionTenantIds\)/, "settlement reads must be tenant-allowlisted");
assert.match(fn, /\.from\("audit_logs"\)\.insert\(auditRows\)/, "each platform commercial read must be audited");
assert.match(fn, /throwOnError\("PLATFORM_COMMERCIAL_AUDIT_FAILED", auditError\)/, "commercial data must not be returned if audit persistence fails");
assert.match(fn, /limit\(1500\)|limit\(2000\)|limit\(5000\)/, "all privileged directory reads must be bounded");
assert.doesNotMatch(fn, /provider_reference|provider_transaction_id|raw_payload|client_secret|payment_method|user_metadata|email|phone/, "response sources must not expose payment references, payloads or personal contact fields");
assert.doesNotMatch(fn, /\.from\("(business_subscriptions|subscription_payment_intents|commission_transactions|financial_obligations|settlement_transactions)"\)\.(insert|update|upsert|delete)/, "commercial overview must be read-only for financial sources");
assert.match(fn, /"PLATFORM_COMMERCIAL_OVERVIEW_READ"/, "audit events must have a stable action name");
assert.match(fn, /"result":?\s*"SUCCESS"|result: "SUCCESS"/, "successful reads must be recorded explicitly");

assert.match(app, /function superAdminCommercialOverviewPanel\(\)/, "Super Admin commercial overview panel must exist");
assert.match(app, /function loadSuperAdminCommercialOverview\(\)/, "Super Admin commercial overview loader must exist");
assert.match(app, /sb\.functions\.invoke\('platform-commercial-overview',[\s\S]{0,120}action:'OVERVIEW'/, "commercial overview must call the audited server endpoint");
assert.match(app, /superAdminCommercialOverviewPanel\(\)/, "commercial overview panel must be included in the protected control workspace");
assert.match(app, /loadSuperAdminCommercialOverview\(\);/, "commercial overview must load when the protected workspace initializes");
assert.match(app, /sa-commercial-overview-refresh[\s\S]{0,150}loadSuperAdminCommercialOverview/, "commercial overview must provide an explicit refresh action");
assert.match(app, /لا نعرض بيانات افتراضية أو نستخدم أرقامًا تقديرية/, "unavailable source state must not be represented as zero or mock data");
assert.doesNotMatch(app, /sb\.from\(['"](?:business_subscriptions|subscription_payment_intents|commission_transactions|financial_obligations|settlement_transactions)['"]\)/, "browser code must not query restricted commercial tables directly");

assert.match(workflow, /validate-platform-commercial-overview\.mjs/, "commercial overview source validator must run in CI");
assert.match(workflow, /esbuild[\s\S]{0,250}platform-commercial-overview/, "Edge Function TypeScript syntax must be compiled in CI");

console.log("Platform commercial overview security and UI contract: PASS");
