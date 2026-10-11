import fs from 'node:fs';
const payment=fs.readFileSync('supabase/functions/payment-intent/index.ts','utf8');
const settlement=fs.readFileSync('supabase/functions/settlement-create/index.ts','utf8');
const paymob=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const mantigoPaymentMigration=fs.readFileSync('supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql','utf8');
const providerFailureMigration=fs.readFileSync('supabase/migrations/20261009150000_rc428_atomic_provider_failure_webhook.sql','utf8');
const subscriptionFailureMigration=fs.readFileSync('supabase/migrations/20261009160000_rc429_atomic_subscription_failure_webhook.sql','utf8');
const subscriptionSuccessMigration=fs.readFileSync('supabase/migrations/20261009170000_rc430_atomic_subscription_success_webhook.sql','utf8');
const required=[
  [payment,'admin.auth.getUser','payment auth verification'],
  [payment,'create_payment_intent_backend','server payment-intent boundary'],
  [payment,'pricing_hash','authoritative pricing binding'],
  [payment,'idempotencyKey','payment idempotency input'],
  [settlement,'admin.auth.getUser','settlement auth verification'],
  [settlement,'create_settlement_backend','settlement backend boundary'],
  [paymob,'hmacSha512Hex','Paymob HMAC verification'],
  [paymob,'safeEqual','constant-time signature comparison'],
  [paymob,'process_verified_provider_payment','verified payment processing'],
  [paymob,'process_verified_provider_payment_failure','atomic provider failure processing'],
  [paymob,'process_verified_mantigo_payment_backend','atomic MantiGo payment processing'],
  [paymob,'process_verified_subscription_payment_failure','atomic subscription failure processing'],
  [paymob,'process_verified_subscription_payment_backend','atomic subscription success processing'],
  [mantigoPaymentMigration,'unique (provider, external_event_id)','MantiGo provider event idempotency'],
  [mantigoPaymentMigration,'MANTIGO_PAYMENT_EVENT_REPLAY_STATUS_MISMATCH','MantiGo replay binding'],
  [providerFailureMigration,'EXTERNAL_EVENT_REPLAY_MISMATCH','provider failure event idempotency'],
  [providerFailureMigration,'PAYMENT_FAILURE_REPLAY_STATUS_MISMATCH','provider failure replay status binding'],
  [subscriptionFailureMigration,'SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH','subscription failure event idempotency'],
  [subscriptionSuccessMigration,'SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH','subscription success event idempotency']
];
for(const [src,marker,label] of required){if(!src.includes(marker))throw new Error('Finance boundary marker missing: '+label);}
if(payment.includes('body.amount') && !payment.includes('order.total')) throw new Error('Payment flow appears to trust client amount');
console.log('RC260 finance/payment boundary validation: PASS');
