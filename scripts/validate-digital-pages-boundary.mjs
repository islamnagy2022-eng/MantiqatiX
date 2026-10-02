import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const editor=fs.readFileSync('web/digital-page-editor.js','utf8');
const checks=[
 [order,'user.is_anonymous','digital order auth'],[order,'idempotencyKey','digital order idempotency'],[order,'digital_page_products','canonical digital product'],[order,'BUSINESS_SCOPE_FORBIDDEN','business ownership boundary'],
 [payment,'o.user_id!==user.id','digital payment ownership'],[payment,'provider_intent_id','duplicate payment intent guard'],[payment,'PAYMOB_SECRET_KEY','payment provider server secret'],
 [webhook,'digital_page_payment_events','digital payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','digital amount binding'],[webhook,'DIGITAL_PAGE_ORDER_UPDATE_FAILED','digital order update handling'],
 [editor,"status:publish?'PUBLISHED':'DRAFT'",'editor publish lifecycle'],[editor,"digital_page_sections",'editor section integration']
];
for(const [src,marker,label] of checks)if(!src.includes(marker))throw new Error('Digital page boundary marker missing: '+label);
console.log('RC261 digital pages boundary validation: PASS');
