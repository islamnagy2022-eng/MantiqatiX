import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");

assert.match(app, /function marketingCampaignWorkspace\(\)/, "campaign workspace must be rendered");
assert.match(app, /function marketingAgencyWorkspace\(\)/, "agency workspace must remain available");
assert.match(app, /function bindMarketingAgencyWorkspace\(\)/, "agency tabs must be interactive");
assert.match(app, /function bindMarketingCampaignWorkspace\(\)/, "campaign actions must be interactive");
assert.match(app, /async function loadMarketingCampaignData\(\)/, "campaign reads must use a dedicated loader");
assert.match(app, /marketing_campaigns'\)\.select\('id,business_id,title,objective,channels,budget,currency,status,start_at,end_at,created_at,brief'/, "campaign reads must use an explicit field allowlist");
assert.match(app, /from\('marketing_campaigns'\)\.select\([\s\S]{0,300}?\.eq\('business_id',live\.businessId\)/, "campaign reads must be scoped to the active business");
assert.match(app, /if\(!live\.businessId\)[\s\S]{0,300}NO_ACTIVE_BUSINESS/, "no active business must fail closed without a broad campaign read");
assert.match(app, /marketingCampaignUnavailableReason==='NO_ACTIVE_BUSINESS'/, "missing business scope must show a truthful fallback notice");
assert.match(app, /from\('marketing_campaign_participants'\)\.select\([\s\S]{0,300}?\.eq\('business_id',live\.businessId\)/, "participant reads must be scoped to the active business");
assert.match(app, /filter\(c=>activeBusinessId&&String\(c\.business_id\|\|''\)===activeBusinessId\)/, "campaign display must enforce active-business scope");

assert.match(app, /marketing_campaign_participants'\)\.select\('id,business_id,campaign_id,provider_id,role,allocation_percent,agreed_value,status,responded_at,created_at'/, "participant reads must use an explicit field allowlist");
assert.match(app, /live\.marketingCampaignErrors\.push\('marketing_campaigns'\)/, "failed campaign reads must not be presented as empty");
assert.match(app, /live\.marketingCampaignUnavailable=/, "missing RC453 schema must be detected explicitly");
assert.match(app, /function marketingWorkspaceEntry\(\)/, "marketing entry must fail safely when RC453 is not deployed");
assert.match(app, /if\(live\.marketingCampaignUnavailable\)return[\s\S]{0,350}marketingAgencyWorkspace\(\)/, "missing campaign tables must retain the existing agency workspace");
assert.match(app, /case 'التسويق والإعلان': return marketingWorkspaceEntry\(\);/, "marketing route must use the guarded workspace entry");
assert.match(app, /if\(current==='التسويق والإعلان'\)await loadMarketingCampaignData\(\);await loadDomainModule\(current\)/, "campaign data must load before rendering the marketing workspace");
assert.match(app, /const canManage=Boolean\(live\.businessId[\s\S]{0,250}marketing_campaign_participants/, "campaign mutations must be disabled when campaign read sources fail");
assert.match(app, /create_marketing_campaign_backend/, "campaign creation must use the backend RPC");
assert.match(app, /invite_marketing_campaign_partner_backend/, "partner invitation must use the backend RPC");
assert.match(app, /respond_marketing_campaign_invitation_backend/, "partner response must use the backend RPC");
assert.match(app, /update_marketing_campaign_status_backend/, "campaign status changes must use the backend RPC");
assert.match(app, /p_actor:user\.id/, "actor identity must come from the authenticated session");
assert.match(app, /id="mc-idempotency-key"/, "campaign form must include an idempotency key");
assert.match(app, /sessionStorage\.setItem\(campaignIdempotencyStorageKey,key\)/, "campaign retry key must survive reload");
assert.doesNotMatch(app, /sb\.from\(['"]marketing_campaigns['"]\)\.(insert|update|delete)/, "browser must not mutate campaign rows directly");
assert.doesNotMatch(app, /sb\.from\(['"]marketing_campaign_participants['"]\)\.(insert|update|delete)/, "browser must not mutate partner rows directly");
assert.match(app, /MARKETING:\{eyebrow:'MARKETING COMMAND CENTER'[\s\S]{0,500}خدمات التسويق الرقمي SMM/, "marketing role home must expose the SMM shortcut");
assert.match(app, /طلبات وخدمات SMM/, "enterprise home must expose SMM quick access");
assert.match(app, /لا يوجد نشر خارجي تلقائي/, "UI must not claim external ad publication");
assert.match(index, /app\.js\?v=mnty-modules-v3-20261020/, "browser cache key must be refreshed");
const sw = fs.readFileSync("web/sw.js", "utf8");
assert.match(sw, /const CACHE='mnty-web-v135'/, "PWA cache must be versioned for the new shell");
assert.match(sw, /app\.js\?v=mnty-modules-v3-20261020/, "service worker must precache the exact versioned app entrypoint");
assert.ok(sw.includes("./vendor/supabase.js?v=supabase21172"), "service worker must precache the exact versioned Supabase SDK entrypoint");
assert.match(index, /sw\.js\?v=mnty-modules-v3-20261020/, "service worker registration cache key must match the current cash/restaurant release version");

console.log("Marketing workspace contract: PASS (32 assertions)");
