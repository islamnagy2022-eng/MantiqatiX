import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("web/app.js");
const operations = read("web/operations-modules.js");
const campaignMigration = read("supabase/migrations/20261010220000_rc453_marketing_campaign_backend.sql");
const leadLifecycleMigration = read("supabase/migrations/20261024193000_rc457_marketing_lead_lifecycle_backend.sql");
const partnerDirectoryMigration = read("supabase/migrations/20261024210000_rc458_marketing_partner_directory_backend.sql");
const createFunction = read("supabase/functions/marketing-lead-create/index.ts");
const scopeMigration = read("supabase/migrations/20261010210000_rc452_marketing_crm_tenant_scope.sql");
const contract = read("docs/engineering/CRM_MARKETING_LEAD_LIFECYCLE_CONTRACT.md");

// Browser reads may use RLS, but lifecycle writes must remain server-authoritative.
assert.doesNotMatch(
  app,
  /\.from\(\s*["']marketing_leads["']\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/,
  "browser code must not directly mutate marketing_leads"
);
assert.match(app, /sb\.functions\.invoke\(['"]marketing-lead-create['"]/,
  "lead creation must continue through the protected Edge Function");

assert.match(operations, /async function saveLead\(\)[\s\S]*?budgetMin<0\|\|budgetMax<budgetMin/,
  "lead UI must reject negative budgets and a maximum below the minimum before submission");
assert.match(operations, /maxlength="200"/,
  "lead form must expose the server's title, description, and service-area length limits");
assert.match(operations, /maxlength="5000"/,
  "lead description field must expose the server's 5000-character limit");
assert.match(operations, /if\(r\.error\|\|r\.data\?\.error\)[\s\S]*?button\.disabled=false[\s\S]*?إنشاء طلب/,
  "lead submit button must recover after a server-reported creation failure");
assert.match(app, /q\.eq\('requester_business_id',live\.businessId\)/,
  "internal CRM lead list must filter by active business");
assert.match(app, /live\.businessId&&\['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'\]\.includes\(String\(live\.role\|\|''\)\.toUpperCase\(\)\)/,
  "active-business filtering must apply only to internal business-management roles");

// Creation derives ownership from the authenticated JWT and currently uses OPEN as its initial status.
assert.match(createFunction, /requester_user_id:\s*actor\.id/,
  "lead requester identity must be derived from the validated JWT actor");
assert.match(createFunction, /status:\s*["']OPEN["']/,
  "the current lead creation status vocabulary must remain explicit until lifecycle design is approved");
assert.match(createFunction, /\.from\(["']marketing_leads["']\)\s*\.insert\(lead\)/,
  "the protected backend remains the lead creation path");

// CRM manager reads must bind membership to tenant/business scope.
assert.match(scopeMigration, /um\.tenant_id\s*=\s*b\.tenant_id/,
  "CRM manager policy must enforce tenant equality");
assert.match(scopeMigration, /um\.business_id\s+is\s+null\s+or\s+um\.business_id\s*=\s*b\.id/i,
  "CRM manager policy must enforce business scope");
assert.match(scopeMigration, /platform_admin\.tenant_id\s*=\s*'MNTY-PLATFORM'[\s\S]*?permissions\s*->>\s*'full_control'\s*=\s*'true'/,
  "platform-wide access must require explicit platform full-control membership");

// The OPEN vs NEW discrepancy remains a blocker; do not silently normalize legacy values.
assert.match(contract, /writes\s*.OPEN.[\s\S]*?fixture\s*uses\s*.NEW./i,
  "contract must retain the OPEN vs NEW status discrepancy until reconciled");
assert.match(contract, /BLOCKED\s*\/\s*NOT CERTIFIED/,
  "release must remain blocked pending final evidence");


const appLifecycle = app.slice(app.indexOf("const LEAD_NEXT_STATUSES="), app.indexOf("const ORDER_STAFF_ROLES="));
assert.ok(appLifecycle.length > 0, "lead lifecycle UI contract must exist before order helpers");
assert.match(appLifecycle, /sb\.rpc\(['"]transition_marketing_lead_backend['"]/,
  "status changes must call the server-authoritative lifecycle RPC");
assert.match(appLifecycle, /p_actor:\s*user\.id[\s\S]*?p_expected_status:\s*expected[\s\S]*?p_new_status:\s*next[\s\S]*?p_request_id:\s*crypto\.randomUUID\(\)/,
  "lifecycle RPC must pass actor, expected state, next state, and a fresh idempotency key");
assert.match(app, /marketing_leads[\s\S]*?requester_business_id,created_at/,
  "lead list must retain the business scope needed for authorized lifecycle actions");
assert.match(appLifecycle, /requester_business_id',live\.businessId/,
  "internal lead detail reads must be constrained to the active business");
assert.match(appLifecycle, /requester_user_id',user\.id/,
  "customer lead detail reads must remain owner-scoped");
assert.match(appLifecycle, /LEAD_STATUS_CONFLICT/,
  "the UI must present a safe concurrency-conflict path");
assert.match(appLifecycle, /LEAD_NOT_FOUND_OR_FORBIDDEN/,
  "the UI must avoid exposing cross-scope lead existence");

// Marketing campaign UI must use the migration's server-authoritative RPCs and exact business scope.
assert.match(operations, /'campaigns','invitations','projects'/,
  "marketing workspace must expose the campaigns tab");
assert.match(operations, /t==='marketing_campaigns'[\s\S]*?q=q\.eq\('business_id',membership\.business_id\)/,
  "campaign reads must be scoped to the selected business");
assert.match(operations, /sb\.rpc\('create_marketing_campaign_backend'/,
  "campaign creation must use the server-authoritative creation RPC");
assert.match(operations, /sb\.rpc\('update_marketing_campaign_status_backend'/,
  "campaign status changes must use the server-authoritative status RPC");
assert.match(operations, /'campaigns','invitations','projects'/,
  "marketing navigation must keep the campaign invitation workspace wired");
assert.match(operations, /function campaignInvitationsWorkspace[\s\S]*?data-mi-respond="ACCEPTED"[\s\S]*?data-mi-respond="DECLINED"/,
  "verified provider owners must have explicit accept and decline actions for pending invitations");
assert.match(operations, /const ownProviderIds=new Set[\s\S]*?invitedCampaignIds=[\s\S]*?p\.provider_id[\s\S]*?\.slice\(0,50\)/,
  "provider campaign metadata lookup must be derived only from the signed-in user's own invitations and remain bounded");
assert.match(operations, /from\('marketing_campaigns'\)\.select\('id,title,status'\)\.in\('id',invitedCampaignIds\)/,
  "provider invitation details must fetch only minimal campaign metadata for already-authorized invitation IDs");
assert.match(operations, /sb\.rpc\('list_marketing_partner_directory_backend'/,
  "cross-business partner discovery must use the scoped backend directory RPC");
assert.match(operations, /data-op-tab[\s\S]*?tab==='invitations'[\s\S]*?list_marketing_partner_directory_backend/,
  "opening the invitations tab must load the scoped directory even after initial module load");
assert.match(operations, /rows\.marketing_partner_directory/,
  "invitation UI must use the backend directory rather than broadening provider-profile reads");
assert.match(operations, /async function searchMarketingPartnerDirectory[\s\S]*?p_search:marketingPartnerSearch\|\|null[\s\S]*?p_limit:50/,
  "partner search must use the scoped RPC and enforce a bounded result count");
assert.match(operations, /query\.length>80/,
  "partner search input must enforce the server's 80-character limit");
assert.match(partnerDirectoryMigration, /security definer[\s\S]*?set search_path = ''/,
  "partner directory RPC must be SECURITY DEFINER with an empty search_path");
assert.match(partnerDirectoryMigration, /public\.mnty_can_manage_marketing_business\(p_business_id\)/,
  "partner directory must require a manager-authorized business scope");
assert.match(partnerDirectoryMigration, /p_actor is distinct from auth\.uid\(\)/,
  "partner directory must bind the supplied actor to the authenticated user");
assert.match(partnerDirectoryMigration, /auth\.jwt\(\)[\s\S]*?is_anonymous/,
  "partner directory must reject anonymous sessions");
assert.match(partnerDirectoryMigration, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 50\)/,
  "partner directory must clamp caller-supplied result limits to 1–50");
assert.match(partnerDirectoryMigration, /pg_catalog\.length\(v_search\) > 80/,
  "partner directory must enforce the bounded search term server-side");
assert.doesNotMatch(partnerDirectoryMigration, /grant\s+select\s+on\s+table\s+public\.marketing_provider_profiles/i,
  "directory migration must not widen direct provider-profile table access");
assert.match(partnerDirectoryMigration, /p\.status = 'ACTIVE'[\s\S]*?p\.is_verified is true[\s\S]*?p\.provider_kind in \('PARTNER_COMPANY', 'FREELANCER'\)/,
  "directory must return only active, verified eligible partner types");
const directoryReturnColumns = partnerDirectoryMigration.match(/returns table\s*\(([\s\S]*?)\)\s*language/i)?.[1] || "";
assert.doesNotMatch(directoryReturnColumns, /owner_user_id|email|phone|business_id/,
  "partner directory must not expose owner identity, contact details, or business identifiers");
assert.match(partnerDirectoryMigration, /revoke all on function public\.list_marketing_partner_directory_backend[\s\S]*?from public, anon/,
  "partner directory must not be executable by public or anonymous users");
assert.match(partnerDirectoryMigration, /grant execute on function public\.list_marketing_partner_directory_backend[\s\S]*?to authenticated/,
  "partner directory must be available only to authenticated callers after backend scope checks");
assert.match(operations, /sb\.rpc\('invite_marketing_campaign_partner_backend'/,
  "partner invitations must use the server-authoritative invite RPC");
assert.match(operations, /sb\.rpc\('respond_marketing_campaign_invitation_backend'/,
  "partner responses must use the server-authoritative invitation response RPC");
assert.match(operations, /function respondMarketingCampaignInvitation[\s\S]*?owner_user_id===user\.id[\s\S]*?is_verified===true/,
  "partner invitation response controls must be limited to verified provider profiles owned by the signed-in user");
const inviteHandler = operations.slice(operations.indexOf("async function inviteMarketingCampaignPartner"), operations.indexOf("function campaignWorkspace"));
assert.doesNotMatch(inviteHandler, /owner_user_id===user\.id/,
  "managers must be able to invite eligible partner profiles owned by other users");
assert.match(operations, /p_actor:user\.id[\s\S]*?p_business_id:membership\.business_id/,
  "campaign creation must pass the current actor and selected business for server validation");
assert.match(operations, /const canManage=Boolean[\s\S]*?membership\?\.business_id[\s\S]*?BUSINESS_OWNER/,
  "campaign management actions must be limited in the UI to an authenticated business manager");
assert.doesNotMatch(
  operations,
  /\.from\(\s*["']marketing_campaigns["']\s*\)\s*\.\s*(?:insert|update|upsert|delete)\s*\(/,
  "campaign mutations must not bypass the backend RPC boundary"
);
assert.match(campaignMigration, /create or replace function public\.create_marketing_campaign_backend/,
  "campaign creation RPC must exist in the forward migration");
assert.match(campaignMigration, /create or replace function public\.update_marketing_campaign_status_backend/,
  "campaign status RPC must exist in the forward migration");
assert.match(campaignMigration, /revoke all on table public\.marketing_campaigns, public\.marketing_campaign_participants from anon, authenticated/,
  "campaign table writes must not be granted directly to browser roles");
assert.match(campaignMigration, /grant execute on function public\.create_marketing_campaign_backend[\s\S]*?to authenticated/,
  "authenticated users must execute only the scoped campaign RPC");

const directoryIntegration = read("supabase/tests/rc458_marketing_partner_directory_integration.sql");
const campaignFixture = read("supabase/tests/rc453_marketing_campaign_fixture.sql");
const campaignWorkflow = read(".github/workflows/marketing-campaign-backend.yml");
assert.match(campaignFixture, /name_en text/,
  "the disposable provider fixture must include the English display name used by RC458");
assert.match(directoryIntegration, /result_count <> 2[\s\S]*?unverified profile leaked[\s\S]*?same-business profile leaked/,
  "RC458 integration must verify eligibility and same-business exclusion");
assert.match(directoryIntegration, /ACTOR_MISMATCH[\s\S]*?MARKETING_BUSINESS_SCOPE_REQUIRED[\s\S]*?MARKETING_PARTNER_SEARCH_TOO_LONG/,
  "RC458 integration must verify actor, business-scope, and search-length rejection paths");
assert.match(directoryIntegration, /has_function_privilege\('anon'[\s\S]*?has_function_privilege\('authenticated'/,
  "RC458 integration must verify RPC execution grants");
assert.match(campaignWorkflow, /20261024210000_rc458_marketing_partner_directory_backend\.sql[\s\S]*?rc458_marketing_partner_directory_integration\.sql/,
  "PostgreSQL workflow must include the RC458 migration and behavioral integration test");
assert.match(campaignWorkflow, /rc453_migration\.sql[\s\S]*?rc453_test\.sql[\s\S]*?rc458_migration\.sql[\s\S]*?rc458_test\.sql/,
  "PostgreSQL workflow must run the prerequisite campaign migration/tests before RC458");


const leadLifecycleIntegration = read("supabase/tests/rc457_marketing_lead_lifecycle_integration.sql");
assert.match(leadLifecycleMigration, /create or replace function public\.transition_marketing_lead_backend/,
  "RC457 server-authoritative lead transition RPC must exist");
assert.match(leadLifecycleMigration, /for update[\s\S]*?mnty_can_manage_marketing_business[\s\S]*?LEAD_STATUS_CONFLICT/,
  "RC457 must lock the lead row and enforce business scope and expected-state concurrency");
assert.match(leadLifecycleMigration, /audit_logs_marketing_lead_lifecycle_request_uq[\s\S]*?request_id/,
  "RC457 must protect request idempotency in the audit store");
assert.match(leadLifecycleIntegration, /identical lifecycle replay[\s\S]*?stale expected status[\s\S]*?disallowed lifecycle transition[\s\S]*?cross-business manager[\s\S]*?AUTH_REQUIRED/,
  "RC457 PostgreSQL integration must cover replay, stale state, invalid transition, cross-business isolation, and missing auth");
assert.match(campaignWorkflow, /20261024193000_rc457_marketing_lead_lifecycle_backend\.sql[\s\S]*?rc457_marketing_lead_lifecycle_integration\.sql/,
  "PostgreSQL workflow must include the RC457 migration and behavioral test");
assert.match(campaignWorkflow, /rc453_test\.sql[\s\S]*?rc457_migration\.sql[\s\S]*?rc457_test\.sql[\s\S]*?rc458_migration\.sql/,
  "PostgreSQL integration order must apply RC453 then RC457 then RC458");

console.log("Marketing lead lifecycle + campaign workspace safety contracts: PASS (static source guard only)");
