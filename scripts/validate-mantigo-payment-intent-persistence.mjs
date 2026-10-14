import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/mantigo-payment-intent/index.ts", "utf8");
function check(label, condition) {
  assert.ok(condition, label);
  console.log("PASS " + label);
}

check("only REQUIRED or PENDING ledgers enter the payment-intent flow", source.includes('if(!["REQUIRED","PENDING"].includes(String(ledger.payment_status)))'));
check("a complete persisted intent requires provider ID, client secret and provider order ID", source.includes('ledger.provider==="PAYMOB"&&ledger.provider_intent_id&&metadata.paymob_client_secret&&metadata.paymob_intention_order_id'));
check("incomplete PENDING intent fails closed without another Paymob request", source.indexOf('if(ledger.payment_status==="PENDING")return json({error:"PAYMENT_INTENT_RECOVERY_REQUIRED"},409,requestId)') > source.indexOf("const metadata=") && source.indexOf('if(ledger.payment_status==="PENDING")return json({error:"PAYMENT_INTENT_RECOVERY_REQUIRED"},409,requestId)') < source.indexOf('fetch("https://accept.paymob.com/v1/intention/"'));
check("Paymob response must include client secret, provider intent ID and provider order ID", source.includes('const providerOrderId=String(provider.intention_order_id??"")') && source.includes('if(!providerResponse.ok||!clientSecret||!providerIntentId||!providerOrderId)'));
check("stored provider order ID is the exact validated response value", source.includes('paymob_intention_order_id:providerOrderId'));
check("ledger persistence uses compare-and-set on REQUIRED state", source.includes('.eq("id",ledger.id).eq("payment_status","REQUIRED").select("id").maybeSingle()'));
check("database error and zero-row compare-and-set both stop checkout secret delivery", source.includes('if(updateError)return json({error:"PAYMENT_INTENT_PERSISTENCE_FAILED"},500,requestId)') && source.includes('if(!persistedIntent)return json({error:"PAYMENT_INTENT_STATE_CHANGED"},409,requestId)'));
check("checkout response is returned only after successful persistence guard", source.indexOf('if(!persistedIntent)return json({error:"PAYMENT_INTENT_STATE_CHANGED"},409,requestId)') < source.lastIndexOf('return json({id:ledger.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret'));
console.log("MantiGO payment-intent persistence safety: PASS (static source contract; database/concurrency and live Paymob tests remain separate).");
