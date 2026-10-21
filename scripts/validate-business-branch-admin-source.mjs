import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/business-branch-admin/index.ts", "utf8");

assert.doesNotMatch(source, /\\n/, "source must not contain literal backslash-n sequences outside strings");
assert.match(source, /if\(me\)return out\(\{error:"MEMBERSHIP_READ_FAILED"\},500\)/, "membership query errors must fail closed");
assert.match(source, /BUSINESS_MANAGEMENT_REQUIRED/, "branch creation must remain role-gated");
assert.match(source, /SUPER_ADMIN/, "platform admin branch must remain explicitly scoped");
assert.match(source, /if\(be\|\|!business\)/, "business existence must remain checked");
assert.match(source, /BUSINESS_NOT_ACTIVE/, "inactive businesses must remain blocked");

assert.match(source, /if\(ie\)return out\(\{error:"BRANCH_CREATE_FAILED"\},400\)/, "branch insert failures must not expose database error text");
assert.doesNotMatch(source, /ie\.message/, "branch insert failures must not return ie.message");

assert.match(source, /uuidPattern=\/\^\[0-9a-f\]\{8\}/, "tenant and business IDs must be validated before filter interpolation");
assert.match(source, /organization_id:business\.organization_id\?\?null/, "branch organization must be derived from the authorized business record");
assert.doesNotMatch(source, /organization_id:body\.organizationId/, "caller must not override branch organization scope");
assert.match(source, /phone\.length>64\|\|address\.length>500/, "branch contact fields must be length-bounded");
assert.match(source, /latitude < -90\|\|latitude > 90/, "latitude must be range-validated");
assert.match(source, /longitude < -180\|\|longitude > 180/, "longitude must be range-validated");
assert.match(source, /INVALID_COORDINATES/, "invalid or partial coordinates must be rejected");
assert.match(source, /import \\{ parseOptionalCoordinate \\} from "\\.\\.\\/_shared\\/branch-coordinates\\.mjs"/, "branch endpoint must use the shared tested coordinate parser");
assert.match(source, /latitude=parseOptionalCoordinate\\(input\\.latitude\\),longitude=parseOptionalCoordinate\\(input\\.longitude\\)/, "both coordinates must use the guarded parser before range and pair validation");
assert.match(source, /BRANCH_CREATE_FAILED/, "database errors must be normalized before returning to the client");
assert.match(source, /contentLength>maxBodyBytes/, "oversized declared request bodies must be rejected");
assert.match(source, /totalBytes>maxBodyBytes/, "streamed bodies must be capped even without Content-Length");
assert.match(source, /REQUEST_TOO_LARGE/, "oversized requests must receive a stable error code");
assert.match(source, /!body\|\|typeof body!=="object"\|\|Array\.isArray\(body\)/, "null, primitive, and array request bodies must be rejected");
assert.match(source, /INVALID_REQUEST_BODY/, "malformed JSON shapes must receive a stable error code");
assert.match(source, /typeof input\.tenantId!=="string"/, "tenant IDs must not be coerced from arbitrary JSON types");
assert.match(source, /typeof input\.phone!=="string"/, "phone must be a string when supplied");

console.log("Business branch admin source integrity contract: PASS");
