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
  [paymob,'process_verified_mantigo_payment_backend','atomic provider event idempotency boundary'],
  [paymob,'process_verified_provider_payment','verified payment processing'],
  [paymob,'process_verified_subscription_payment','verified subscription processing']
];
for(const [src,marker,label] of required){if(!src.includes(marker))throw new Error('Finance boundary marker missing: '+label);}
if(payment.includes('body.amount') && !payment.includes('order.total')) throw new Error('Payment flow appears to trust client amount');

// Payment webhook convergence contract: payment state changes must use the reviewed atomic RPCs.
const atomicRequired=[
  ['process_verified_mantigo_payment_backend','MantiGO atomic payment state'],
  ['process_verified_provider_payment_failure','normal payment failure atomic state'],
  ['process_verified_subscription_payment_failure','subscription failure atomic state'],
  ['process_verified_subscription_payment_backend','subscription success atomic state']
];
for(const [marker,label] of atomicRequired){if(!paymob.includes(marker))throw new Error('Atomic payment webhook contract missing: '+label);}
const forbiddenSplitWrites=[
  ['from("mantigo_financial_ledger").update(','MantiGO ledger direct update in webhook'],
  ['from("payment_intents").update({status:"FAILED"','normal payment failure direct update in webhook'],
  ['from("subscription_payment_intents").update({status:"FAILED"','subscription failure direct update in webhook'],
  ['from("payment_provider_events").insert({id:crypto.randomUUID(),tenant_id:"MNTY-PLATFORM"','MantiGO split event insert in webhook']
];
for(const [marker,label] of forbiddenSplitWrites){if(paymob.includes(marker))throw new Error('Unsafe split-write payment path remains: '+label);}
for(const field of ['provider:"PAYMOB"','transaction_id:value(obj.id)','merchant_order_id:merchantRef','provider_order_id:paymobOrderId','amount_cents:String(obj.amount_cents??"")']){
  if(!paymob.includes(field))throw new Error('MantiGO RPC payload binding missing: '+field);
}
console.log('RC260 finance/payment boundary validation: PASS');
