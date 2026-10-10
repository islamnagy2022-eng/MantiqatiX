import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");

assert.match(app, /function marketingCampaignWorkspace\(\)/, "marketing campaign workspace must be rendered");
assert.match(app, /function marketingAgencyWorkspace\(\)/, "agency workspace tabs must remain present");
assert.match(app, /function bindMarketingAgencyWorkspace\(\)/, "agency tabs and SMM shortcuts must be interactive");
assert.match(app, /data-marketing-tab-go/, "overview shortcuts must select the matching workspace tab");
assert.match(app, /async function loadMarketingCampaignData\(\)/, "campaign data must load through a dedicated error-aware reader");
assert.match(app, /marketing_campaigns'\)\.select\('id,business_id,title,objective,channels,budget,currency,status,start_at,end_at,created_at,brief'/, "campaign reads must use an explicit field allowlist");
assert.match(app, /marketing_campaign_participants'\)\.select\('id,business_id,campaign_id,provider_id,role,allocation_percent,agreed_value,status,responded_at,created_at'/, "participant reads must use an explicit field allowlist");
assert.match(app, /live\.marketingCampaignErrors\.push\('marketing_campaigns'\)/, "failed campaign reads must be surfaced, not presented as empty");
assert.match(app, /sb\.rpc\('create_marketing_campaign_backend'/, "campaign creation must use the authorized backend RPC");
assert.match(app, /sb\.rpc\('invite_marketing_campaign_partner_backend'/, "partner invitations must use the authorized backend RPC");
assert.match(app, /sb\.rpc\('respond_marketing_campaign_invitation_backend'/, "partner responses must use the authorized backend RPC");
assert.match(app, /sb\.rpc\('update_marketing_campaign_status_backend'/, "campaign status changes must use the authorized backend RPC");
assert.match(app, /p_actor:user\.id/, "the actor identity must be derived from the authenticated session");
assert.match(app, /id="mc-idempotency-key"/, "campaign form must retain its idempotency key for retries");
assert.match(app, /document\.getElementById\('mc-idempotency-key'\)\?\.value/, "campaign retries must reuse the same key until the form succeeds");
assert.match(app, /sessionStorage\.setItem\(campaignIdempotencyStorageKey,key\)/, "campaign idempotency key must survive a reload during an ambiguous request");
assert.match(app, /sessionStorage\.removeItem\('MNTYMarketingCampaignIdempotencyKey:'\+String\(live\.businessId\|\|'none'\)\)/, "campaign idempotency key must be cleared after a confirmed success");
assert.match(app, /MARKETING_IDEMPOTENCY_KEY_CONFLICT|create_marketing_campaign_backend/, "campaign creation must call the idempotent backend contract");
assert.doesNotMatch(app, /sb\.from\(['"]marketing_campaigns['"]\)\.(insert|update|delete)/, "browser must not mutate campaign rows directly");
assert.doesNotMatch(app, /sb\.from\(['"]marketing_campaign_participants['"]\)\.(insert|update|delete)/, "browser must not mutate participant rows directly");
assert.match(app, /data-marketing-action="خدمات التسويق الرقمي SMM"/, "marketing workspace must link to the SMM module");
assert.match(app, /MARKETING:[\\s\\S]{0,500}خدمات التسويق الرقمي SMM/, "marketing role homepage must expose the SMM shortcut");
assert.match(app, /طلبات وخدمات SMM/, "enterprise home must expose the SMM quick-access card");
assert.match(app, /لا يوجد نشر خارجي تلقائي/, "UI must not claim external ad publication");
assert.match(index, /app\.js\?v=rc455-marketing-campaign-ui-20261011/, "browser cache key must be updated");

console.log("Marketing campaign UI contract: PASS (16 assertions)");
