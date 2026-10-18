import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/business-register/index.ts", "utf8");

assert.match(source, /const requestedOrganizationId=organizationId\?\.trim\(\)\|\|null/);
assert.match(source, /allowedRoles\.has\(String\(m\.role\|\|""\)\.toUpperCase\(\)\)\s*&&\s*\(!requestedOrganizationId \|\| String\(m\.organization_id\|\|""\)===requestedOrganizationId\)/);
assert.match(source, /if\(requestedOrganizationId&&!superAdmin&&String\(membership\?\.organization_id\|\|""\)!==requestedOrganizationId\)\s*\{\s*return response\(\{error:"ORGANIZATION_SCOPE_FORBIDDEN"\},403\);/);
assert.match(source, /from\("organizations"\)[\s\S]{0,180}\.eq\("id",requestedOrganizationId\)\.eq\("tenant_id",tenantId\)\.maybeSingle\(\)/);
assert.match(source, /if\(organizationError\)throw organizationError;\s*if\(!organization\)return response\(\{error:"ORGANIZATION_SCOPE_FORBIDDEN"\},403\);/);
assert.match(source, /resolvedOrganizationId=\(requestedOrganizationId&&superAdmin\)\?requestedOrganizationId:\(membership\?\.organization_id\|\|null\)/);
// Regression guard: keep tenant ownership checks mandatory whenever the service-role function accepts an organization ID.\nassert.match(source, /const resolvedOrganizationId=\(requestedOrganizationId&&superAdmin\)\?requestedOrganizationId:\(membership\?\.organization_id\|\|null\)/);\nconsole.log("business-register organization scope contract: PASS (7 assertions)");
