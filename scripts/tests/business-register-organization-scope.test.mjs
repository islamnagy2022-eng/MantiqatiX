import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/business-register/index.ts", "utf8");

assert.match(source, /const requestedOrganizationId=organizationId\?\.trim\(\)\|\|null/);
assert.match(source, /allowedRoles\.has\(String\(m\.role\|\|""\)\.toUpperCase\(\)\)\s*&&\s*\(!requestedOrganizationId \|\| String\(m\.organization_id\|\|""\)===requestedOrganizationId\)/);
assert.match(source, /if\(requestedOrganizationId&&!superAdmin&&String\(membership\?\.organization_id\|\|""\)!==requestedOrganizationId\)\s*\{\s*return response\(\{error:"ORGANIZATION_SCOPE_FORBIDDEN"\},403\);/);
assert.match(source, /from\("organizations"\)[\s\S]{0,180}\.eq\("id",requestedOrganizationId\)\.eq\("tenant_id",tenantId\)\.maybeSingle\(\)/);
assert.match(source, /if\(organizationError\)throw organizationError;\s*if\(!organization\)return response\(\{error:"ORGANIZATION_SCOPE_FORBIDDEN"\},403\);/);
assert.match(source, /resolvedOrganizationId=\(requestedOrganizationId&&superAdmin\)\?requestedOrganizationId:\(membership\?\.organization_id\|\|null\)/);
assert.doesNotMatch(source, /resolvedOrganizationId=organizationId\|\|membership\?\.organization_id/);
assert.match(source, /from\("tenants"\)[\s\S]{0,100}\.eq\("id",tenantId\)\.eq\("status","ACTIVE"\)\.maybeSingle\(\)/);
assert.match(source, /if\(tenantError\)throw tenantError;\s*if\(!tenant\)return response\(\{error:"ACTIVE_TENANT_REQUIRED"\},403\);/);
assert.match(source, /console\.error\("business-register failed",error instanceof Error\?error\.message:"unknown_error"\)/);
assert.match(source, /return response\(\{error:"BUSINESS_REGISTER_FAILED"\},500\)/);
assert.doesNotMatch(source, /return response\(\{error:error instanceof Error\?error\.message/);
assert.match(source, /const body=await req\.json\(\)\.catch\(\(\)=>null\)/);
assert.match(source, /if\(!body\|\|typeof body!=="object"\|\|Array\.isArray\(body\)\)return response\(\{error:"INVALID_JSON_BODY"\},400\)/);

assert.match(source, /const \{data:existing,error:existingError\}=await supabase\.from\("approval_requests"\)/);
assert.match(source, /if\(existingError\)throw existingError/);

assert.match(source, /"Access-Control-Allow-Methods":"POST, OPTIONS"/);
assert.match(source, /"Cache-Control":"no-store"/);
assert.match(source, /"X-Content-Type-Options":"nosniff"/);
assert.match(source, /UNSUPPORTED_MEDIA_TYPE/);
assert.match(source, /stringFields=\["tenantId","name","sector","address","phone","city","district","organizationId"\]/);
assert.match(source, /INVALID_FIELD_TYPE/);

assert.match(source, /uuidPattern=\/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i/);
assert.match(source, /INVALID_TENANT_OR_ORGANIZATION_ID/);

console.log("business-register tenant and organization security contract: PASS (24 assertions)");
