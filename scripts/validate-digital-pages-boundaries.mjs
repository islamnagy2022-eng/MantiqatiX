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


// RC431 source contract: validate the hardened replacement, not only the original RC424 implementation.
const hardenedPayment = fs.readFileSync('supabase/migrations/20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql','utf8');
for (const [marker,label] of [
  ["set search_path = ''","empty SECURITY DEFINER search_path"],
  ["p_status is null or p_status not in ('SUCCEEDED', 'FAILED')","NULL/invalid provider status rejection"],
  ["p_external_event_id is distinct from ('paymob:' || p_provider_transaction_id)","event/transaction ID binding"],
  ["DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH","provider order binding"],
  ["DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH","replay status consistency"],
  ["for update","row-locking for order/event processing"],
  ["DIGITAL_PAGE_PAYMENT_STATE_CHANGED","conditional payment state transition guard"],
  ["revoke all on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) from public;","PUBLIC execute revoked"],
  ["revoke all on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) from anon;","anon execute revoked"],
  ["revoke all on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) from authenticated;","authenticated execute revoked"],
  ["grant execute on function public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb) to service_role;","service_role-only execute grant"]
]) {
  if (!hardenedPayment.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error('RC431 hardened payment source contract missing: '+label);
  }
}

console.log('RC424/RC431 digital pages/payment boundary validation: PASS');

