import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("supabase/functions/mantigo-payment-intent/index.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261014233000_rc526_mantigo_payment_intent_claim.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc526_mantigo_payment_intent_integration.sql", "utf8");
function check(label, condition) {
  assert.ok(condition, label);
  console.log("PASS " + label);
}

const providerRequest = source.indexOf('fetch("https://accept.paymob.com/v1/intention/"');
const claimIndex = source.indexOf('admin.rpc("claim_mantigo_payment_intent_backend"');
const claimFailedIndex = source.indexOf('if(claimError)return json({error:"PAYMENT_INTENT_CLAIM_FAILED"},500,requestId)');
const claimLostIndex = source.indexOf('if(claimed!==true)return json({error:"PAYMENT_INTENT_STATE_CHANGED"},409,requestId)');
const finalizeIndex = source.indexOf('admin.rpc("finalize_mantigo_payment_intent_backend"');
const persistenceFailureIndex = source.indexOf('if(updateError)return json({error:"PAYMENT_INTENT_PERSISTENCE_FAILED",recoveryRequired:true},500,requestId)');
const persistenceLostIndex = source.indexOf('if(persistedIntent!==true)return json({error:"PAYMENT_INTENT_STATE_CHANGED",recoveryRequired:true},409,requestId)');
const checkoutResponseIndex = source.lastIndexOf('return json({id:ledger.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret');

check("only REQUIRED or PENDING ledgers enter the payment-intent flow", source.includes('if(!["REQUIRED","PENDING"].includes(String(ledger.payment_status)))'));
check("a complete persisted intent requires provider ID, client secret and provider order ID", source.includes('ledger.provider==="PAYMOB"&&ledger.provider_intent_id&&metadata.paymob_client_secret&&metadata.paymob_intention_order_id'));
check("incomplete PENDING ledger or existing claim fails closed before a new provider request", source.includes('if(ledger.payment_status==="PENDING"||metadata.paymob_intent_claim)return json({error:"PAYMENT_INTENT_RECOVERY_REQUIRED"},409,requestId)') && source.indexOf("PAYMENT_INTENT_RECOVERY_REQUIRED") < providerRequest);
check("database claim RPC executes before any external Paymob request", claimIndex >= 0 && claimIndex < providerRequest);
check("claim failure or lost race prevents external provider request", claimFailedIndex >= 0 && claimFailedIndex < providerRequest && claimLostIndex >= 0 && claimLostIndex < providerRequest);
check("claim RPC only updates a REQUIRED ledger with no existing intent or claim", migration.includes("payment_status = 'REQUIRED'") && migration.includes("provider_intent_id is null") && migration.includes("not (coalesce(metadata, '{}'::jsonb) ? 'paymob_intent_claim')"));
check("claim and finalize RPCs use an empty search_path and service-role-only execution", (migration.match(/set search_path = ''/g) ?? []).length === 2 && migration.includes("to service_role") && migration.includes("from public, anon, authenticated"));
check("Paymob response must include client secret, provider intent ID and provider order ID", source.includes('const providerOrderId=String(provider.intention_order_id??"")') && source.includes('if(!providerResponse.ok||!clientSecret||!providerIntentId||!providerOrderId)'));
check("unconfirmed provider response retains claim and blocks blind retry", source.includes('error:"PAYMENT_PROVIDER_INTENT_UNCONFIRMED",recoveryRequired:true') && source.includes("Keep the claim"));
check("finalization RPC compares claim token and REQUIRED state inside PostgreSQL", finalizeIndex >= 0 && migration.includes("metadata -> 'paymob_intent_claim' ->> 'token' = p_claim_token") && migration.includes("payment_status = 'REQUIRED'"));
check("database error or unsuccessful finalization prevents checkout secret delivery", persistenceFailureIndex >= 0 && persistenceLostIndex >= 0 && persistenceLostIndex < checkoutResponseIndex && persistenceFailureIndex < checkoutResponseIndex);
check("integration tests prove one claim winner, wrong-token rejection and finalization recovery", integration.includes("RC526_CLAIM_MUST_ALLOW_ONLY_ONE_WINNER") && integration.includes("RC526_WRONG_CLAIM_MUST_NOT_FINALIZE") && integration.includes("RC526_FINALIZED_LEDGER_CONTRACT_MISMATCH"));
check("integration tests exercise claim races through two independent PostgreSQL sessions", integration.includes("dblink_send_query") && integration.includes("RC526_CONCURRENT_CLAIM_MUST_HAVE_EXACTLY_ONE_WINNER"));
check("edge function does not directly mutate the financial ledger", !source.includes('.from("mantigo_financial_ledger").update('));
console.log("MantiGO payment-intent persistence safety: PASS (static contract plus disposable SQL integration tests; live Paymob E2E remains separate).");
