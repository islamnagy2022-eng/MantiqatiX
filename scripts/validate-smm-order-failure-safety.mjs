import fs from "node:fs";
import assert from "node:assert/strict";

const edge=fs.readFileSync("supabase/functions/smm-gateway/index.ts","utf8");
const callStart=edge.indexOf("async function call(");
const callEnd=edge.indexOf("\nDeno.serve",callStart);
const providerCall=callStart>=0&&callEnd>callStart?edge.slice(callStart,callEnd):"";
const placeStart=edge.indexOf('if(a==="place_order")');
const statusStart=edge.indexOf('if(a==="order_status")',placeStart);
const orderFlow=placeStart>=0&&statusStart>placeStart?edge.slice(placeStart,statusStart):"";
const statusFlow=statusStart>=0?edge.slice(statusStart):"";

assert.match(providerCall,/AbortSignal\.timeout\(15000\)/,"provider request must have a bounded timeout");
assert.match(providerCall,/ProviderCallError\("Provider network outcome unknown",false\)/,"network errors must be treated as ambiguous, not definitive rejection");
assert.match(orderFlow,/WALLET_DEBIT_OUTCOME_UNKNOWN/,"ambiguous wallet debit must be reconciled, not retried as insufficient balance");
assert.match(orderFlow,/PROVIDER_OUTCOME_UNKNOWN/,"ambiguous provider outcome must be retained for reconciliation");
assert.match(orderFlow,/REFUND_OUTCOME_UNKNOWN/,"refund failure must not be reported as a successful refund");
assert.match(orderFlow,/if\(refund\.error\|\|refund\.data!==true\)/,"refund outcome must be checked before finalizing failure");
assert.match(orderFlow,/provider response lacks order correlation; reconciliation required/,"missing provider order ID must not trigger an automatic refund");
assert.match(orderFlow,/PROVIDER_ACCEPTED_PERSISTENCE_UNKNOWN/,"accepted provider order with failed local persistence must require reconciliation");
assert.match(orderFlow,/\.eq\("status","SUBMITTING"\)/,"provider order correlation update must be conditional on expected state");
assert.match(orderFlow,/targetUrl\.protocol/,"target URL must be protocol validated");
assert.match(orderFlow,/Number\.isFinite\(unitSell\)/,"price inputs must be validated before wallet debit");
assert.match(statusFlow,/\.eq\("user_id",user\.id\)/,"status read/write must remain scoped to the authenticated user");
assert.match(statusFlow,/ORDER_STATUS_PERSISTENCE_UNKNOWN/,"status persistence failure must be surfaced as reconciliation required");
assert.doesNotMatch(orderFlow,/return json\(\{error:"PROVIDER_EXECUTION_FAILED",message:/,"raw provider errors must not be reflected to the customer");
console.log("SMM order/refund failure-safety contract PASS.");
