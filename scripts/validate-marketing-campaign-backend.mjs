import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010220000_rc453_marketing_campaign_backend.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc453_marketing_campaign_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc453_marketing_campaign_integration.sql", "utf8");

assert.match(migration, /create table public\.marketing_campaigns/);
assert.match(migration, /create table public\.marketing_campaign_participants/);
assert.match(migration, /alter table public\.marketing_campaigns enable row level security/);
assert.match(migration, /alter table public\.marketing_campaign_participants enable row level security/);
assert.match(migration, /um\.business_id = b\.id or um\.business_id is null/);
assert.match(migration, /upper\(coalesce\(um\.role,''\)\) in \('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'\)/);
assert.match(migration, /set search_path = ''/);
assert.match(migration, /ACTOR_MISMATCH/);
assert.match(migration, /MARKETING_PARTNER_NOT_ELIGIBLE/);
assert.match(migration, /MARKETING_ALLOCATION_OVER_100/);
assert.match(migration, /MARKETING_STATUS_TRANSITION_INVALID/);
assert.match(migration, /MARKETING_PARTNER_INVITATIONS_PENDING/);
assert.match(migration, /MARKETING_CAMPAIGN_CREATED/);
assert.match(migration, /MARKETING_CAMPAIGN_INVITATION/);
assert.match(migration, /revoke all on table public\.marketing_campaigns, public\.marketing_campaign_participants from anon, authenticated/);
assert.match(integration, /manager A created campaign for tenant B/);
assert.match(integration, /campaign actor spoofing was accepted/);
assert.match(integration, /unverified provider was invited/);
assert.match(integration, /replayed invitation duplicated notification/);
assert.match(integration, /provider saw unassigned campaign in own business/);
assert.match(integration, /provider changed client campaign status/);
assert.match(integration, /non-management business member created a campaign/);
assert.match(integration, /authenticated role has direct campaign INSERT/);

console.log("RC453 marketing campaign backend contract: PASS (21 assertions)");
