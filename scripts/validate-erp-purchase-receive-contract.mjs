import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('supabase/functions/erp-purchase-receive/index.ts', 'utf8');
assert.ok(source.includes('Number.isFinite(quantity)'));
assert.ok(source.includes('Number.isFinite(unitCost)'));
assert.ok(source.includes('receive_purchase_stock_with_order_line_backend'));
assert.ok(source.includes('p_actor_user_id: user.id'));
assert.ok(source.includes('ATOMIC_RECEIVING_UNAVAILABLE'));
console.log('ERP atomic receiving contract PASS');
