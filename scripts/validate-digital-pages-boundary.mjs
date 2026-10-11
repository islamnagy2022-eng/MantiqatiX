import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const editor=fs.readFileSync('web/digital-page-editor.js','utf8');
const editorHtml=fs.readFileSync('web/digital-page-editor.html','utf8');
const checks=[
 [order,'user.is_anonymous','digital order auth'],[order,'idempotencyKey','digital order idempotency'],[order,'digital_page_products','canonical digital product'],[order,'BUSINESS_SCOPE_FORBIDDEN','business ownership boundary'],
 [payment,'o.user_id!==user.id','digital payment ownership'],[payment,'provider_intent_id','duplicate payment intent guard'],[payment,'PAYMOB_SECRET_KEY','payment provider server secret'],
 [webhook,'digital_page_payment_events','digital payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','digital amount binding'],[webhook,'DIGITAL_PAGE_ORDER_UPDATE_FAILED','digital order update handling'],
 [editor,"fulfill_digital_page_publish",'editor publish lifecycle'],[editor,"PAID_ORDER_REQUIRED",'paid order gate'],[editor,"digital_page_sections",'editor section integration'],
 [editor,"restaurant_menu_items",'menu source table integration'],
 [editor,".eq('business_id',businessId)",'menu source business scope'],
 [editor,".eq('is_available',true)",'menu source active-item filter'],
 [editor,"String(item.branch_id)===branchId",'menu source branch isolation'],
 [editor,"DUPLICATE_MENU_SECTIONS_REQUIRE_MANUAL_REVIEW",'duplicate menu section fail-closed behavior'],
 [editor,"الصفحة لم تُنشر تلقائيًا",'menu sync does not auto-publish'],
 [editorHtml,'id="menuSourceBranch"','explicit menu branch selection'],
 [editorHtml,'id="syncMenuItems"','menu sync action available in editor']
];
for(const [src,marker,label] of checks)if(!src.includes(marker))throw new Error('Digital page boundary marker missing: '+label);
console.log('RC261 digital pages boundary validation: PASS');
