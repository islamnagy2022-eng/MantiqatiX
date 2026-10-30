import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/digital-page-payment-intent/index.ts", import.meta.url), "utf8");

assert.match(source, /providerOrderId\s*=\s*String\(p\.intention_order_id\s*\?\?\s*p\.order_id\s*\?\?\s*""\)/,
  "Paymob intention response must extract the provider order ID");
assert.match(source, /!providerIntentId\s*\|\|\s*!providerClientSecret\s*\|\|\s*!providerOrderId/,
  "missing provider order ID must fail closed before finalization");
assert.match(source, /p_provider_order_id\s*:\s*providerOrderId/,
  "the authenticated finalizer call must persist the provider order ID");
assert.match(source, /finalize_digital_page_payment_intent_backend/,
  "digital-page payment intent must call the canonical finalizer");
console.log("Digital-page finalizer source contract PASS: provider order ID is required and persisted.");
