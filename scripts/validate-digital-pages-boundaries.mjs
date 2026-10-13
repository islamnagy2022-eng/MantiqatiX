import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const atomicPayment=fs.readFileSync('supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql','utf8');
const editor=fs.readFileSync('web/digital-page-editor.js','utf8');
const editorHtml=fs.readFileSync('web/digital-page-editor.html','utf8');
const renderer=fs.readFileSync('web/digital-page.js','utf8');
for(const [src,marker,label] of [
 [order,'admin.auth.getUser','authenticated order creation'],[order,'idempotencyKey','order idempotency'],[order,'digital_page_products','server product pricing'],[order,'BUSINESS_SCOPE_FORBIDDEN','business scope check'],
 [payment,'p_user_id:user.id','authenticated order ownership binding'],[payment,'provider_intent_id','duplicate payment-intent guard'],[payment,'p_provider_intent_id:String(p.id)','provider correlation finalization'],
 [payment,'CUSTOMER_BILLING_CONTACT_REQUIRED','real billing contact required'],[payment,'claim_digital_page_payment_intent_backend','atomic payment-intent claim'],[payment,'finalize_digital_page_payment_intent_backend','payment-intent finalization boundary'],[payment,'release_digital_page_payment_intent_claim_backend','payment-intent claim release'],[payment,'PAYMENT_INTENT_IN_PROGRESS','concurrent intent guard'],[payment,'PAYMOB_PUBLIC_KEY','checkout URL contract'],
 [atomicPayment,'digital_page_payment_events','digital-page payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','amount/currency binding'],[webhook,'DIGITAL_PAGE_PAYMENT','payment notification'],[webhook,'process_verified_digital_page_payment_backend','atomic verified payment processor'],
 [atomicPayment,'for update','order row lock for payment state transition'],[atomicPayment,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','atomic amount/currency binding'],[atomicPayment,'DIGITAL_PAGE_EVENT_ORDER_MISMATCH','event/order correlation'],[atomicPayment,'to service_role','service-role-only payment processor'],[atomicPayment,'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER','page cannot be reused across orders'],[atomicPayment,'MENU_BUSINESS_SCOPE_REQUIRED','menu fulfillment business ownership'],[atomicPayment,'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER','published-page replay binding'],
 [editor,"restaurant_menu_items",'menu source table integration'],
 [editor,'PAGE_OWNER_ROLES','eligible page-owner role allowlist'],
 [editor,'businessNames.get(String(x.business_id))','owner labels use authorized business display names'],
 [editor,"('نشاط '+(i+1))",'owner labels avoid exposing internal business IDs'],

 [editor,".in('business_id',businessIds)",'business page reads are scoped at query time'],
 [editor,".in('provider_profile_id',providerIds).is('business_id',null)",'provider page reads are scoped at query time'],
 [editor,'const results=await Promise.all(queries)','owner-scoped queries are checked together'],
 [editor,'const byId=new Map()','owner-scoped page results are deduplicated'],

 [editor,".eq('business_id',businessId)",'menu source business scope'],
 [editor,".eq('is_available',true)",'menu source active-item filter'],
 [editor,"MENU_SOURCE_LIMIT_EXCEEDED",'menu sync fails closed on truncated source data'],
 [editor,"String(item.branch_id)===branchId",'menu source branch isolation'],
 [editor,"branchId==='__NULL__'?!item.branch_id:String(item.branch_id)===branchId",'selected branch filter handles explicit unassigned items'],
 [editor,"items.some(item=>!item.name_ar||!Number.isFinite(Number(item.base_price_egp))||Number(item.base_price_egp)<0)",'menu sync rejects invalid names and prices'],
 [editor,"if(!currentPage||currentPage.page_type!=='MENU'||$('pageType').value!=='MENU')",'menu sync requires a saved MENU page'],
 [editor,".eq('id',existing.data[0].id).eq('page_id',currentPage.id)",'existing menu section update is page-scoped'],
 [editor,"branch_id:branchId==='__NULL__'?null:branchId",'menu payload records the selected branch'],
 [editor,"if((existing.data||[]).length>1)throw new Error('DUPLICATE_MENU_SECTIONS_REQUIRE_MANUAL_REVIEW')",'duplicate menu sections are not overwritten automatically'],
 [editor,"status('تمت مزامنة '+items.length+' صنفًا من الفرع المحدد. الصفحة لم تُنشر تلقائيًا.')",'menu sync confirms no automatic publish'],
 [editor,"sb.from('branches').select('id,name,code').eq('business_id',businessId).eq('status','ACTIVE').in('id',requestedBranchIds)",'menu branch labels are business-scoped and active-only'],
 [editor,"menuSourceItems=menuSourceItems.filter(item=>!item.branch_id||branchNames.has(String(item.branch_id)))",'items on inactive or unknown branches are excluded'],
 [editor,"(branchNames.get(key)||'فرع متاح')",'branch selector avoids exposing internal branch IDs'],
 [editor,'MENU_BRANCH_REQUIRED','manual branch selection required'],
 [editor,'branchSelect.onchange','branch selection controls sync button'],
 [editor,"DUPLICATE_MENU_SECTIONS_REQUIRE_MANUAL_REVIEW",'duplicate menu section fail-closed behavior'],
 [editor,"الصفحة لم تُنشر تلقائيًا",'menu sync does not auto-publish'],
 [editorHtml,'id="menuSourceBranch"','explicit menu branch selection'],
 [editorHtml,'id="syncMenuItems"','menu sync action available in editor'],
 [renderer,'esc(x.category)','menu category HTML escaping']
]) if(!src.includes(marker)) throw new Error('Digital page boundary marker missing: '+label);
if(/sb\.from\('digital_pages'\)\.select\([^)]*\)\.order\('updated_at'/.test(editor)) throw new Error('Digital page editor must not fetch unscoped global page metadata');
if(/customer@example\.com|\+201000000000/.test(payment)) throw new Error('Fake payment billing fallback detected');
if(webhook.includes('from(\"digital_page_payment_events\").insert') || webhook.includes('from(\"digital_page_orders\").update')) throw new Error('Digital-page webhook must use the atomic database payment processor');
console.log('RC424 digital pages/payment boundary validation: PASS');
