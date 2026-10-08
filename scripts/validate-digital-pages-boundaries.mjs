import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const atomicPayment=fs.readFileSync('supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql','utf8');
for(const [src,marker,label] of [
 [order,'admin.auth.getUser','authenticated order creation'],[order,'idempotencyKey','order idempotency'],[order,'digital_page_products','server product pricing'],[order,'BUSINESS_SCOPE_FORBIDDEN','business scope check'],
 [payment,'p_user_id:user.id','authenticated order ownership binding'],[payment,'provider_intent_id','duplicate payment-intent guard'],[payment,'p_provider_intent_id:String(p.id)','provider correlation finalization'],
 [payment,'CUSTOMER_BILLING_CONTACT_REQUIRED','real billing contact required'],[payment,'claim_digital_page_payment_intent_backend','atomic payment-intent claim'],[payment,'finalize_digital_page_payment_intent_backend','payment-intent finalization boundary'],[payment,'release_digital_page_payment_intent_claim_backend','payment-intent claim release'],[payment,'PAYMENT_INTENT_IN_PROGRESS','concurrent intent guard'],[payment,'PAYMOB_PUBLIC_KEY','checkout URL contract'],
 [webhook,'digital_page_payment_events','digital-page payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','amount/currency binding'],[webhook,'DIGITAL_PAGE_PAYMENT','payment notification'],[webhook,'process_verified_digital_page_payment_backend','atomic verified payment processor'],
 [atomicPayment,'for update','order row lock for payment state transition'],[atomicPayment,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','atomic amount/currency binding'],[atomicPayment,'DIGITAL_PAGE_EVENT_ORDER_MISMATCH','event/order correlation'],[atomicPayment,'to service_role','service-role-only payment processor']
]) if(!src.includes(marker)) throw new Error('Digital page boundary marker missing: '+label);
if(/customer@example\.com|\+201000000000/.test(payment)) throw new Error('Fake payment billing fallback detected');
if(webhook.includes('from(\"digital_page_payment_events\").insert') || webhook.includes('from(\"digital_page_orders\").update')) throw new Error('Digital-page webhook must use the atomic database payment processor');
console.log('RC424 digital pages/payment boundary validation: PASS');
