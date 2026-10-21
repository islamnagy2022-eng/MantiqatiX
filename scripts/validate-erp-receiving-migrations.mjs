import assert from "node:assert/strict";
import fs from "node:fs";

const rc434 = fs.readFileSync("supabase/migrations/20261009200000_rc434_atomic_erp_purchase_receiving.sql", "utf8");
const rc437 = fs.readFileSync("supabase/migrations/20261009230000_rc437_purchase_order_lines_receiving_limits.sql", "utf8");

const requireText = (source, pattern, message) => assert.match(source, pattern, message);

// RC434: receipt, stock balance and inventory ledger must share one PostgreSQL transaction.
requireText(rc434, /create or replace function public\.receive_purchase_stock_atomic_backend\(/i, "RC434 atomic receipt function is required");
requireText(rc434, /erp_purchase_orders[\s\S]*?for update/i, "purchase order must be locked before receiving");
requireText(rc434, /erp_purchase_receipts[\s\S]*?on conflict do nothing/i, "receipt creation must handle uniqueness races");
requireText(rc434, /insert into public\.stock_balances[\s\S]*?on conflict \(warehouse_id,product_id\) do update/i, "stock balance must be updated atomically");
requireText(rc434, /insert into public\.inventory_transactions/i, "inventory ledger entry must be part of the transaction");
requireText(rc434, /m\.tenant_id=p_tenant_id[\s\S]*?m\.business_id=p_business_id[\s\S]*?m\.status='ACTIVE'/i, "actor membership must be tenant/business scoped");
requireText(rc434, /b\.id=p_business_id and b\.tenant_id=p_tenant_id/i, "business tenant scope must be verified");
requireText(rc434, /set search_path = ''/i, "SECURITY DEFINER function must use an empty search_path");
requireText(rc434, /revoke all on function public\.receive_purchase_stock_atomic_backend[\s\S]*?from public,anon,authenticated/i, "receipt RPC must revoke public and client execution");
requireText(rc434, /grant execute on function public\.receive_purchase_stock_atomic_backend[\s\S]*?to service_role/i, "receipt RPC must grant execution only to service_role");

// RC437: receiving must be bounded by approved order lines and exact unit cost.
requireText(rc437, /create table if not exists public\.erp_purchase_order_lines/i, "purchase order line table is required");
requireText(rc437, /received_quantity numeric\(18,4\) not null default 0 check \(received_quantity >= 0 and received_quantity <= ordered_quantity\)/i, "line received quantity must be constrained");
requireText(rc437, /create or replace function public\.receive_purchase_stock_with_order_line_backend\(/i, "line-aware receiving wrapper is required");
requireText(rc437, /for update/i, "order line must be locked while receiving");
requireText(rc437, /v_line\.received_quantity\+p_received_quantity>v_line\.ordered_quantity/i, "over-receiving must be rejected");
requireText(rc437, /p_unit_cost is distinct from v_line\.unit_cost/i, "receipt cost must match approved order line");
requireText(rc437, /update public\.erp_purchase_order_lines[\s\S]*?received_quantity=received_quantity\+p_received_quantity/i, "received quantity must increment in the same transaction");
requireText(rc437, /revoke all on function public\.receive_purchase_stock_with_order_line_backend[\s\S]*?from public,anon,authenticated/i, "line-aware RPC must revoke public and client execution");
requireText(rc437, /grant execute on function public\.receive_purchase_stock_with_order_line_backend[\s\S]*?to service_role/i, "line-aware RPC must grant execution only to service_role");

console.log("ERP receiving migration contract PASS (static SQL contract only)");
