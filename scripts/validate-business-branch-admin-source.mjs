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

console.log("Business branch admin source integrity contract: PASS");
