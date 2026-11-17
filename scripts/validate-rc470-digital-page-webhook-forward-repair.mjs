import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20261117020000_rc470_digital_page_webhook_forward_repair.sql";
const migration = readFileSync(migrationPath, "utf8");
const workflow = readFileSync(".github/workflows/rc470-digital-page-webhook-forward-repair.yml", "utf8");
const forward = readFileSync(".github/workflows/forward-migration-chain-replay.yml", "utf8");
const test = readFileSync("supabase/tests/rc470_digital_page_webhook_forward_repair.sql", "utf8");

for (const marker of [
  "RC470_PROCESSOR_SIGNATURE_MISSING",
  "a5e65a21d159846e2814c82bb89925ce",
  "RC470_UNEXPECTED_LEGACY_PROCESSOR_BODY",
  "RC470_UNEXPECTED_HARDENED_PROCESSOR_BODY",
  "SET search_path = ''",
  "pg_advisory_xact_lock",
  "DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH",
  "DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH",
  "DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH",
  "REVOKE ALL ON FUNCTION",
  "GRANT EXECUTE ON FUNCTION"
]) assert.ok(migration.includes(marker), "RC470 migration missing marker: " + marker);

assert.ok(workflow.includes("supabase/tests/rc431_digital_page_payment_fixture.sql"));
assert.ok(workflow.includes("supabase/tests/rc470_live_rc424_processor_fixture.sql"));
assert.ok(workflow.includes(migrationPath));
assert.ok(workflow.includes("supabase/tests/rc431_digital_page_payment_integration.sql"));
assert.ok(forward.includes("supabase/migrations/**"));
assert.ok(forward.includes("supabase/tests/rc470_digital_page_webhook_forward_repair.sql"));
assert.ok(test.includes("RC470_SEARCH_PATH_NOT_EMPTY"));
assert.ok(test.includes("RC470_ACL_CONTRACT_FAILED"));
console.log("RC470 migration source contract: PASS");
