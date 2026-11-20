import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120240000_rc489_finance_anonymous_auth_select_guards.sql",
  "utf8",
);
const integration = fs.readFileSync(
  "supabase/tests/rc489_finance_anonymous_auth_select_guards_integration.sql",
  "utf8",
);
const tables = [
  "general_ledger",
  "journal_entries",
  "journal_entry_lines",
  "payment_financial_reconciliations",
  "payment_intents",
  "payment_provider_events",
  "settlement_transactions",
  "wallet_accounts",
  "wallet_transactions",
];
for (const table of tables) {
  assert.ok(migration.includes("'" + table + "'"), "missing RC489 table: " + table);
  assert.ok(integration.includes("'" + table + "'"), "missing RC489 behavioral coverage: " + table);
}
assert.ok(migration.includes("auth.jwt()") && migration.includes("is_anonymous"), "missing anonymous Auth claim guard");
assert.ok(migration.includes("auth.jwt()") && migration.includes("is_anonymous"), "missing anonymous Auth claim guard");
assert.match(migration, /RC489_FINANCE_TABLE_RLS_DISABLED/);
assert.match(migration, /RC489_EXPECTED_AUTHENTICATED_SELECT_GRANT_MISSING/);
assert.match(integration, /RC489_ANONYMOUS_FINANCE_READ_SUCCEEDED/);
assert.match(integration, /RC489_CONFIRMED_FINANCE_READ_REGRESSED/);
console.log("RC489 finance/payment anonymous Auth SELECT contract: PASS");
