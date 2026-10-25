import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("supabase/functions/api/index.ts", "utf8");

assert.match(source, /const branchId = url\.searchParams\.get\("branchId"\)\?\.trim\(\) \|\| null;/,
  "catalog branchId must normalize blank query values");
assert.match(source, /if \(branchId\.length > 128\)/,
  "branchId length must be bounded before database lookup");
assert.match(source, /\.eq\("id", branchId\)\.eq\("business_id", businessId\)\.eq\("status", "ACTIVE"\)\.maybeSingle\(\)/,
  "requested branch must be an active branch of the selected business");
assert.match(source, /buildPriceQuery\(\)\.is\("branch_id", null\)/,
  "branch-specific catalog responses must include shared prices");
assert.match(source, /buildPriceQuery\(\)\.eq\("branch_id", branchId\)/,
  "branch-specific catalog responses must include only the selected branch overrides");
assert.doesNotMatch(source, /\.or\(\x60branch_id\.is\.null,branch_id\.eq\.\$\{branchId\}\x60\)/,
  "untrusted branch IDs must not be interpolated into a PostgREST OR filter");
assert.doesNotMatch(source, /itemQuery\.or\(\x60branch_id\.is\.null,branch_id\.eq\.\$\{branchId\}\x60\)/,
  "catalog item branch filtering must use exact database filters");

assert.match(source, /const normalizedIdempotencyKey = String\(idempotencyKey \?\? ""\)\.trim\(\)/,
  "payment idempotency keys must be trimmed and validated");
assert.match(source, /const matchesIdempotentIntent = \(intent: Record<string, unknown>\)/,
  "idempotency replay must compare immutable payment identity");
for (const field of ["order_id", "currency", "provider", "payment_method"]) {
  assert.match(source, new RegExp(`String\\(intent\\.${field}\\)`), `idempotency comparison must include ${field}`);
}
assert.match(source, /Math\.abs\(Number\(intent\.amount\) - Number\(order\.total\)\) <= 0\.01/,
  "idempotency comparison must include numeric amount equality");
assert.match(source, /\.insert\(newIntent\)\.select\(\)\.single\(\)/,
  "new payment intents must be inserted, not overwrite an existing key");
assert.match(source, /IDEMPOTENCY_CONFLICT/,
  "reusing a key for a different payment identity must fail closed");
assert.match(source, /const \{ data: racedIntent, error: racedIntentError \}/,
  "concurrent unique-key conflicts must be re-read and checked safely");
assert.doesNotMatch(source, /\.upsert\(newIntent,\s*\{\s*onConflict:\s*"tenant_id,idempotency_key"/,
  "payment idempotency must not overwrite an existing intent on conflict");

console.log("API catalog branch scope and payment idempotency contracts: PASS");
