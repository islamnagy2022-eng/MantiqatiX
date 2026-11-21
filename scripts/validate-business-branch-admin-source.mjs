import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/business-branch-admin/index.ts", "utf8");

assert.doesNotMatch(source, /\\n/, "source must not contain literal backslash-n sequences outside strings");
assert.match(source, /if\(me\)return out\(\{error:"MEMBERSHIP_READ_FAILED"\},500\)/, "membership query errors must fail closed");
assert.match(source, /BUSINESS_MANAGEMENT_REQUIRED/, "branch creation must remain role-gated");
assert.match(source, /registryClient\.rpc\("mnty_can_platform_admin"\)/, "platform root must use the canonical private registry");
assert.match(source, /isPlatformAdmin=registryResult===true/, "registry failures and false results must fail closed");
assert.match(source, /String\(m\.branch_id\|\|\"\"\)===""/, "branch-scoped managers must not create additional business branches");
assert.doesNotMatch(source, /permissions\?\.scope\s*===\s*["']PLATFORM["']/, "membership metadata must not confer platform-root authority");
assert.match(source, /user\.is_anonymous/, "anonymous users must not create branches");
assert.match(source, /if\(be\|\|!business\)/, "business existence must remain checked");
assert.match(source, /BUSINESS_NOT_ACTIVE/, "inactive businesses must remain blocked");

console.log("Business branch admin source integrity contract: PASS");
