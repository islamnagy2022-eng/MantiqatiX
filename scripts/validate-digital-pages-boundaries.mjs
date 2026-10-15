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



// RC426-RC430 source contracts: provider correlation and webhook paths must remain hardened together.
const sourceContracts = [
  ['supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql', [
    ["p_provider_order_id text","provider order is an explicit argument"],
    ["PAYMOB_PROVIDER_CORRELATION_REQUIRED","provider correlation required"],
    ["auth.uid() <> p_user_id","payment intent owner binding"],
    ["metadata->'payment_intent_claim'->>'token' = p_claim_token","claim token binding"],
    ["set search_path = ''","empty SECURITY DEFINER search_path"]
  ]],
  ['supabase/migrations/20261009140000_rc427_one_active_payment_intent_per_order.sql', [
    ["RC427_DUPLICATE_ACTIVE_PAYMENT_INTENTS_REQUIRE_RECONCILIATION","fail closed on pre-existing duplicate intents"],
    ["uq_payment_intents_one_active_per_order","unique active intent index"],
    ["where upper(status) in ('CREATED', 'PENDING', 'SUCCEEDED')","active intent predicate"]
  ]],
  ['supabase/migrations/20261009150000_rc428_atomic_provider_failure_webhook.sql', [
    ["PAYMENT_FAILURE_SIGNATURE_REQUIRED","signed failure callback required"],
    ["PAYMENT_PROVIDER_ORDER_MISMATCH","provider order binding"],
    ["PRICING_BINDING_MISMATCH","immutable pricing binding"],
    ["PAYMENT_FAILURE_REPLAY_STATUS_MISMATCH","failure replay status consistency"],
    ["grant execute on function public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb) to service_role;","service-role-only failure processor"]
  ]],
  ['supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql', [
    ["SUBSCRIPTION_PAYMENT_TRANSACTION_MISMATCH","subscription transaction/event binding"],
    ["SUBSCRIPTION_PROVIDER_ORDER_MISMATCH","subscription provider order binding"],
    ["SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH","subscription replay correlation"],
    ["grant execute on function public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb) to service_role;","service-role-only subscription failure processor"]
  ]],
  ['supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql', [
    ["SUBSCRIPTION_PAYMENT_TRANSACTION_MISMATCH","subscription success transaction/event binding"],
    ["SUBSCRIPTION_PROVIDER_ORDER_MISMATCH","subscription success provider order binding"],
    ["SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH","subscription success replay correlation"],
    ["PAID_PENDING_LEGAL","do not activate when legal authorization is missing"],
    ["grant execute on function public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb) to service_role;","service-role-only subscription success processor"]
  ]]
];
for (const [pathName, checks] of sourceContracts) {
  const source = fs.readFileSync(pathName, 'utf8').toLowerCase();
  for (const [marker,label] of checks) {
    if (!source.includes(marker.toLowerCase())) {
      throw new Error(pathName+' source contract missing: '+label);
    }
  }
}

console.log('RC424-RC430/RC431 digital pages/payment boundary validation: PASS');


