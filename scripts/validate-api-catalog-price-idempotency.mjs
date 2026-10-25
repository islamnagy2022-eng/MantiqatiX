import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("supabase/functions/api/index.ts", "utf8");
const contracts = readFileSync("supabase/functions/api/contracts.mjs", "utf8");

assert.match(source, /normalizeBranchId\(url\.searchParams\.get\("branchId"\)\)/,
  "catalog route must use tested branch normalization");
assert.match(source, /if \(branchId && branchId\.length > 128\)/,
  "non-empty branchId length must be bounded before database lookup");
assert.match(source, /\.eq\("id", branchId\)\.eq\("business_id", businessId\)\.eq\("status", "ACTIVE"\)\.maybeSingle\(\)/,
  "requested branch must be an active branch of the selected business");
assert.match(source, /buildPriceQuery\(\)\.is\("branch_id", null\)/,
  "branch-specific catalog responses must include shared prices");
assert.match(source, /buildPriceQuery\(\)\.eq\("branch_id", branchId\)/,
  "branch-specific catalog responses must include only the selected branch overrides");
assert.doesNotMatch(source, /\.or\(\x60branch_id\.is\.null,branch_id\.eq\.\$\{branchId\}\x60\)/,
  "untrusted branch IDs must not be interpolated into a PostgREST OR filter");
assert.match(source, /matchesIdempotentIntent\(existingIntent, order\)/,
  "idempotency replay must use the tested immutable identity helper");
assert.match(source, /matchesIdempotentIntent\(racedIntent, order\)/,
  "concurrent insert conflict must use the same tested immutable identity helper");
assert.match(source, /\.insert\(newIntent\)\.select\(\)\.single\(\)/,
  "new payment intents must be inserted, not overwrite an existing key");
assert.match(source, /IDEMPOTENCY_CONFLICT/,
  "reusing a key for a different payment identity must fail closed");
assert.doesNotMatch(source, /\.upsert\(newIntent,\s*\{\s*onConflict:\s*"tenant_id,idempotency_key"/,
  "payment idempotency must not overwrite an existing intent on conflict");
assert.match(contracts, /Math\.abs\(amount - expectedAmount\) <= 0\.01/,
  "runtime helper must validate amount identity");
assert.match(contracts, /intent\.order_id/,
  "runtime helper must validate order identity");
assert.match(contracts, /intent\.currency/,
  "runtime helper must validate currency identity");
console.log("API catalog branch scope and payment idempotency contracts: PASS");
