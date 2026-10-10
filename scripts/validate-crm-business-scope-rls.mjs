import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010140000_rc444_crm_business_scope_rls.sql", "utf8");
const leadsStart = migration.indexOf('create policy "CRM managers view marketing leads"');
const providersStart = migration.indexOf('create policy "CRM managers view marketing providers"');
assert.ok(leadsStart >= 0 && providersStart > leadsStart, "both CRM read policies must be recreated");
const leads = migration.slice(leadsStart, providersStart);
const providers = migration.slice(providersStart);
for (const policy of [leads, providers]) {
  assert.match(policy, /um\.status='ACTIVE'/);
  assert.match(policy, /um\.tenant_id='MNTY-PLATFORM'/);
  assert.match(policy, /um\.permissions->>'scope',''\)='PLATFORM'/);
  assert.match(policy, /um\.permissions->>'full_control'\)::boolean,false\)\s*=\s*true/);
  assert.match(policy, /um\.business_id=marketing_/);
}
assert.match(leads, /requester_business_id is not null/);
assert.match(providers, /business_id is not null/);
assert.doesNotMatch(migration, /upper\(um\.role\) in \('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'\)\s*\)\s*\)/i, "role-only global access must not remain");
console.log("CRM business-scope RLS source contract: PASS");
