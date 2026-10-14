import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/mantigo-payment-intent/index.ts", "utf8");
function check(label, condition) {
  assert.ok(condition, label);
  console.log("PASS " + label);
}

const providerRequest = source.indexOf('fetch("https://accept.paymob.com/v1/intention/"');
const claimIndex = source.indexOf("const claimToken=crypto.randomUUID()");
const claimFailedIndex = source.indexOf('if(claimError)return json({error:"PAYMENT_INTENT_CLAIM_FAILED"},500,requestId)');
const claimLostIndex = source.indexOf('if(!claimed)return json({error:"PAYMENT_INTENT_STATE_CHANGED"},409,requestId)');
const persistenceFailureIndex = source.indexOf('if(updateError)return json({error:"PAYMENT_INTENT_PERSISTENCE_FAILED"},500,requestId)');
const persistenceLostIndex = source.indexOf('if(!persistedIntent)return json({error:"PAYMENT_INTENT_STATE_CHANGED"},409,requestId)');
const checkoutResponseIndex = source.lastIndexOf('return json({id:ledger.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret');

check("only REQUIRED or PENDING ledgers enter the payment-intent flow", source.includes('if(!["REQUIRED","PENDING"].includes(String(ledger.payment_status)))'));
check("a complete persisted intent requires provider ID, client secret and provider order ID", source.includes('ledger.provider==="PAYMOB"&&ledger.provider_intent_id&&metadata.paymob_client_secret&&metadata.paymob_intention_order_id'));
check("incomplete PENDING ledger or existing claim fails closed before a new provider request", source.includes('if(ledger.payment_status==="PENDING"||metadata.paymob_intent_claim)return json({error:"PAYMENT_INTENT_RECOVERY_REQUIRED"},409,requestId)') && source.indexOf("PAYMENT_INTENT_RECOVERY_REQUIRED") < providerRequest);
check("external Paymob request is preceded by a compare-and-set claim on REQUIRED with no provider intent", claimIndex >= 0 && claimIndex < providerRequest && source.includes('.eq("id",ledger.id).eq("payment_status","REQUIRED").is("provider_intent_id",null).select("id").maybeSingle()'));
check("claim failure or lost race prevents external provider request", claimFailedIndex >= 0 && claimFailedIndex < providerRequest && claimLostIndex >= 0 && claimLostIndex < providerRequest);
check("Paymob response must include client secret, provider intent ID and provider order ID", source.includes('const providerOrderId=String(provider.intention_order_id??"")') && source.includes('if(!providerResponse.ok||!clientSecret||!providerIntentId||!providerOrderId)'));
check("unconfirmed provider response retains claim and blocks blind retry", source.includes('error:"PAYMENT_PROVIDER_INTENT_UNCONFIRMED",recoveryRequired:true') && source.includes("Keep the claim"));
check("stored provider order ID is the exact validated response value", source.includes('paymob_intention_order_id:providerOrderId'));
check("final persistence compares claim token, REQUIRED state and absent provider ID", source.includes('.eq("id",ledger.id).eq("payment_status","REQUIRED").eq("metadata->paymob_intent_claim->>token",claimToken).is("provider_intent_id",null).select("id").maybeSingle()'));
check("database error and zero-row compare-and-set stop checkout secret delivery", persistenceFailureIndex >= 0 && persistenceLostIndex >= 0 && persistenceLostIndex < checkoutResponseIndex && persistenceFailureIndex < checkoutResponseIndex);
check("checkout response is returned only after successful persistence guard", persistenceLostIndex < checkoutResponseIndex);
console.log("MantiGO payment-intent persistence safety: PASS (static source contract; database/concurrency and live Paymob tests remain separate).");
