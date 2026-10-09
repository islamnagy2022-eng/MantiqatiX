import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");
const web = fs.readFileSync("web/smm.js", "utf8");
const checks = [];
function check(name, ok) {
  checks.push({ name, ok: Boolean(ok) });
  if (!ok) console.error("FAIL " + name);
}
const unknownStart = source.indexOf('if(!definitive){');
const unknownEnd = source.indexOf('const refund=await admin.rpc("smm_refund_wallet"', unknownStart);
const unknownBranch = unknownStart >= 0 && unknownEnd >= 0 ? source.slice(unknownStart, unknownEnd) : "";
const persistenceStart = source.indexOf('const persisted=await admin.from("smm_orders")');
const persistenceEnd = source.indexOf('const event=await admin.from("smm_order_events")', persistenceStart);
const persistenceBranch = persistenceStart >= 0 && persistenceEnd >= 0 ? source.slice(persistenceStart, persistenceEnd) : "";
check("provider call has bounded timeout", source.includes("AbortSignal.timeout(15000)"));
check("network/HTTP ambiguity has a typed non-definitive error", source.includes('new ProviderCallError("Provider network outcome unknown",false)') && source.includes('Provider response outcome unknown'));
check("ambiguous provider outcomes require reconciliation", unknownBranch.includes('PROVIDER_OUTCOME_UNKNOWN') && unknownBranch.includes("reconciliation_required:true"));
check("ambiguous provider outcomes never auto-refund", unknownBranch.length > 0 && !unknownBranch.includes("smm_refund_wallet"));
check("refund branch requires explicit rejection", source.includes('const definitive=e instanceof ProviderCallError&&e.definitiveRejection'));
check("accepted provider order is persisted conditionally", persistenceBranch.includes('.eq("status","SUBMITTING").select("id").maybeSingle()'));
check("provider accepted but persistence failed is not auto-refunded", persistenceBranch.includes("PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN") && !persistenceBranch.includes("smm_refund_wallet"));
check("provider order id missing is treated as ambiguous", source.includes('PROVIDER_ORDER_ID_MISSING') && source.includes('reconciliation_required:true'));
check("order status is scoped to requesting user", source.includes('.eq("id",b.order_id).eq("user_id",user.id)'));
check("admin-only operations verify server-side admin status", (source.match(/await isAdmin\(user\.id\)/g)||[]).length >= 5);
const adminGuardStart = source.indexOf("async function isAdmin");
const adminGuardEnd = source.indexOf("async function secret", adminGuardStart);
const adminGuard = adminGuardStart >= 0 && adminGuardEnd >= 0 ? source.slice(adminGuardStart, adminGuardEnd) : "";
check("SMM admin guard uses explicit backend-only allowlist", adminGuard.includes('from("smm_admins")') && !adminGuard.includes("user_memberships"));
check("admin UI visibility is derived from backend admin check", web.includes("action:'admin_access'") && !web.includes("from('user_memberships')"));
check("wallet debit RPC ambiguity does not trigger automatic refund", source.includes('if(debit.error){') && source.includes("WALLET_DEBIT_OUTCOME_UNKNOWN") && source.indexOf('if(debit.error){') < source.indexOf('if(debit.data!==true)'));
check("terminal order statuses cannot be downgraded by provider polling", source.includes('new Set(["COMPLETED","CANCELLED","FAILED","REFUNDED"])') && source.includes('if(!terminal.has(st))'));
const failed = checks.filter(x => !x.ok);
if (failed.length) process.exit(1);
console.log("SMM provider/wallet safety contract PASS: " + checks.length + "/" + checks.length + " checks.");
