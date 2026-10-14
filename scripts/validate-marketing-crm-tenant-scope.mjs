import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010210000_rc452_marketing_crm_tenant_scope.sql", "utf8");
const catalogueMigration = fs.readFileSync("supabase/migrations/20261015010000_rc526_marketing_services_platform_scope.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc452_marketing_crm_scope_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc452_marketing_crm_scope_integration.sql", "utf8");

assert.match(migration, /drop policy if exists "CRM managers view marketing leads"/);
assert.match(migration, /um\.tenant_id = b\.tenant_id/);
assert.match(migration, /um\.business_id is null or um\.business_id = b\.id/);
assert.match(migration, /platform_admin\.tenant_id = 'MNTY-PLATFORM'/);
assert.match(migration, /platform_admin\.permissions ->> 'scope' = 'PLATFORM'/);
assert.match(migration, /platform_admin\.permissions ->> 'full_control' = 'true'/);
assert.match(migration, /drop policy if exists "CRM managers view marketing providers"/);
assert.match(migration, /Assigned providers view assigned marketing leads/);
assert.match(migration, /drop policy if exists "Users create marketing leads"/);
assert.match(migration, /drop policy if exists "Owners manage their marketing provider profile"/);
assert.match(catalogueMigration, /drop policy if exists "marketing_services_admin_manage"/);
assert.match(catalogueMigration, /on public\.marketing_services/);
assert.match(catalogueMigration, /platform_admin\.tenant_id = 'MNTY-PLATFORM'/);
assert.match(fixture, /create table public\.marketing_services/);
assert.match(integration, /tenant manager mutated the shared marketing catalogue/);
assert.match(integration, /platform admin cannot manage the shared marketing catalogue/);
assert.match(integration, /anonymous session mutated the shared marketing catalogue/);
assert.match(fixture, /alter table public\.user_memberships enable row level security/);
assert.match(fixture, /alter table public\.businesses enable row level security/);
assert.match(integration, /manager A crossed tenant boundary/);
assert.match(integration, /tenant-scoped SUPER_ADMIN gained platform-wide access/);
assert.match(integration, /assigned provider cannot read assigned lead/);
assert.match(integration, /explicit platform SUPER_ADMIN should see all six fixture leads/);
assert.match(integration, /manager inserted a lead for another tenant/);
assert.match(integration, /provider attached profile to another tenant business/);

console.log("RC452 marketing CRM tenant/business scope contract: PASS (25 assertions)");
