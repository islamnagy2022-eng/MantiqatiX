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
console.log('RC260 finance/payment boundary validation: PASS');
