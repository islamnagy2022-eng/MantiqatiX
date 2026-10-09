import fs from "node:fs";
import assert from "node:assert/strict";

const home = fs.readFileSync("web/home.js", "utf8");
const app = fs.readFileSync("web/app.js", "utf8");

// Homepage identity must follow a membership selected by the signed-in user,
// not the most recently updated provider profile across all their businesses.
assert.match(home, /MNTYActiveMembershipId\|\|localStorage\.getItem\('MNTYActiveMembershipId'\)/);
assert.match(home, /from\('user_memberships'\)[\s\S]*?\.eq\('id',savedMembershipId\)[\s\S]*?\.eq\('user_id',authUser\.id\)[\s\S]*?\.eq\('status','ACTIVE'\)/);
assert.match(home, /from\('marketing_provider_profiles'\)[\s\S]*?\.eq\('owner_user_id',authUser\.id\)[\s\S]*?\.eq\('business_id',businessId\)[\s\S]*?\.eq\('status','ACTIVE'\)/);
assert.doesNotMatch(home, /from\('marketing_provider_profiles'\)\.select\('name_ar,name_en'\)\.eq\('owner_user_id',authUser\.id\)\.eq\('status','ACTIVE'\)\.order\('updated_at'/);

// The account center must not choose an unrelated provider profile by owner alone.
assert.match(app, /const myProviderRes=live\.businessId[\s\S]*?\.eq\('owner_user_id',uid\)\.eq\('business_id',live\.businessId\)/);
assert.doesNotMatch(app, /from\('marketing_provider_profiles'\)\.select\('id,business_id,name_ar,name_en,provider_kind,description,service_areas,profile_image_path,settings,updated_at,status,is_verified,is_featured'\)\.eq\('owner_user_id',uid\)\.order\('updated_at'/);

console.log("Selected-business account label contract: PASS (6 assertions)");
