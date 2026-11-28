import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261125140000_rc116_crm_business_scoped_writes.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc116_crm_business_writes_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc116_crm_business_writes_integration.sql", "utf8");

assert.match(migration, /drop policy if exists "Users create marketing leads"/);
assert.match(migration, /requester_user_id = auth\.uid\(\)/);
assert.match(migration, /um\.business_id = b\.id/);
assert.match(migration, /um\.tenant_id = b\.tenant_id/);
assert.match(migration, /status = 'OPEN'/);
assert.match(migration, /source = 'PLATFORM'/);
assert.match(migration, /assigned_provider_id is null/);
assert.match(migration, /currency = 'EGP'/);
assert.match(migration, /drop policy if exists "Owners manage their marketing provider profile"/);
assert.match(migration, /create policy "Owners view own marketing provider profile"/);
assert.match(migration, /create policy "Owners update own provider profile branding"/);
assert.equal((migration.match(/^\s+business_id is null$/gm) || []).length, 3);
assert.match(migration, /business_id cannot be changed because it[\s\S]*?is not included/i);
assert.match(migration, /revoke insert, update, delete[\s\S]*?from authenticated/i);
assert.match(migration, /grant update \(profile_image_path, settings, updated_at\)/i);
// RC116 is immutable historical SQL. The JSONB branding guard is introduced
// by the forward-only RC931 migration and verified in its dedicated workflow.
assert.doesNotMatch(migration, /mnty_guard_provider_profile_branding_only/);
assert.equal((migration.match(/auth\.jwt\(\)->>'is_anonymous'/g) || []).length, 4);

assert.match(fixture, /create policy "Owners manage their marketing provider profile"/);
assert.match(fixture, /grant select, insert, update, delete on public\.marketing_provider_profiles to authenticated/);
assert.match(fixture, /'TENANT-A', 'Business A2'/);

for (const marker of [
  "provider inserted a lead for a different business in the same tenant",
  "provider inserted a lead for another tenant",
  "provider spoofed the lead requester identity",
  "provider inserted a pre-matched lead",
  "provider spoofed lead attribution source",
  "unscoped tenant admin created a business lead",
  "anonymous session created a marketing lead",
  "provider owner could not update own branding",
  "owner logo update changed non-brand profile settings",
  "provider owner changed profile business_id",
  "provider owner self-approved profile",
  "provider owner self-verified profile",
  "provider owner directly inserted a provider profile",
  "provider owner deleted provider profile",
  "second provider modified another provider profile",
  "legacy owner could not update branding on unassigned profile",
  "legacy owner attached unassigned provider profile to a business",
  "legacy owner changed profile approval state",
  "legacy owner deleted unassigned provider profile",
]) {
  assert.ok(integration.includes(marker), `Missing integration assertion: ${marker}`);
}

console.log("RC116 CRM business-scoped write contract: PASS");
