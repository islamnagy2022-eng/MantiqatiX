import fs from 'node:fs';
const payment=fs.readFileSync('supabase/functions/payment-intent/index.ts','utf8');
const settlement=fs.readFileSync('supabase/functions/settlement-create/index.ts','utf8');
const paymob=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const required=[
  [payment,'admin.auth.getUser','payment auth verification'],
  [payment,'create_payment_intent_backend','server payment-intent boundary'],
  [payment,'pricing_hash','authoritative pricing binding'],
  [payment,'idempotencyKey','payment idempotency input'],
  [settlement,'admin.auth.getUser','settlement auth verification'],
  [settlement,'create_settlement_backend','settlement backend boundary'],
  [paymob,'hmacSha512Hex','Paymob HMAC verification'],
  [paymob,'safeEqual','constant-time signature comparison'],
  [paymob,'p_external_event_id:eventId','provider event idempotency passed to atomic backend'],
  [paymob,'process_verified_provider_payment','verified payment processing'],
  [paymob,'process_verified_subscription_payment','verified subscription processing'],
  [paymob,'!Number.isFinite(amount)','reject non-finite provider amount'],
  [paymob,'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH','subscription provider-order correlation'],
  [paymob,'DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH','digital-page provider-order correlation'],
  [paymob,'SUBSCRIPTION_PROVIDER_CORRELATION_PENDING','fail closed while subscription correlation is pending'],
  [paymob,'DIGITAL_PAGE_PROVIDER_CORRELATION_PENDING','fail closed while digital-page correlation is pending'],
  [paymob,'process_verified_subscription_payment_failure','atomic subscription failure processing'],
  [paymob,'process_verified_subscription_payment_backend','atomic subscription success processing'],
  [paymob,'p_provider_order_id:paymobOrderId','provider order bound into authoritative payment RPC']
];
for(const [src,marker,label] of required){if(!src.includes(marker))throw new Error('Finance boundary marker missing: '+label);}
if(payment.includes('body.amount') && !payment.includes('order.total')) throw new Error('Payment flow appears to trust client amount');
const forbiddenWebhookTableWrites = [
  /\.from\(["']payment_provider_events["']\)\s*\.\s*(?:insert|update|upsert|delete)\b/i,
  /\.from\(["']payment_intents["']\)\s*\.\s*(?:insert|update|upsert|delete)\b/i,
  /\.from\(["']subscription_payment_intents["']\)\s*\.\s*(?:insert|update|upsert|delete)\b/i,
  /\.from\(["']digital_page_orders["']\)\s*\.\s*(?:insert|update|upsert|delete)\b/i,
  /\.from\(["']mantigo_financial_ledger["']\)\s*\.\s*(?:insert|update|upsert|delete)\b/i
];
if (/\.from\(["']payment_provider_events["']\)\s*\.\s*select\b/i.test(paymob) ||
    forbiddenWebhookTableWrites.some(pattern => pattern.test(paymob))) {
  throw new Error('Paymob webhook must not directly read provider-event dedupe state or write payment/financial state; use atomic authoritative RPCs');
}
console.log('RC260 finance/payment boundary validation: PASS');
