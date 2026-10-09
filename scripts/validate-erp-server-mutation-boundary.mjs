import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");
const edge = fs.readFileSync("supabase/functions/erp-mutation/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261010040000_rc442_erp_service_role_mutations.sql", "utf8");

for (const name of [
  "create_purchase_order_backend",
  "update_purchase_order_status_backend",
  "receive_purchase_stock_backend",
  "create_stock_transfer_backend",
  "update_stock_transfer_status_backend",
  "receive_stock_transfer_backend",
]) {
  assert.doesNotMatch(app, new RegExp("erpRpc\\(['\\\"]" + name + "['\\\"]"), `${name} must not be called directly from the browser`);
}
for (const action of ["purchase-order-status", "stock-transfer-create", "stock-transfer-status", "stock-transfer-receive"]) {
  assert.match(app, new RegExp("erpServerMutation\\(['\\\"]" + action + "['\\\"]"), `browser must route ${action} through the Edge boundary`);
  assert.match(edge, new RegExp(action), `Edge boundary must explicitly handle ${action}`);
}
assert.match(edge, /admin\.auth\.getUser\(authorization\.slice\(7\)\.trim\(\)\)/, "Edge must verify bearer token before using actor identity");
assert.match(edge, /p_actor_user_id:\s*user\.id/g, "all service RPC calls must bind actor to verified user");
assert.match(edge, /admin\.rpc\(rpc, args\)/, "Edge calls the allowlisted service RPC");
assert.doesNotMatch(edge, /rpc\(String\(|rpc\(action/, "client input must not select arbitrary RPC names");
assert.equal((migration.match(/set search_path = ''/g) || []).length, 4, "all four SECURITY DEFINER RPCs must pin an empty search_path");
assert.equal((migration.match(/m\.status='ACTIVE'/g) || []).length, 4, "all four service RPCs must require active membership");
assert.match(migration, /revoke all on function public\.receive_stock_transfer_service_backend[\s\S]*?from public,anon,authenticated/i);
assert.match(migration, /grant execute on function public\.receive_stock_transfer_service_backend[\s\S]*?to service_role/i);
assert.match(migration, /pg_advisory_xact_lock/, "transfer creation and stock mutation must be serialized");
assert.match(migration, /TRANSFER_IDEMPOTENCY_CONFLICT/, "conflicting create replay must fail closed");
assert.match(migration, /INSUFFICIENT_AVAILABLE_STOCK/, "transfer receipt must check available stock");
assert.match(migration, /TRANSFER_OUT/);
assert.match(migration, /TRANSFER_IN/);
console.log("RC442 ERP server mutation boundary PASS");
