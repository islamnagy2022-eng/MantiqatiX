import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const atomicPayment=fs.readFileSync('supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql','utf8');
const forwardPayment=fs.readFileSync('supabase/migrations/20261117020000_rc470_digital_page_webhook_forward_repair.sql','utf8');
const paymentIntegration=fs.readFileSync('supabase/tests/rc431_digital_page_payment_integration.sql','utf8');
for(const [src,marker,label] of [
 [order,'admin.auth.getUser','authenticated order creation'],[order,'idempotencyKey','order idempotency'],[order,'digital_page_products','server product pricing'],[order,'BUSINESS_SCOPE_FORBIDDEN','business scope check'],
 [payment,'p_user_id:user.id','authenticated order ownership binding'],[payment,'provider_intent_id','duplicate payment-intent guard'],[payment,'p_provider_intent_id:providerIntentId','provider correlation finalization'],
 [payment,'p_provider_order_id:providerOrderId','provider order correlation persistence'],[payment,'PAYMENT_PROVIDER_INTENT_MISMATCH','mismatched provider intent fails closed'],[payment,'PAYMENT_PROVIDER_OUTCOME_UNKNOWN','ambiguous provider outcome requires reconciliation'],
 [payment,'CUSTOMER_BILLING_CONTACT_REQUIRED','real billing contact required'],[payment,'claim_digital_page_payment_intent_backend','atomic payment-intent claim'],[payment,'finalize_digital_page_payment_intent_backend','payment-intent finalization boundary'],[payment,'release_digital_page_payment_intent_claim_backend','payment-intent claim release'],[payment,'PAYMENT_INTENT_IN_PROGRESS','concurrent intent guard'],[payment,'PAYMOB_PUBLIC_KEY','checkout URL contract'],
 [atomicPayment,'digital_page_payment_events','digital-page payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','amount/currency binding'],[webhook,'DIGITAL_PAGE_PAYMENT','payment notification'],[webhook,'process_verified_digital_page_payment_backend','atomic verified payment processor'],
 [atomicPayment,'for update','order row lock for payment state transition'],[atomicPayment,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','atomic amount/currency binding'],[atomicPayment,'DIGITAL_PAGE_EVENT_ORDER_MISMATCH','event/order correlation'],[atomicPayment,'to service_role','service-role-only payment processor'],[atomicPayment,'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER','page cannot be reused across orders'],[atomicPayment,'MENU_BUSINESS_SCOPE_REQUIRED','menu fulfillment business ownership'],[atomicPayment,'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER','published-page replay binding']
]) if(!src.includes(marker)) throw new Error('Digital page boundary marker missing: '+label);
if(/customer@example\.com|\+201000000000/.test(payment)) throw new Error('Fake payment billing fallback detected');
// The Paymob callback HMAC covers order.id, but merchant_order_id is not
// in the signed field list. Treat merchant_order_id only as a lookup hint and
// bind the selected row to the provider-signed order ID before the payment RPC.
const verifyStart=webhook.indexOf('async function verify(');
const verifyEnd=webhook.indexOf('Deno.serve(',verifyStart);
const hmacVerifier=verifyStart>=0?webhook.slice(verifyStart,verifyEnd>verifyStart?verifyEnd:webhook.length):'';
if(!hmacVerifier.includes('order.id') || hmacVerifier.includes('merchant_order_id')) {
  throw new Error('Paymob HMAC trust boundary changed: verify order.id and do not treat merchant_order_id as signed');
}
const digitalLookup=webhook.indexOf('const {data:digitalByRef}');
const digitalOrderGuard=webhook.indexOf('if(!paymobOrderId||String(digital.provider_order_id??"")!==paymobOrderId)');
const digitalPaymentRpc=webhook.indexOf('admin.rpc("process_verified_digital_page_payment_backend"');
if(digitalLookup<0 || digitalOrderGuard<=digitalLookup || digitalPaymentRpc<=digitalOrderGuard) {
  throw new Error('Digital-page webhook must bind stored provider_order_id to signed Paymob order.id before processor RPC');
}
if(!forwardPayment.includes('v_order.provider_order_id <> p_provider_order_id') ||
   !forwardPayment.includes('DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH')) {
  throw new Error('RC470 database processor must independently enforce provider-order binding');
}
if(!paymentIntegration.includes('mismatched provider order was not rejected') ||
   !paymentIntegration.includes('provider-order mismatch changed the order status') ||
   !paymentIntegration.includes('provider-order mismatch persisted a payment event')) {
  throw new Error('RC431 integration must deny provider-order mismatch without state/event mutation');
}
if(webhook.includes('from(\"digital_page_payment_events\").insert') || webhook.includes('from(\"digital_page_orders\").update')) throw new Error('Digital-page webhook must use the atomic database payment processor');
console.log('RC424 digital pages/payment boundary validation: PASS');
