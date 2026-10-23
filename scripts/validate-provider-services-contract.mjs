import fs from "node:fs";
import assert from "node:assert/strict";

const ui = fs.readFileSync("web/operations-modules.js", "utf8");
const rls = fs.readFileSync("supabase/migrations/20260928010000_rc99_g5_provider_services_rls_hardening.sql", "utf8");
const baseline = fs.readFileSync("docs/RC100_G5_PROVIDER_PROFILE_SERVICES_BASELINE.md", "utf8");

assert.match(ui, /function providerServicesWorkspace\(d\)/, "provider services workspace must exist");
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
assert.match(ui, /Number\.isFinite\(from\).*from<0/s, "prices must be finite and non-negative");
assert.match(ui, /to<from/, "price range must reject inverted ranges");
assert.match(ui, /const catalog=\(rows\.marketing_services\|\|\[\]\)\.filter\(s=>String\(s\.status\|\|''\)\.toUpperCase\(\)==='ACTIVE'\)/, "only active catalog services should be selectable");
assert.match(rls, /marketing_provider_services_owner_manage[\s\S]*owner_user_id = auth\.uid\(\)/, "existing RLS must enforce provider profile ownership");
assert.match(baseline, /no dedicated generic provider-availability\/location table/i, "do not invent a generic availability table");
assert.doesNotMatch(ui, /create table|availability_slots|provider_availability/i, "UI must not introduce a new availability model");

console.log("Provider services contract passed: owner checks, RLS boundary, existing schema only, validation, and server-response guard.");
console.log("Live two-account isolation and browser E2E remain NOT VERIFIED until executed with separate real test accounts.");
