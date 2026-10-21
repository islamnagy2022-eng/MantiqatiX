import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/erp-purchase-receive/index.ts', 'utf8');
assert.match(source, /Number\.isFinite\(receivedQuantity\).*receivedQuantity <= 0/, 'receipt quantity must be finite and positive');
assert.match(source, /Number\.isFinite\(unitCost\).*unitCost < 0/, 'unit cost must be finite and non-negative');
assert.match(source, /INVALID_RECEIPT_NUMBER/, 'receipt number must be validated');
assert.match(source, /eq\("tenant_id",body\.tenant_id\)\.eq\("business_id",body\.business_id\)\.eq\("receipt_number",String\(body\.receipt_number\)\.trim\(\)\)/, 'idempotency lookup must be tenant/business scoped');
assert.match(source, /RECEIPT_IDEMPOTENCY_CONFLICT/, 'reusing a receipt number with a different payload must be rejected');
assert.match(source, /existingError\) throw existingError/, 'idempotency lookup errors must not be ignored');
assert.match(source, /sameRequest=.*existing\.purchase_order_id.*existing\.warehouse_id.*existing\.product_id.*existing\.received_quantity.*existing\.unit_cost/, 'idempotent retries must match the original receipt payload');
console.log('ERP purchase receive contract PASS');
