import fs from 'node:fs';
const payment=fs.readFileSync('supabase/functions/payment-intent/index.ts','utf8');
const settlement=fs.readFileSync('supabase/functions/settlement-create/index.ts','utf8');
const paymob=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const mantigoPaymentMigration=fs.readFileSync('supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql','utf8');
const mantigoPaymentIntegration=fs.readFileSync('supabase/tests/rc425_mantigo_paymob_integration.sql','utf8');
const required=[
  [payment,'admin.auth.getUser','payment auth verification'],
  [payment,'create_payment_intent_backend','server payment-intent boundary'],
  [payment,'pricing_hash','authoritative pricing binding'],
  [payment,'idempotencyKey','payment idempotency input'],
  [settlement,'admin.auth.getUser','settlement auth verification'],
  [settlement,'create_settlement_backend','settlement backend boundary'],
  [paymob,'hmacSha512Hex','Paymob HMAC verification'],
  [paymob,'safeEqual','constant-time signature comparison'],
  [paymob,'payment_provider_events','provider event idempotency'],
  [paymob,'process_verified_provider_payment','verified payment processing'],
  [paymob,'process_verified_subscription_payment','verified subscription processing'],
  [paymob,'process_verified_mantigo_payment_backend','atomic MantiGO payment processing'],
  [mantigoPaymentMigration,'create table if not exists public.mantigo_payment_provider_events','dedicated MantiGO provider-event table'],
  [mantigoPaymentMigration,'revoke all on function public.process_verified_mantigo_payment_backend','restricted MantiGO payment RPC'],
  [mantigoPaymentMigration,'grant execute on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) to service_role','service-role-only MantiGO payment RPC'],
  [mantigoPaymentIntegration,'cross-ledger event replay unexpectedly succeeded','MantiGO cross-ledger replay regression test'],
  [mantigoPaymentIntegration,'success must create exactly one event and one notification','MantiGO atomic success regression test']
];
for(const [src,marker,label] of required){if(!src.includes(marker))throw new Error('Finance boundary marker missing: '+label);}
if(payment.includes('body.amount') && !payment.includes('order.total')) throw new Error('Payment flow appears to trust client amount');

const mantigoStart=paymob.indexOf('const {data:mantigo}=');
const mantigoEnd=paymob.indexOf('const {data:intentByRef}',mantigoStart);
if(mantigoStart<0||mantigoEnd<0) throw new Error('MantiGO callback routing block missing');
const mantigoBlock=paymob.slice(mantigoStart,mantigoEnd);
if(mantigoBlock.includes('admin.from("payment_provider_events").insert') ||
   mantigoBlock.includes('admin.from("mantigo_financial_ledger").update') ||
   mantigoBlock.includes('admin.from("notifications").insert')) {
  throw new Error('MantiGO callback must not split event/ledger/notification writes outside the atomic RPC');
}
for(const field of ['p_ledger_id:mantigo.id','p_external_event_id:eventId','p_signature_verified:true','p_amount:amount','p_currency:currency','p_provider_transaction_id:value(obj.id)','p_raw_payload:boundPayload']) {
  if(!mantigoBlock.includes(field)) throw new Error('MantiGO atomic RPC binding missing: '+field);
}
console.log('RC260 finance/payment boundary validation: PASS');
