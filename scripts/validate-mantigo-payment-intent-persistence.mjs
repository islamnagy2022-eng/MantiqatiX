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
check("a complete persisted intent is reusable only from PENDING state and loads its secret from service-only storage", source.includes('ledger.payment_status==="PENDING"&&ledger.provider==="PAYMOB"&&ledger.provider_intent_id&&metadata.paymob_intention_order_id') && source.includes('admin.from("mantigo_payment_intent_secrets")'));
check("incomplete PENDING ledger, partial provider state, or existing claim fails closed before a new provider request", source.includes('if(ledger.payment_status==="PENDING"||metadata.paymob_intent_claim||') && source.includes("PAYMENT_INTENT_RECOVERY_REQUIRED") && source.indexOf("PAYMENT_INTENT_RECOVERY_REQUIRED") < providerRequest);
check("database claim RPC executes before any external Paymob request", claimIndex >= 0 && claimIndex < providerRequest);
check("claim failure or lost race prevents external provider request", claimFailedIndex >= 0 && claimFailedIndex < providerRequest && claimLostIndex >= 0 && claimLostIndex < providerRequest);
check("claim RPC only updates a REQUIRED ledger with no existing intent, claim, or secret", migration.includes("payment_status = 'REQUIRED'") && migration.includes("provider_intent_id is null") && migration.includes("not (coalesce(metadata, '{}'::jsonb) ? 'paymob_intent_claim')") && migration.includes("not exists (select 1 from public.mantigo_payment_intent_claims") && migration.includes("not exists (select 1 from public.mantigo_payment_intent_secrets"));
check("claim, finalize, and release RPCs use an empty search_path and service-role-only execution", (migration.match(/set search_path = ''/g) ?? []).length === 3 && migration.includes("to service_role") && migration.includes("from public, anon, authenticated") && migration.includes("release_mantigo_payment_intent_claim_backend(text, text, integer)") && migration.includes("create policy mantigo_payment_intent_claims_service_role") && migration.includes("create policy mantigo_payment_intent_secrets_service_role"));
check("claim RPC signatures match the production text primary key", migration.includes("p_ledger_id text") && migration.includes("claim_mantigo_payment_intent_backend(text, text)") && migration.includes("finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb)") && fs.readFileSync("supabase/tests/rc526_mantigo_payment_intent_fixture.sql", "utf8").includes("id text primary key"));
check("disposable ledger fixture preserves production NOT NULL/check constraints", fs.readFileSync("supabase/tests/rc526_mantigo_payment_intent_fixture.sql", "utf8").includes("captain_id uuid not null") && fs.readFileSync("supabase/tests/rc526_mantigo_payment_intent_fixture.sql", "utf8").includes("idempotency_key text not null unique") && fs.readFileSync("supabase/tests/rc526_mantigo_payment_intent_fixture.sql", "utf8").includes("payment_status text not null default 'REQUIRED' check"));
check("claim tokens and checkout secrets are not stored in customer-readable ledger metadata", !migration.includes("'token', p_claim_token") && !migration.includes("'token_hash'") && !migration.includes("'paymob_client_secret', p_client_secret") && migration.includes("create table if not exists public.mantigo_payment_intent_claims") && migration.includes("create table if not exists public.mantigo_payment_intent_secrets") && source.includes('admin.from("mantigo_payment_intent_secrets")') && integration.includes("RC526_CLAIM_TOKEN_MUST_STAY_OUT_OF_LEDGER_METADATA") && integration.includes("RC526_INTERNAL_PAYMENT_TABLES_MUST_NOT_BE_CLIENT_READABLE"));
check("partial provider state and prior claim fail closed before a new provider request", source.includes('if(ledger.payment_status==="PENDING"||metadata.paymob_intent_claim||') && source.includes("PAYMENT_INTENT_RECOVERY_REQUIRED") && source.indexOf("PAYMENT_INTENT_RECOVERY_REQUIRED") < providerRequest && !source.includes("metadata.paymob_client_secret"));
check("Paymob request is bounded and network ambiguity preserves the claim", source.includes("signal:AbortSignal.timeout(15000)") && source.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN") && source.includes("recoveryRequired:true"));
check("only explicit non-null provider rejection statuses can release the matching claim", migration.includes("p_http_status is null") && migration.includes("p_http_status not in (400, 401, 403, 404, 422)") && migration.includes("c.claim_token = p_claim_token") && source.includes('admin.rpc("release_mantigo_payment_intent_claim_backend"') && source.includes("[400,401,403,404,422]"));
check("wrong token, NULL and ambiguous status cannot release a claim; confirmed 4xx permits retry", integration.includes("RC526_WRONG_TOKEN_MUST_NOT_RELEASE") && integration.includes("RC526_NULL_STATUS_MUST_NOT_RELEASE") && integration.includes("RC526_AMBIGUOUS_STATUS_MUST_NOT_RELEASE") && integration.includes("RC526_CONFIRMED_REJECTION_MUST_ALLOW_SAFE_RETRY"));
check("Paymob response must include client secret, provider intent ID and provider order ID", source.includes('const providerOrderId=String(provider.intention_order_id??"")') && source.includes('if(!providerResponse.ok||!clientSecret||!providerIntentId||!providerOrderId)'));
check("unconfirmed provider response retains claim and blocks blind retry", source.includes('error:"PAYMENT_PROVIDER_INTENT_UNCONFIRMED",recoveryRequired:true') && source.includes("Keep the claim"));
check("finalization RPC compares a private claim token and REQUIRED state inside PostgreSQL", finalizeIndex >= 0 && migration.includes("c.claim_token = p_claim_token") && migration.includes("payment_status = 'REQUIRED'") && migration.includes("insert into public.mantigo_payment_intent_secrets") && migration.includes("delete from public.mantigo_payment_intent_claims"));
check("database error or unsuccessful finalization prevents checkout secret delivery", persistenceFailureIndex >= 0 && persistenceLostIndex >= 0 && persistenceLostIndex < checkoutResponseIndex && persistenceFailureIndex < checkoutResponseIndex);
check("integration tests prove one claim winner, wrong-token rejection and finalization recovery", integration.includes("RC526_CLAIM_MUST_ALLOW_ONLY_ONE_WINNER") && integration.includes("RC526_WRONG_CLAIM_MUST_NOT_FINALIZE") && integration.includes("RC526_FINALIZED_LEDGER_CONTRACT_MISMATCH"));
check("integration tests exercise claim races through two independent PostgreSQL sessions", integration.includes("dblink_send_query") && integration.includes("RC526_CONCURRENT_CLAIM_MUST_HAVE_EXACTLY_ONE_WINNER"));
check("edge function does not directly mutate the financial ledger", !source.includes('.from("mantigo_financial_ledger").update('));
console.log("MantiGO payment-intent persistence safety: PASS (static contract plus disposable SQL integration tests; live Paymob E2E remains separate).");
