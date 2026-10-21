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
  [paymob,'payment_provider_events','provider event idempotency'],
  [paymob,'process_verified_provider_payment','verified payment processing'],
  [paymob,'process_verified_subscription_payment','verified subscription processing']
];
for(const [src,marker,label] of required){if(!src.includes(marker))throw new Error('Finance boundary marker missing: '+label);}
if(payment.includes('body.amount') && !payment.includes('order.total')) throw new Error('Payment flow appears to trust client amount');

const mantigoStart=paymob.indexOf('if(mantigo){');
const mantigoEnd=paymob.indexOf('const {data:intentByRef}',mantigoStart);
if(mantigoStart<0||mantigoEnd<0)throw new Error('MantiGO Paymob webhook branch boundaries are missing.');
const mantigoWebhook=paymob.slice(mantigoStart,mantigoEnd);
const mantigoAtomicMigration='supabase/migrations/20261021195000_rc457_atomic_mantigo_paymob_webhook.sql';
if(!fs.existsSync(mantigoAtomicMigration))throw new Error('RC457 atomic MantiGO webhook migration is missing.');
const mantigoSql=fs.readFileSync(mantigoAtomicMigration,'utf8');
for(const [src,marker,label] of [
  [mantigoWebhook,'process_verified_mantigo_paymob_event','MantiGO webhook delegates to atomic database processor'],
  [mantigoWebhook,'MANTIGO_ATOMIC_PAYMENT_PROCESSING_FAILED','safe atomic processor failure handling'],
  [mantigoWebhook,'MANTIGO_EVENT_STATUS_CONFLICT','contradictory replay returns conflict'],
  [mantigoSql,'for update','ledger row serialization'],
  [mantigoSql,'MANTIGO_EVENT_BINDING_CONFLICT','provider-event binding validation'],
  [mantigoSql,'MANTIGO_FINAL_STATE_CONFLICT','conflicting replay rejection'],
  [mantigoSql,'MANTIGO_EVENT_STATUS_CONFLICT','contradictory event replay rejection'],
  [mantigoSql,'grant execute on function public.process_verified_mantigo_paymob_event','service-role-only RPC grant']
]) if(!src.includes(marker)) throw new Error('MantiGO atomic webhook contract missing: '+label);
if(mantigoWebhook.includes('.from("payment_provider_events").insert')||mantigoWebhook.includes('.from("mantigo_financial_ledger").update')) throw new Error('MantiGO webhook must not persist provider event and ledger state in separate client calls.');

console.log('RC260 finance/payment boundary validation: PASS');
