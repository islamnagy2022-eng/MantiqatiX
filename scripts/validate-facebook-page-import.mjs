import fs from "node:fs";
import assert from "node:assert/strict";

const frontend = fs.readFileSync("apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx", "utf8");
const browserConfig = fs.readFileSync("apps/catalog-frontend/public/config.js", "utf8");
const backend = fs.readFileSync("supabase/functions/facebook-page-import/index.ts", "utf8");
const functionConfig = fs.readFileSync("supabase/config.toml", "utf8");
const primaryWorkflow = fs.readFileSync(".github/workflows/primary-catalog-frontend.yml", "utf8");
const pagesWorkflow = fs.readFileSync(".github/workflows/pages.yml", "utf8");

assert.match(frontend, /pages_show_list,pages_read_engagement/, "Facebook login must request only the Page-list and Page-read scopes needed for import.");
assert.match(frontend, /supabase\.functions\.invoke\('facebook-page-import'/, "The browser must use the scoped server import function.");
assert.match(frontend, /setFacebookPreview\(result\.profile as FacebookPageProfile\)/, "The returned Facebook profile must be previewed before it is applied.");
assert.match(frontend, /const handleApplyFacebookProfile/, "The activity owner must explicitly apply the selected Facebook profile.");
assert.match(frontend, /setBizLogoUrl\(profile\.logoUrl\)[\s\S]{0,220}setBizCoverUrl\(profile\.coverUrl\)[\s\S]{0,220}setBizBio\(profile\.bio\)[\s\S]{0,220}setBizAddress\(profile\.address\)[\s\S]{0,220}setBizWorkingHours\(profile\.workingHours\)/, "The preview import must support logo, cover, bio, address, and opening hours.");
assert.match(frontend, /لن تتغير بيانات النشاط المحفوظة حتى تستخدم البيانات المعروضة/, "The UI must make the import review-before-save behavior explicit.");
assert.doesNotMatch(frontend, /localStorage\.(?:setItem|getItem)\([^\n]*facebook|sessionStorage\.(?:setItem|getItem)\([^\n]*facebook/i, "Facebook access tokens must not be persisted in browser storage.");

assert.match(browserConfig, /facebookAppId:\s*''/, "The public configuration needs a non-secret Meta App ID slot.");
assert.doesNotMatch(browserConfig, /META_APP_SECRET|FACEBOOK_APP_SECRET|appSecret/i, "The Meta App Secret must never appear in public browser configuration.");
assert.match(functionConfig, /\[functions\.facebook-page-import\][\s\S]*?verify_jwt\s*=\s*true/, "The Edge Function must require a Supabase-authenticated caller.");

assert.match(backend, /service\.auth\.getUser\(accessToken\)/, "The server must validate the Supabase user session.");
assert.match(backend, /\.eq\("user_id", user\.id\)[\s\S]*?\.eq\("business_id", businessId\)[\s\S]*?\.eq\("status", "ACTIVE"\)/, "Only an active membership scoped to this activity may import Page data.");
assert.match(backend, /permissions\.account_restricted !== true/, "Restricted accounts must not import profile data.");
assert.match(backend, /META_APP_ID[\s\S]*?META_APP_SECRET/, "Meta credentials must be read from server-side environment secrets.");
assert.match(backend, /\/debug_token[\s\S]*?data\.app_id[\s\S]*?pages_show_list[\s\S]*?pages_read_engagement/, "The server must validate token app ownership and required scopes.");
assert.match(backend, /\/me\/accounts[\s\S]*?access_token/, "The server must look up pages the connected Facebook user manages.");
assert.match(backend, /FACEBOOK_PAGE_NOT_MANAGED/, "The server must reject pages outside the connected user's managed Page list.");
assert.match(backend, /function safePageList[\s\S]*?return \{[\s\S]*?id:[\s\S]*?name:[\s\S]*?link:[\s\S]*?category:[\s\S]*?\};/, "The page picker must return page metadata only.");
const safePageListBlock = backend.slice(backend.indexOf("function safePageList"), backend.indexOf("async function graphJson"));
assert.doesNotMatch(safePageListBlock, /access_token/, "Page access tokens must not be returned to the browser.");
assert.match(backend, /picture\.type\(large\),cover,about,bio,description,single_line_address,location,hours,is_always_open/, "The Graph API request must include all requested profile fields.");
assert.match(backend, /FACEBOOK_APP_NOT_CONFIGURED/, "Missing production Meta credentials must fail closed with an actionable response.");
assert.match(primaryWorkflow, /validate-facebook-page-import\.mjs/, "Primary catalog validation must run the Facebook import security contract.");
assert.match(primaryWorkflow, /supabase\/functions\/facebook-page-import\/\*\*/, "The primary catalog workflow must react to Edge Function changes.");
assert.match(pagesWorkflow, /validate-facebook-page-import\.mjs/, "The production Pages workflow must run the Facebook import contract.");

console.log("FACEBOOK_PAGE_IMPORT_SECURITY_CONTRACT=PASS");
