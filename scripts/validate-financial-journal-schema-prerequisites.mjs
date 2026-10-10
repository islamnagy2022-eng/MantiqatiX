import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010175000_rc449a_financial_journal_schema_prerequisites.sql", "utf8");
const rc450 = fs.readFileSync("supabase/migrations/20261010180000_rc450_financial_journal_service_role_boundary.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc449a_financial_journal_schema_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc449a_financial_journal_schema_integration.sql", "utf8");

assert.ok("20261010175000" < "20261010180000", "schema prerequisite migration must sort before RC450");
for (const col of ["entry_number","total_debit","total_credit","posted_at","updated_at","reversed_by_entry_id"]) {
  assert.match(migration, new RegExp("add column if not exists " + col, "i"), "schema migration must add " + col);
}
assert.match(migration, /journal_entry_lines add column line_number/i);
assert.match(migration, /set total_debit=coalesce/i);
assert.match(migration, /set total_credit=coalesce/i);
assert.match(migration, /row_number\(\) over\(partition by l\.journal_entry_id order by l\.id\)/i);
assert.match(migration, /general_ledger_running_balance_lookup_idx/i);
for (const col of ["entry_number","total_debit","total_credit","posted_at","line_number"]) {
  assert.match(rc450, new RegExp("attname='" + col + "'", "i"), "RC450 preflight dependency must match " + col);
}
assert.match(fixture, /created_at timestamptz not null/i);
assert.match(integration, /legacy journal header was not backfilled/i);
assert.match(integration, /legacy line numbers were not deterministically backfilled/i);
assert.match(integration, /posted_at default must support legacy posted inserts/i);
console.log("RC449A financial journal schema prerequisite contract: PASS");
