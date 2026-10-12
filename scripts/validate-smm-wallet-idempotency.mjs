import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261012110000_rc458_smm_wallet_exactly_once.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc458_smm_wallet_idempotency.sql", "utf8");
const edge = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");

assert.match(migration, /create unique index if not exists smm_wallet_transactions_debit_reference_uidx[\s\S]*type = 'DEBIT'/i,
  "wallet debit ledger must be unique per user/order reference");
assert.match(migration, /create unique index if not exists smm_wallet_transactions_refund_reference_uidx[\s\S]*type = 'REFUND'/i,
  "wallet refund ledger must be unique per user/order reference");
assert.match(migration, /for update[\s\S]*smm_wallet_transactions/i,
  "wallet RPCs must serialize wallet mutations before checking transaction references");
assert.match(migration, /v_existing_amount = p_amount/i,
  "retries with a mismatched amount must not be treated as successful");
assert.match(migration, /v_debit_amount <> p_amount/i,
  "refund must match the original debit amount");
assert.match(migration, /revoke all on function public\.smm_debit_wallet[\s\S]*from public, anon, authenticated/i,
  "debit RPC must not be callable by public clients");
assert.match(migration, /grant execute on function public\.smm_debit_wallet[\s\S]*to service_role/i,
  "debit RPC must be executable by the trusted backend");
assert.match(integration, /duplicate debit changed balance or duplicated ledger row/i,
  "integration test must verify debit balance and ledger exactly once");
assert.match(integration, /duplicate refund changed balance or duplicated ledger row/i,
  "integration test must verify refund balance and ledger exactly once");
assert.match(integration, /refund without a matching debit was accepted/i,
  "integration test must reject orphan refunds");
assert.match(edge, /WALLET_DEBIT_RESULT_UNKNOWN/,
  "gateway must quarantine ambiguous debit outcomes");
assert.doesNotMatch(edge, /Automatic refund after provider failure/,
  "gateway must not blindly refund after an ambiguous provider call");

console.log("SMM wallet exactly-once contract: PASS");
