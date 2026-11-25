import fs from 'node:fs';
import assert from 'node:assert/strict';

const home=fs.readFileSync('web/home.js','utf8');
const app=fs.readFileSync('web/app.js','utf8');

assert.match(home,/const selectedId=window\.MNTYActiveMembershipId\|\|localStorage\.getItem\('MNTYActiveMembershipId'\)/);
assert.match(home,/\.eq\('id',selectedId\)\.eq\('user_id',authUser\.id\)\.eq\('status','ACTIVE'\)/);
assert.match(home,/\.eq\('business_id',businessId\)\.eq\('status','ACTIVE'\)/);
assert.doesNotMatch(home,/\.eq\('owner_user_id',authUser\.id'\)\.eq\('status','ACTIVE'\).*\.order\('updated_at'/s);
assert.match(app,/const active=savedId\?live\.memberships\.find\(m=>String\(m\.id\)===String\(savedId\)\):live\.memberships\[0\]/);
assert.match(app,/\.eq\('business_id',live\.businessId\)\.eq\('status','ACTIVE'\)/);
assert.doesNotMatch(app,/marketing_provider_profiles'\).*\.eq\('owner_user_id',uid\).*\.order\('updated_at'/s);
console.log('Issue #96 selected-membership activity scoping regression checks: PASS');
