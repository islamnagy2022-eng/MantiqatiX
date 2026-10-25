import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const atomicPayment=fs.readFileSync('supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql','utf8');
const selfService=fs.readFileSync('web/digital-page-self-service.js','utf8');
const publicPage=fs.readFileSync('web/digital-page.js','utf8');
const selfServiceMigration=fs.readFileSync('supabase/migrations/20261025193000_rc567_digital_page_self_service.sql','utf8');
const adminEditor=fs.readFileSync('web/digital-page-editor.js','utf8');
const adminEditorHtml=fs.readFileSync('web/digital-page-editor.html','utf8');
const manualActivationMigration=fs.readFileSync('supabase/migrations/20261025200000_rc568_digital_page_manual_activation.sql','utf8');
for(const [src,marker,label] of [
 [order,'admin.auth.getUser','authenticated order creation'],[order,'idempotencyKey','order idempotency'],[order,'digital_page_products','server product pricing'],[order,'BUSINESS_SCOPE_FORBIDDEN','business scope check'],
 [payment,'p_user_id:user.id','authenticated order ownership binding'],[payment,'provider_intent_id','duplicate payment-intent guard'],[payment,'p_provider_intent_id:providerIntentId','provider correlation finalization'],
 [payment,'p_provider_order_id:providerOrderId','provider order correlation persistence'],[payment,'PAYMENT_PROVIDER_INTENT_MISMATCH','mismatched provider intent fails closed'],[payment,'PAYMENT_PROVIDER_OUTCOME_UNKNOWN','ambiguous provider outcome requires reconciliation'],
 [payment,'CUSTOMER_BILLING_CONTACT_REQUIRED','real billing contact required'],[payment,'claim_digital_page_payment_intent_backend','atomic payment-intent claim'],[payment,'finalize_digital_page_payment_intent_backend','payment-intent finalization boundary'],[payment,'release_digital_page_payment_intent_claim_backend','payment-intent claim release'],[payment,'PAYMENT_INTENT_IN_PROGRESS','concurrent intent guard'],[payment,'PAYMOB_PUBLIC_KEY','checkout URL contract'],
 [atomicPayment,'digital_page_payment_events','digital-page payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','amount/currency binding'],[webhook,'DIGITAL_PAGE_PAYMENT','payment notification'],[webhook,'process_verified_digital_page_payment_backend','atomic verified payment processor'],
 [atomicPayment,'for update','order row lock for payment state transition'],[atomicPayment,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','atomic amount/currency binding'],[atomicPayment,'DIGITAL_PAGE_EVENT_ORDER_MISMATCH','event/order correlation'],[atomicPayment,'to service_role','service-role-only payment processor'],[atomicPayment,'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER','page cannot be reused across orders'],[atomicPayment,'MENU_BUSINESS_SCOPE_REQUIRED','menu fulfillment business ownership'],[atomicPayment,'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER','published-page replay binding']
]) if(!src.includes(marker)) throw new Error('Digital page boundary marker missing: '+label);
if(/customer@example\.com|\+201000000000/.test(payment)) throw new Error('Fake payment billing fallback detected');
if(webhook.includes('from(\"digital_page_payment_events\").insert') || webhook.includes('from(\"digital_page_orders\").update')) throw new Error('Digital-page webhook must use the atomic database payment processor');
for(const [src,marker,label] of [
 [selfService,".eq('owner_user_id', user.id)","L2 customer-owned page reads must be explicitly user-scoped"],
 [selfService,".in('business_id', businesses.map(b => b.id))","L2 business page reads must be restricted to active owned businesses"],
 [selfService,"owner_user_id: selectedOrder.page_type === 'MENU' ? null : user.id","L2 personal page ownership must derive from the authenticated user"],
 [selfService,"business_id: selectedOrder.page_type === 'MENU' ? selectedOrder.target_business_id : null","L2 menu ownership must derive from the server-created order scope"],
 [selfService,"await sb.rpc('digital_page_subscription_active'","L3 page creation must validate active paid entitlement through the database function"],
 [publicPage,"const safeImage=v=>{const s=String(v||'').trim();return /^https:\\/\\//i.test(s)?s:''}","public catalog renderer must suppress non-HTTPS product images"],
 [selfService,"digital_page_orders","customer page requires paid order"],
 [selfService,"whatsapp_number","customer WhatsApp contact field"],
 [selfService,"saveItems","customer product and price management"],
 [selfService,"loadSubscriptionProducts","customer package listing"],
 [selfService,"function productFeatureLabels(features)","subscription tiers derive feature labels from database-defined package features"],
 [selfService,"رابط الصورة يجب أن يبدأ بـ HTTPS وألا يتجاوز 2048 حرفًا","customer product images must use HTTPS and a bounded URL length"],
 [selfService,"subscription-features","subscription package features are displayed as text, not injected HTML"],
 [adminEditor,"kind==='CUSTOMER'","admin editor customer ownership support"],
 [adminEditor,"fulfill_digital_page_publish","admin publication gate retained"],
 [publicPage,"https://wa.me/","public WhatsApp contact CTA"],
 [selfServiceMigration,"owner_user_id","isolated customer page ownership"],
 [selfServiceMigration,"digital_page_subscription_active","paid subscription authorization"],
 [selfServiceMigration,"digital_page_orders_admin_read","admin paid-order review access"],
 [selfServiceMigration,"digital_page_public_subscription_active","public page subscription expiry gate"],
 [selfServiceMigration,"owner_user_id is null or (business_id is null and provider_profile_id is null)","customer ownership cannot overlap legacy scopes"],
 [selfServiceMigration,"new.business_id is distinct from old.business_id","business ownership binding is immutable"],
 [selfServiceMigration,"new.provider_profile_id is distinct from old.provider_profile_id","provider ownership binding is immutable"],
 [selfServiceMigration,"DIGITAL_PAGE_SUBSCRIPTION_BINDING_IMMUTABLE","ownership and subscription transfer protection"]
]) if(!src.includes(marker)) throw new Error('Digital page self-service marker missing: '+label);
const selfServiceHtml=fs.readFileSync('web/digital-page-self-service.html','utf8');
for (const [src,marker,label] of [
  [selfService,"const supportPhone = '201010171770'","temporary subscription request goes to the official WhatsApp support channel"],
  [selfService,"لن يتم تحصيل أي دفع إلكتروني من هذه الصفحة حاليًا","self-service subscriptions do not collect online payments"],
  [selfService,"$('new-page-secondary')?.addEventListener('click', startNewPage)","secondary create-page action is wired"],
  [selfServiceHtml,'id="new-page-secondary"',"secondary create-page button has unique id"],
  [selfServiceMigration,"owner_user_id=(select auth.uid())\n  )","customer can still see their own page after subscription expiry"],
  [selfServiceMigration,"public.digital_page_public_subscription_active(p.digital_page_order_id)","public rendering is gated by subscription validity"]
]) if(!src.includes(marker)) throw new Error('Digital page regression marker missing: '+label);
if ((selfServiceHtml.match(/id="new-page"/g)||[]).length !== 1) throw new Error('Duplicate create-page button id detected');
if (/digital-page-payment-intent|checkoutUrl|pendingCheckoutOrders|pendingCheckoutKeys/.test(selfService)) throw new Error('Self-service subscriptions must remain WhatsApp-only temporarily');
if (!selfService.includes("sb.functions.invoke('digital-page-order-create'") || !selfService.includes("'رقم الطلب: ' + order.id")) throw new Error('WhatsApp subscription requests must create and reference a pending order without starting checkout');
for (const [src,marker,label] of [
  [manualActivationMigration,"digital_page_manual_activation_audit","manual activation audit persistence"],
  [manualActivationMigration,"mnty_admin_list_pending_digital_page_subscriptions","admin-only pending order queue RPC"],
  [manualActivationMigration,"mnty_admin_activate_digital_page_subscription","admin-only manual activation RPC"],
  [manualActivationMigration,"PLATFORM_ADMIN_REQUIRED","manual activation admin authorization"],
  [adminEditor,"mnty_admin_list_pending_digital_page_subscriptions","admin editor loads the protected activation queue"],
  [adminEditor,"mnty_admin_activate_digital_page_subscription","admin editor invokes the protected activation RPC"],
  [adminEditorHtml,'id="manual-activation-panel"',"admin activation panel exists"]
]) if(!src.includes(marker)) throw new Error('Manual activation boundary marker missing: '+label);
if (!publicPage.includes('اطلب المنتج عبر واتساب') || !publicPage.includes("MNTYCatalogExperience?.buildInquiry('FOOD',pagePhone,")) throw new Error('Product order CTA must use the shared FOOD adapter and encoded product details');

for (const [marker,label] of [
  ["const esc=v=>String(v??'').replace(", "public catalog content must be HTML-escaped"],
  ["const safeImage=v=>", "public product images must be HTTPS only"],
  ["i.test(s)?s:''}", "non-HTTPS product image URLs must be rejected"],
  ["noopener noreferrer", "external WhatsApp links must prevent opener access"],
  ["loading", "product images must load lazily"],
  ["eq('slug',slug).eq('status','PUBLISHED')", "public page lookup must be slug-scoped and published-only"],
  ["eq('page_id',p.id).eq('active',true)", "public catalog sections must be active and page-scoped"]
]) if(!publicPage.includes(marker)) throw new Error('Public catalog security boundary missing: '+label);

if (selfServiceMigration.includes('), o.updated_at, o.created_at)')) throw new Error('Editing a draft must not extend subscription expiry');
if ((selfServiceMigration.match(/coalesce\(o\.paid_at, \(select p\.published_at from public\.digital_pages p where p\.digital_page_order_id=o\.id and p\.owner_user_id=o\.user_id\), o\.created_at\)/g)||[]).length !== 2) throw new Error('Both owner and public expiry gates must use a stable subscription start timestamp');
if (!selfServiceMigration.includes('digital_page_orders_paid_at_guard') || !selfServiceMigration.includes('new.paid_at := pg_catalog.now()')) throw new Error('Subscription duration must start on first successful payment and paid_at must be immutable');
if (!/create or replace function public\.digital_page_orders_paid_at_guard\(\)[\s\S]*?as \$\$[\s\S]*?end;\n\$\$;/i.test(selfServiceMigration)) throw new Error('paid_at trigger function must use a valid dollar-quoted PL/pgSQL body');
console.log('RC424 digital pages/payment boundary validation: PASS');
