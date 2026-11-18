import fs from 'node:fs';
const payment=fs.readFileSync('supabase/functions/payment-intent/index.ts','utf8');
const settlement=fs.readFileSync('supabase/functions/settlement-create/index.ts','utf8');
const paymob=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const forwardRepair=fs.readFileSync('supabase/migrations/20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql','utf8');
const required=[
  [payment,'admin.auth.getUser','payment auth verification'],
  [payment,'create_payment_intent_backend','server payment-intent boundary'],
  [payment,'pricing_hash','authoritative pricing binding'],
  [payment,'idempotencyKey','payment idempotency input'],
  [settlement,'admin.auth.getUser','settlement auth verification'],
  [settlement,'create_settlement_backend','settlement backend boundary'],
  [paymob,'hmacSha512Hex','Paymob HMAC verification'],
  [paymob,'safeEqual','constant-time signature comparison'],
  [paymob,'eventId','stable provider event identity'],
  [paymob,'process_verified_provider_payment','verified payment processing'],
  [paymob,'process_verified_subscription_payment','verified subscription processing'],
  [paymob,'process_verified_subscription_payment_backend','atomic subscription success processor'],
  [paymob,'process_verified_subscription_payment_failure','atomic subscription failure processor'],
  [paymob,'process_verified_provider_payment_failure','atomic order payment failure processor'],
  [paymob,'process_verified_mantigo_payment_backend','atomic MantiGO payment processor']
];
for(const [src,marker,label] of required){if(!src.includes(marker))throw new Error('Finance boundary marker missing: '+label);}
if(paymob.includes('if(existing)return json({ok:true,idempotent:true,requestId},200,requestId)')) throw new Error('Paymob webhook must not bypass atomic RPC replay binding with an Edge-level idempotent shortcut');
if(payment.includes('body.amount') && !payment.includes('order.total')) throw new Error('Payment flow appears to trust client amount');
for(const name of ['process_verified_provider_payment_failure','process_verified_subscription_payment_failure','process_verified_subscription_payment_backend','process_verified_provider_payment']){
  if(!forwardRepair.toLowerCase().includes('create or replace function public.'+name+'(')) throw new Error('RC475 forward repair missing '+name);
}
if((forwardRepair.match(/set search_path = ''/gi)||[]).length!==4) throw new Error('RC475 must pin empty search_path on all four SECURITY DEFINER processors');
if(!forwardRepair.includes('coalesce(p_signature_verified, false) IS NOT TRUE')) throw new Error('RC475 must reject NULL signature verification flags');
if(!forwardRepair.includes('RC475_SCHEMA_PREFLIGHT_FAILED') || !forwardRepair.includes('payment_provider_events_provider_external_event_id_key') || !forwardRepair.includes('uq_business_subscriptions_idempotency') || !forwardRepair.includes('uq_financial_obligation_idempotent') || !forwardRepair.includes('exception_code','character varying') || !forwardRepair.includes('id::text=p_payment_intent_id::text') || !forwardRepair.includes('PAYMENT_INTENT_ALREADY_FINAL_WITHOUT_MATCHING_RECONCILIATION')) throw new Error('RC475 schema and idempotency preflight is incomplete');
for(const role of ['public','anon','authenticated']) if(!forwardRepair.toLowerCase().includes(' from '+role+';')) throw new Error('RC475 must revoke direct execution from '+role);
if((forwardRepair.match(/ to service_role;/gi)||[]).length!==4) throw new Error('RC475 must grant exactly four processors to service_role');
console.log('RC260 finance/payment boundary validation: PASS');
