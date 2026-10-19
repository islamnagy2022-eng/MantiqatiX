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
console.log('RC260 finance/payment boundary validation: PASS');

const journal=fs.readFileSync('supabase/functions/financial-journal/index.ts','utf8');
const journalRequired=[
  ['admin.auth.getUser','financial-journal bearer token verification'],
  ['user.is_anonymous','anonymous identity rejection'],
  ['post_financial_journal_backend','service-role-only journal RPC'],
  ['p_user_id: user.id','verified actor identity binding'],
  ['ONLY_POSTED_JOURNALS_SUPPORTED','posted-journal input restriction'],
  ['https://islamnagy2022-eng.github.io','explicit allowed web origin']
];
for(const [marker,label] of journalRequired){
  if(!journal.includes(marker)) throw new Error('Financial-journal boundary marker missing: '+label);
}
if(/rpc\(\s*['"]post_financial_journal['"]/.test(journal)){
  throw new Error('Financial-journal must not call the legacy post_financial_journal RPC.');
}
if(/Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/.test(journal)){
  throw new Error('Financial-journal must not allow wildcard CORS origins.');
}
