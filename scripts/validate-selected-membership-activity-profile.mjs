import fs from "node:fs";
import assert from "node:assert/strict";

const home = fs.readFileSync("web/home.js", "utf8");
const app = fs.readFileSync("web/app.js", "utf8");

assert.match(home, /const selectedMembershipId=String\\(window\\.MNTYActiveMembershipId\\|\\|localStorage\\.getItem\\('MNTYActiveMembershipId'\\)\\|\\|''\\)\\.trim\\(\\)/);
assert.match(home, /from\('user_memberships'\)\.select\('id,business_id'\)\.eq\('id',selectedMembershipId\)\.eq\('user_id',authUser\.id\)\.eq\('status','ACTIVE'\)\.maybeSingle\(\)/);
assert.match(home, /from\('marketing_provider_profiles'\)[\s\S]{0,260}\.eq\('business_id',selectedBusinessId\)/);
assert.match(home, /from\('businesses'\)\.select\('name'\)\.eq\('id',selectedBusinessId\)/);
assert.doesNotMatch(home, /from\('marketing_provider_profiles'\)\.select\('name_ar,name_en'\)\.eq\('owner_user_id',authUser\.id'\)\.eq\('status','ACTIVE'\)\.order\('updated_at'/);

assert.match(app, /const active=savedId\?live\.memberships\.find\(m=>m\.id===savedId\):live\.memberships\[0\]/);
assert.match(app, /if\(active\.business_id\)\{[\s\S]{0,500}\.eq\('owner_user_id',uid\)\.eq\('business_id',active\.business_id\)/);
assert.doesNotMatch(app, /from\('marketing_provider_profiles'\)[^\n]*\.eq\('owner_user_id',uid\)\.order\('updated_at',\{ascending:false\}\)\.limit\(1\)\.maybeSingle\(\)/);

console.log("Selected membership activity-profile boundary: PASS (8 source-contract assertions)");
