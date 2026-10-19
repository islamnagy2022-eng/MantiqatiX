import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/business-register/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261019150000_rc531_business_registration_atomicity.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc531_business_registration_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc531_business_registration_integration.sql", "utf8");

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
assert.match(source, /const reader=req\.body\?\.getReader\(\)/);
assert.match(source, /if\(!body\|\|typeof body!=="object"\|\|Array\.isArray\(body\)\)return response\(\{error:"INVALID_JSON_BODY"\},400\)/);
assert.match(source, /let body:Record<string,unknown>\|null=null/);
assert.match(source, /try\{body=JSON\.parse\(rawBody\);\}catch\{body=null;\}/);

assert.match(source, /const \{data:existing,error:existingError\}=await supabase\.from\("approval_requests"\)/);
assert.match(source, /if\(existingError\)throw existingError/);

assert.match(source, /"Access-Control-Allow-Methods":"POST, OPTIONS"/);
assert.match(source, /"Cache-Control":"no-store"/);
assert.match(source, /"X-Content-Type-Options":"nosniff"/);
assert.match(source, /split\(";"\)\[0\]\.trim\(\)\.toLowerCase\(\)!=="application\/json"/);
assert.match(source, /REQUEST_BODY_TOO_LARGE/);
assert.match(source, /declaredLength>16384/);
assert.match(source, /totalBytes>16384/);
assert.match(source, /await reader\.cancel\(\)\.catch\(\(\)=>\{\}\)/);
assert.match(source, /new TextDecoder\("utf-8",\{fatal:true\}\)\.decode\(payloadBytes\)/);
assert.doesNotMatch(source, /req\.text\(\)/);
assert.match(source, /try\{body=JSON\.parse\(rawBody\);\}catch\{body=null;\}/);
assert.match(source, /stringFields=\["tenantId","name","sector","address","phone","city","district","organizationId"\]/);
assert.match(source, /INVALID_FIELD_TYPE/);

assert.match(source, /tenant_id and organization_id are varchar in the database contract/);
assert.match(source, /tenantId\.length>128\|\|\(organizationId!==null&&organizationId\.length>128\)/);
assert.ok(source.includes('/[\\u0000-\\u001F\\u007F]/'), "identifier validation must reject actual control characters");
assert.match(source, /INVALID_TENANT_OR_ORGANIZATION_ID/);
assert.doesNotMatch(source, /uuidPattern=/);
assert.match(source, /supabase\.rpc\("register_business_with_approval_atomic"/);
assert.match(source, /String\(m\.tenant_id\|\|""\)==="MNTY-PLATFORM"/);
assert.doesNotMatch(source, /supabase\.from\("businesses"\)\.insert/);
assert.doesNotMatch(source, /supabase\.from\("approval_requests"\)\.insert/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /Validate tenant ownership for every actor/);
assert.match(migration, /Validate the final organization even when it was inherited from membership/);
assert.match(migration, /o\.id = v_resolved_organization_id and o\.tenant_id = p_tenant_id/);
assert.match(migration, /m\.tenant_id in \(p_tenant_id, 'MNTY-PLATFORM'\)/);
assert.match(migration, /insert into public\.businesses[\s\S]*insert into public\.approval_requests/);
assert.match(migration, /grant execute on function public\.register_business_with_approval_atomic[\s\S]*to service_role/);
assert.match(migration, /revoke all on function public\.register_business_with_approval_atomic[\s\S]*from public, anon, authenticated/);
assert.match(fixture, /MEM-CORRUPT-ONLY[\s\S]*TENANT-A[\s\S]*ORG-B/);
assert.match(integration, /Inherited Corrupt Organization[\s\S]*ORGANIZATION_SCOPE_FORBIDDEN/);
assert.match(integration, /forced_approval_insert_failure[\s\S]*must roll back business insert/);
assert.match(integration, /TRUSTED_BUSINESS_REGISTRATION_REQUIRED[\s\S]*rejected-role call must not create a business/);
assert.match(integration, /set_config\(\x27request\.jwt\.claim\.role\x27,\x27authenticated\x27,true\)/);

console.log("business-register tenant and organization security contract: PASS (53 assertions)");
