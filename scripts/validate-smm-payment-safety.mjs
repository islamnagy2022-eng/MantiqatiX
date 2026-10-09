import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");
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
const failed = checks.filter(x => !x.ok);
if (failed.length) process.exit(1);
console.log("SMM provider/wallet safety contract PASS: " + checks.length + "/" + checks.length + " checks.");
