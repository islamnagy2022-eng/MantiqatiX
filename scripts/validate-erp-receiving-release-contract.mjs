import fs from "node:fs";
import assert from "node:assert/strict";

const edge=fs.readFileSync("supabase/functions/erp-purchase-receive/index.ts","utf8");
const rc434=fs.readFileSync("supabase/migrations/20261009200000_rc434_atomic_erp_purchase_receiving.sql","utf8");
const rc437=fs.readFileSync("supabase/migrations/20261009230000_rc437_purchase_order_lines_receiving_limits.sql","utf8");
const rc438=fs.readFileSync("supabase/migrations/20261009240000_rc438_purchase_order_creation_with_lines.sql","utf8");
const test434=fs.readFileSync("supabase/tests/rc434_erp_receiving_integration.sql","utf8");
const test437=fs.readFileSync("supabase/tests/rc437_purchase_order_lines_integration.sql","utf8");

assert.match(edge,/userClient\.auth\.getUser\(\)/,"request must be tied to an authenticated user");
assert.match(edge,/rpc\("receive_purchase_stock_with_order_line_backend"\)/,"receiving must use the line-aware atomic RPC");
assert.doesNotMatch(edge,/\.from\("(stock_balances|erp_purchase_receipts|inventory_transactions)"\)\.(insert|update|upsert|delete)/,"Edge Function must not mutate stock/receipt/ledger tables directly");
assert.match(edge,/p_actor_user_id:\s*user\.id/,"actor identity must come from validated Auth user");
assert.match(edge,/p_tenant_id:\s*tenantId/,"tenant scope must be explicitly passed to backend");
assert.match(edge,/idempotency/i,"receipt operation must carry idempotency semantics");
assert.match(edge,/ORIGIN_NOT_ALLOWED/,"cross-origin requests must be rejected");
assert.match(rc434,/insert into public\.erp_purchase_receipts[\s\S]*insert into public\.stock_balances[\s\S]*insert into public\.inventory_transactions/i,"receipt, stock and inventory ledger must be atomic");
assert.match(rc434,/RECEIPT_IDEMPOTENCY_CONFLICT/,"conflicting receipt replay must fail closed");
assert.match(rc437,/v_line\.received_quantity\+p_received_quantity>v_line\.ordered_quantity/,"cumulative receiving cannot exceed ordered quantity");
assert.match(rc437,/receive_purchase_stock_atomic_backend[\s\S]*from public,anon,authenticated,service_role/i,"service role must not bypass the line-aware wrapper");
assert.match(rc438,/create_purchase_order_with_lines_backend/,"order creation must be server-authoritative");
assert.match(test434,/RC434_FORCED_LEDGER_FAILURE/,"RC434 test must verify rollback on inventory failure");
assert.match(test437,/receiving over ordered quantity must be rejected/,"RC437 test must reject over-receipt");
assert.match(test437,/duplicate receipt must be idempotent/,"RC437 test must verify idempotent replay");
console.log("ERP receiving release contract PASS.");
