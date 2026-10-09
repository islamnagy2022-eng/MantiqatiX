import fs from "node:fs";

const edge = fs.readFileSync("supabase/functions/erp-purchase-receive/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261009200000_rc434_atomic_erp_purchase_receiving.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc434_erp_receiving_integration.sql", "utf8");
const checks = [];
function check(name, ok) { checks.push({name,ok:Boolean(ok)}); if(!ok) console.error("FAIL "+name); }
check("Edge Function calls atomic backend RPC", edge.includes('rpc("receive_purchase_stock_atomic_backend"'));
check("Edge Function contains no direct stock balance mutation", !edge.includes('.from("stock_balances").update') && !edge.includes('.from("stock_balances").insert'));
check("Edge Function contains no direct receipt or inventory ledger writes", !edge.includes('.from("erp_purchase_receipts").insert') && !edge.includes('.from("inventory_transactions").insert'));
check("RPC validates actor membership in tenant/business scope", migration.includes("m.user_id=p_actor_user_id") && migration.includes("m.tenant_id=p_tenant_id") && migration.includes("m.business_id=p_business_id"));
check("RPC requires an approved purchase order", migration.includes("PURCHASE_ORDER_NOT_APPROVED") && migration.includes("upper(v_order.status) <> 'APPROVED'"));
check("receipt idempotency conflicts are rejected", migration.includes("RECEIPT_IDEMPOTENCY_CONFLICT"));
check("receipt, stock and inventory transaction are in one function transaction", migration.includes("insert into public.erp_purchase_receipts") && migration.includes("insert into public.stock_balances as sb") && migration.includes("insert into public.inventory_transactions"));
check("RPC is service-role-only", migration.includes("from public,anon,authenticated") && migration.includes("to service_role"));
check("integration test covers retry, authorization and rollback", integration.includes("same receipt retry was not idempotent") && integration.includes("PURCHASE_RECEIVING_ROLE_REQUIRED") && integration.includes("RC434_FORCED_LEDGER_FAILURE"));
const failed=checks.filter(x=>!x.ok);
if(failed.length) process.exit(1);
console.log("ERP receiving safety contract PASS: "+checks.length+"/"+checks.length+" checks.");
