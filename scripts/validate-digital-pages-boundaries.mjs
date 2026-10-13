import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const atomicPayment=fs.readFileSync('supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql','utf8');
for(const [src,marker,label] of [
 [order,'admin.auth.getUser','authenticated order creation'],[order,'idempotencyKey','order idempotency'],[order,'digital_page_products','server product pricing'],[order,'BUSINESS_SCOPE_FORBIDDEN','business scope check'],
 [payment,'p_user_id:user.id','authenticated order ownership binding'],[payment,'provider_intent_id','duplicate payment-intent guard'],[payment,'p_provider_intent_id:String(p.id)','provider correlation finalization'],
 [payment,'CUSTOMER_BILLING_CONTACT_REQUIRED','real billing contact required'],[payment,'claim_digital_page_payment_intent_backend','atomic payment-intent claim'],[payment,'finalize_digital_page_payment_intent_backend','payment-intent finalization boundary'],[payment,'release_digital_page_payment_intent_claim_backend','payment-intent claim release'],[payment,'PAYMENT_INTENT_IN_PROGRESS','concurrent intent guard'],[payment,'PAYMOB_PUBLIC_KEY','checkout URL contract'],
 [atomicPayment,'digital_page_payment_events','digital-page payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','amount/currency binding'],[webhook,'DIGITAL_PAGE_PAYMENT','payment notification'],[webhook,'process_verified_digital_page_payment_backend','atomic verified payment processor'],
 [atomicPayment,'for update','order row lock for payment state transition'],[atomicPayment,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','atomic amount/currency binding'],[atomicPayment,'DIGITAL_PAGE_EVENT_ORDER_MISMATCH','event/order correlation'],[atomicPayment,'to service_role','service-role-only payment processor'],[atomicPayment,'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER','page cannot be reused across orders'],[atomicPayment,'MENU_BUSINESS_SCOPE_REQUIRED','menu fulfillment business ownership'],[atomicPayment,'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER','published-page replay binding']
]) if(!src.includes(marker)) throw new Error('Digital page boundary marker missing: '+label);
if(/customer@example\.com|\+201000000000/.test(payment)) throw new Error('Fake payment billing fallback detected');
if(webhook.includes('from(\"digital_page_payment_events\").insert') || webhook.includes('from(\"digital_page_orders\").update')) throw new Error('Digital-page webhook must use the atomic database payment processor');
console.log('RC424 digital pages/payment boundary validation: PASS');

// S05 payment callback regression contract: the verified-signature gate must
// precede every digital-page payment RPC invocation in the webhook source.
for (const [marker,label] of [
  ['async function hmacSha512Hex','Paymob HMAC-SHA512 implementation'],
  ['async function verify','provider signature verifier'],
  ['if(!HMAC_SECRET)return json({error:"PAYMENT_CALLBACK_NOT_CONFIGURED"','missing HMAC secret fails closed'],
  ['INVALID_PROVIDER_SIGNATURE','invalid signature rejection'],
  ['p_signature_verified:true','signature assertion passed only after verification']
]) {
  if (!webhook.includes(marker)) throw new Error('S05 webhook signature contract missing: '+label);
}
const signatureGate = webhook.indexOf('if(!(await verify(obj,order,source,value(raw.hmac??obj.hmac))))');
const digitalPaymentRpc = webhook.indexOf('admin.rpc("process_verified_digital_page_payment_backend"');
if (signatureGate < 0 || digitalPaymentRpc < 0 || signatureGate >= digitalPaymentRpc) {
  throw new Error('S05 webhook signature gate must occur before the digital-page payment RPC');
}

// S05 MantiGO regression contract: the signed Paymob order ID must bind to the
// exact MantiGO ledger intent before an event can be persisted or the ledger changed.
for (const [marker,label] of [
  ['MANTIGO_PROVIDER_ORDER_MISMATCH','MantiGO provider/order mismatch rejection'],
  ['mantigoMetadata.paymob_intention_order_id','stored Paymob intention order ID'],
  ['String(mantigoMetadata.paymob_intention_order_id)!==paymobOrderId','exact signed order ID equality'],
  ['mantigo.provider!=="PAYMOB"','MantiGO ledger provider binding'],
  ['mantigo.provider_intent_id','MantiGO provider intent existence']
]) {
  if (!webhook.includes(marker)) throw new Error('S05 MantiGO callback contract missing: '+label);
}
const mantigoOrderGate = webhook.indexOf('MANTIGO_PROVIDER_ORDER_MISMATCH');
const mantigoRpc = webhook.indexOf('admin.rpc("process_verified_mantigo_payment_backend"', webhook.indexOf('const {data:mantigo}='));
if (mantigoOrderGate < 0 || mantigoRpc < 0 || mantigoOrderGate >= mantigoRpc) {
  throw new Error('S05 MantiGO provider/order gate must precede the atomic payment RPC');
}

// S05 MantiGO atomicity release gate. This intentionally fails until the webhook
// delegates event idempotency + ledger transition to one transactional RPC.
const mantigoStart = webhook.indexOf('const {data:mantigo}=');
const generalIntentStart = webhook.indexOf('const {data:intentByRef}=');
if (mantigoStart < 0 || generalIntentStart < 0 || mantigoStart >= generalIntentStart) {
  throw new Error('S05 MantiGO branch boundary could not be located');
}
const mantigoBranch = webhook.slice(mantigoStart, generalIntentStart);
if (!mantigoBranch.includes('admin.rpc("process_verified_mantigo_payment_backend"')) {
  throw new Error('S05 release BLOCKED: MantiGO webhook must use the atomic process_verified_mantigo_payment_backend RPC');
}
if (mantigoBranch.includes('from("payment_provider_events").insert') ||
    mantigoBranch.includes('from("mantigo_financial_ledger").update')) {
  throw new Error('S05 release BLOCKED: MantiGO event persistence and ledger transition must not be separate Edge Function writes');
}
