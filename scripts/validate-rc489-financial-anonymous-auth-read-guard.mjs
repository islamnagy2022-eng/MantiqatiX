import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync(
  "supabase/migrations/20261120240000_rc489_financial_anonymous_auth_read_guard.sql","utf8");
const test=fs.readFileSync(
  "supabase/tests/rc489_financial_anonymous_auth_read_integration.sql","utf8");
const tables=["commission_rules","commission_transactions","general_ledger","journal_entries","journal_entry_lines","payment_events","payment_financial_reconciliations","payment_intents","payment_provider_events","refund_transactions","settlement_attempts","settlement_transactions","subscription_payment_intents","wallet_accounts","wallet_transactions"];

for (const table of tables) {
  const escaped=table.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  assert.match(migration,new RegExp(
    "CREATE\\s+POLICY\\s+mnty_confirmed_auth_financial_read[\\s\\S]*?ON\\s+public\\."+escaped+
    "[\\s\\S]*?AS\\s+RESTRICTIVE[\\s\\S]*?FOR\\s+SELECT[\\s\\S]*?TO\\s+authenticated[\\s\\S]*?is_anonymous","i"),
    "missing confirmed-auth financial read guard for "+table);
}
assert.match(migration,/relrowsecurity AND c\.relforcerowsecurity/);
assert.match(test,/RC489_ANONYMOUS_FINANCE_TABLE_READ_SUCCEEDED/);
assert.match(test,/RC489_CONFIRMED_FINANCE_MEMBER_READ_REGRESSED/);
assert.match(test,/RC489_FINANCIAL_ANONYMOUS_GUARDS_MISSING/);
assert.ok(migration.includes("(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE"), "finance guard must fail closed on missing claim");
assert.match(test,/RC489_MISSING_ANONYMOUS_CLAIM_READ_SUCCEEDED/);
assert.match(test,/ROLLBACK;/);
console.log("RC489 financial anonymous Auth read isolation contract: PASS");
