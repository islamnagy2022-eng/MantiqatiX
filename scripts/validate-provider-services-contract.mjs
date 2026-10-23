import fs from "node:fs";
import assert from "node:assert/strict";

const ui = fs.readFileSync("web/operations-modules.js", "utf8");
const rls = fs.readFileSync("supabase/migrations/20260928010000_rc99_g5_provider_services_rls_hardening.sql", "utf8");
const grants = fs.readFileSync("supabase/migrations/20261023020000_rc102_provider_services_owner_write_grants.sql", "utf8");
const baseline = fs.readFileSync("docs/RC100_G5_PROVIDER_PROFILE_SERVICES_BASELINE.md", "utf8");
const integration = fs.readFileSync("supabase/tests/rc102_provider_services_integration.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc102_provider_services_fixture.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/provider-services-owner-isolation.yml", "utf8");

assert.match(ui, /function providerServicesWorkspace\(d\)/, "provider services workspace must exist");
assert.match(ui, /function filterTable\(id,label,h,rs\)/, "shared filterable table helper must exist");
for(const id of ["marketing-provider-search","marketing-catalog-search","legal-doc-search","legal-req-search","maintenance-request-search"]) assert.ok(ui.includes('filterTable(\''+id+'''), "search UI must be wired for "+id);
assert.match(ui, /data-generic-filter-row/, "filterable table rows must include search metadata");
assert.match(ui, /data-generic-filter-count/, "filterable tables must expose matching result counts");
assert.match(ui, /id="psLinkSearch"/, "provider services workspace must expose a searchable service list");
assert.match(ui, /id="psLinkStatus"/, "provider services workspace must expose a status filter");
assert.match(ui, /data-provider-service-row data-status=/, "provider service rows must expose safe filter metadata");
assert.match(ui, /const filterProviderLinks=\(\)=>\{[\s\S]*data-provider-service-row[\s\S]*psLinkCount/, "provider service search and status filters must update visible rows and result count");
assert.match(ui, /d\.key==='MARKETING'&&tab==='provider-services'&&t==='marketing_provider_profiles'\)\{q=sb\.from\(t\)\.select\('id,owner_user_id,name_ar,name_en,slug,service_areas,status'\)\.eq\('owner_user_id',user\.id\)/,
  "provider-services tab must query only the current user's profiles and only required profile fields");
assert.match(ui, /d\.key==='MARKETING'&&tab==='provider-services'&&t==='marketing_services'\)\{q=sb\.from\(t\)\.select\('id,name_ar,name_en,code,status'\)\.eq\('status','ACTIVE'\)/,
  "provider-services tab must fetch only active catalog services and required fields");
assert.match(ui, /d\.key==='MARKETING'&&tab==='provider-services'&&t==='marketing_provider_services'\)\{const providerIds=\(rows\.marketing_provider_profiles\|\|\[\]\)\.filter\(p=>p\.owner_user_id===user\.id\)\.map\(p=>p\.id\)\.filter\(Boolean\);if\(!providerIds\.length\)\{rows\[t\]=\[\];continue\}q=sb\.from\(t\)\.select\('provider_id,service_id,service_description,pricing_from,pricing_to,currency,status'\)\.in\('provider_id',providerIds\)/,
  "provider-service link reads must be restricted to owned profile IDs and avoid fetching unrelated columns");

assert.match(ui, /\.filter\(p=>p\.owner_user_id===user\?\.id\)/, "UI must list only profiles owned by current user");
assert.match(ui, /async function providerServiceOwner\(providerId\)/, "mutations must re-check ownership");
assert.match(ui, /async function saveProviderServiceAreas\(\)/, "service area editing must use existing provider profile field");
assert.match(ui, /update\(\{service_areas:areas\}\)\.eq\('id',providerId\)\.eq\('owner_user_id',user\.id\)/, "service area writes must be constrained to owned profile");
assert.match(ui, /if\(areas.length>50\)/, "service area input must have a bounded item count");
assert.match(ui, /\.eq\('owner_user_id',user\.id\)\.maybeSingle\(\)/, "ownership must be checked against the current authenticated user");
assert.match(ui, /if\(!owner\)return alert\('تم رفض العملية: الحساب الحالي ليس مالك ملف مقدم الخدمة\.'\)/, "mutations must fail closed when ownership is absent");
assert.match(ui, /\.from\('marketing_provider_services'\)\.insert\(/, "add must use existing provider-services table");
assert.match(ui, /\.from\('marketing_provider_services'\)\.update\(/, "edit/status changes must use existing provider-services table");
assert.match(ui, /\.from\('marketing_provider_services'\)\.delete\(/, "remove must use existing provider-services table");
assert.match(ui, /\.eq\('provider_id',providerId\)\.eq\('service_id',serviceId\)/, "mutations must constrain both provider and service keys");
assert.match(ui, /if\(!result\.data\?\.length\)/, "UI must not claim success without returned server rows");
assert.match(ui, /const validPrice=n=>n===null\|\|\(Number\.isFinite\(n\)&&n>=0&&n<=100000000&&Math\.round\(n\*100\)\/100===n\)/, "provider service prices must be finite, non-negative, capped, and limited to two decimal places without floating-point false rejects");
assert.match(ui, /to<from/, "price range must reject inverted ranges");
assert.match(ui, /const catalog=\(rows\.marketing_services\|\|\[\]\)\.filter\(s=>String\(s\.status\|\|''\)\.toUpperCase\(\)==='ACTIVE'\)/, "only active catalog services should be selectable");
assert.match(rls, /marketing_provider_services_owner_manage[\s\S]*owner_user_id = auth\.uid\(\)/, "existing RLS must enforce provider profile ownership");
assert.match(grants, /grant\s+insert\s*,\s*update\s*,\s*delete\s+on\s+table\s+public\.marketing_provider_services\s+to\s+authenticated\s*;/i, "authenticated mutations must have table privileges so owner-scoped RLS can authorize them");
assert.doesNotMatch(grants, /grant\s+[^;]+\s+to\s+(anon|public|service_role)\b/i, "provider service mutation grants must not be broadened to anon, public, or service_role");
assert.match(baseline, /no dedicated generic provider-availability\/location table/i, "do not invent a generic availability table");
assert.doesNotMatch(ui, /create table|availability_slots|provider_availability/i, "UI must not introduce a new availability model");
assert.match(fixture, /enable row level security/i, "disposable fixture must enable RLS");
assert.match(integration, /cross-owner insert was accepted/, "integration test must reject cross-owner inserts");
assert.match(integration, /transferred a service to owner B profile/, "integration test must reject cross-owner ownership changes");
assert.match(integration, /anonymous Auth session wrote a provider service/, "integration test must reject anonymous Auth sessions");
assert.match(workflow, /image: postgres:16/, "provider isolation test must use disposable PostgreSQL 16");
assert.match(workflow, /rc99_policy\.sql[\s\S]*rc102_grants\.sql[\s\S]*rc102_test\.sql/, "workflow must apply existing RLS policy before grants and behavior tests");

const validProviderPrice = n => Number.isFinite(n) && n >= 0 && n <= 100000000 && Math.round(n * 100) / 100 === n;
assert.equal(validProviderPrice(0.29), true, "valid 29-piastre price must not fail due to binary floating-point scaling");
assert.equal(validProviderPrice(1.234), false, "provider prices must reject more than two decimal places");
assert.equal(validProviderPrice(-0.01), false, "provider prices must reject negative values");
assert.equal(validProviderPrice(100000001), false, "provider prices must reject values over the configured maximum");

console.log("Provider services contract passed: owner checks, RLS boundary, existing schema only, validation, and server-response guard.");
console.log("Disposable PostgreSQL owner-isolation test is wired into CI; live two-account isolation and browser E2E remain NOT VERIFIED until executed with separate real test accounts.");
