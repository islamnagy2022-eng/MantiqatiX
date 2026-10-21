import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/business-branch-admin/index.ts", "utf8");
const coordinateParser = fs.readFileSync("supabase/functions/_shared/branch-coordinates.mjs", "utf8");
const authorizationPolicy = fs.readFileSync("supabase/functions/_shared/branch-authorization.mjs", "utf8");
const bearerTokenParser = fs.readFileSync("supabase/functions/_shared/bearer-token.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/business-branch-admin-source-integrity.yml", "utf8");

assert.doesNotMatch(source, /\\n/, "source must not contain literal backslash-n sequences outside strings");
assert.match(source, /if\(me\)return out\(\{error:"MEMBERSHIP_READ_FAILED"\},500\)/, "membership query errors must fail closed");
assert.match(source, /parseBearerToken\(req\.headers\.get\("Authorization"\)\)/, "endpoint must parse a strict bearer token before calling auth");
assert.match(source, /if\(!token\)return out\(\{error:"AUTH_REQUIRED"\},401\)/, "missing or malformed bearer credentials must be rejected");
assert.match(source, /db\.auth\.getUser\(token\)/, "auth verification must receive only the parsed token");
assert.ok(bearerTokenParser.includes("const match = /^Bearer[") && bearerTokenParser.includes("/i.exec"), "bearer parser must recognize the HTTP authorization scheme case-insensitively");
assert.ok(bearerTokenParser.includes("([A-Za-z0-9._~+/-]+=*)"), "bearer parser must restrict tokens to a single token value");
assert.equal((workflow.match(/supabase\/functions\/_shared\/bearer-token\.mjs/g)||[]).length, 2, "bearer parser must trigger source-integrity workflow on both push and pull_request");
assert.equal((workflow.match(/scripts\/test-bearer-token\.mjs/g)||[]).length, 2, "bearer parser tests must trigger source-integrity workflow on both push and pull_request");
assert.match(source, /isBranchCreationAuthorized\(membership\|\|\[\],businessId\)/, "branch endpoint must enforce the shared tested authorization policy");
assert.match(source, /BUSINESS_MANAGEMENT_REQUIRED/, "branch creation must remain role-gated");
assert.match(authorizationPolicy, /BUSINESS_MANAGER_ROLES/, "shared policy must use an explicit business-manager role allowlist");
assert.match(authorizationPolicy, /scopedBusinessId\s*===\s*businessId/, "business manager roles must be scoped to the exact business");
assert.match(authorizationPolicy, /membership\.permissions\?\.scope\s*===\s*"PLATFORM"/, "platform admin must require explicit platform scope");
assert.match(authorizationPolicy, /membership\.permissions\?\.full_control\s*===\s*true/, "platform admin must require explicit full-control permission");
assert.match(source, /if\(be\|\|!business\)/, "business existence must remain checked");
assert.match(source, /BUSINESS_NOT_ACTIVE/, "inactive businesses must remain blocked");
assert.match(source, /\.eq\("user_id",user\.id\)\.eq\("tenant_id",tenantId\)\.eq\("status","ACTIVE"\)/, "membership lookup must be scoped to the authenticated user, requested tenant, and active status");
assert.match(source, /\.eq\("id",businessId\)\.eq\("tenant_id",tenantId\)\.single\(\)/, "business lookup must bind business ID and tenant ID in the same query");
assert.ok(source.indexOf("db.auth.getUser") < source.indexOf('from("user_memberships")'), "identity must be verified before membership lookup");
assert.ok(source.indexOf("if(!isBranchCreationAuthorized") < source.indexOf('from("businesses")'), "membership authorization must be enforced before business lookup");
assert.ok(source.indexOf("if(coordinates.error)") < source.indexOf('from("user_memberships")'), "invalid coordinates must be rejected before database reads");
assert.ok(source.indexOf("if(!isBranchCreationAuthorized") < source.indexOf('.from("branches").insert'), "authorization must be enforced before branch writes");

assert.match(source, /if\(ie\)return out\(\{error:"BRANCH_CREATE_FAILED"\},400\)/, "branch insert failures must not expose database error text");
assert.doesNotMatch(source, /ie\.message/, "branch insert failures must not return ie.message");

assert.match(source, /uuidPattern=\/\^\[0-9a-f\]\{8\}/, "tenant and business IDs must be validated before filter interpolation");
assert.match(source, /organization_id:business\.organization_id\?\?null/, "branch organization must be derived from the authorized business record");
assert.doesNotMatch(source, /organization_id:body\.organizationId/, "caller must not override branch organization scope");
assert.match(source, /phone\.length>64\|\|address\.length>500/, "branch contact fields must be length-bounded");
assert.match(coordinateParser, /latitude\s*<\s*-90\s*\|\|\s*latitude\s*>\s*90/, "shared coordinate parser must range-validate latitude");
assert.match(coordinateParser, /longitude\s*<\s*-180\s*\|\|\s*longitude\s*>\s*180/, "shared coordinate parser must range-validate longitude");
assert.match(coordinateParser, /INVALID_COORDINATES/, "shared coordinate parser must reject invalid or partial coordinates");
assert.ok(source.includes('import { parseBranchCoordinates } from "../_shared/branch-coordinates.mjs"'), "branch endpoint must use the shared tested coordinate parser");
assert.ok(source.includes("const coordinates=parseBranchCoordinates(input.latitude,input.longitude)"), "endpoint must use tested pair and range validation");
assert.ok(source.includes("if(coordinates.error)return out({error:coordinates.error},400)"), "invalid coordinate input must be rejected before database writes");
assert.match(source, /BRANCH_CREATE_FAILED/, "database errors must be normalized before returning to the client");
assert.match(source, /contentLength>maxBodyBytes/, "oversized declared request bodies must be rejected");
assert.match(source, /totalBytes>maxBodyBytes/, "streamed bodies must be capped even without Content-Length");
assert.match(source, /REQUEST_TOO_LARGE/, "oversized requests must receive a stable error code");
assert.match(source, /if\(totalBytes>maxBodyBytes\)\{try\{await reader\.cancel\(\)\}catch\{\}return out\(\{error:"REQUEST_TOO_LARGE"\},413\)\}/, "stream cancellation failures must not downgrade oversized-body responses to invalid JSON");
assert.match(source, /!body\|\|typeof body!=="object"\|\|Array\.isArray\(body\)/, "null, primitive, and array request bodies must be rejected");
assert.match(source, /INVALID_REQUEST_BODY/, "malformed JSON shapes must receive a stable error code");
assert.match(source, /typeof input\.tenantId!=="string"/, "tenant IDs must not be coerced from arbitrary JSON types");
assert.match(source, /typeof input\.phone!=="string"/, "phone must be a string when supplied");

console.log("Business branch admin source integrity contract: PASS");
