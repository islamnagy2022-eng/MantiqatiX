import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/digital-page-order-create/index.ts", "utf8");

assert.match(source, /const matchesRequest=/, "idempotency replay must compare the original request");
assert.match(source, /o\.product_id/, "replay must match product");
assert.match(source, /o\.page_type/, "replay must match page type");
assert.match(source, /o\.target_business_id/, "replay must match business scope");
assert.match(source, /o\.title/, "replay must match title");
assert.match(source, /IDEMPOTENCY_KEY_REUSED/, "reusing a key for a different request must conflict");
assert.match(source, /IDEMPOTENCY_LOOKUP_FAILED/, "initial idempotency lookup errors must not be ignored");
assert.match(source, /IDEMPOTENCY_REPLAY_LOOKUP_FAILED/, "duplicate-race lookup errors or missing rows must not be reported as successful replays");
assert.match(source, /if\(oe\.code===\"23505\"\)/, "concurrent duplicate inserts must be resolved by a verified replay lookup");
assert.match(source, /if\(re\|\|!retry\)/, "a missing row after a unique conflict must not return HTTP 200 with a null order");
assert.match(source, /if\(ue\|\|!user\|\|user\.is_anonymous\)/, "authenticated non-anonymous actor check must remain");
assert.match(source, /BUSINESS_SCOPE_FORBIDDEN/, "business membership enforcement must remain");
assert.match(source, /pricing_hash:pricingHash/, "order must retain the pricing snapshot for audit");
assert.doesNotMatch(source, /String\(o\.pricing_hash\)===pricingHash/, "a price change must not invalidate a legitimate retry of the same request");

console.log("Digital page order idempotency source contract: PASS");
