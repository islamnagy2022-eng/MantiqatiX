import fs from 'node:fs';
const order=fs.readFileSync('supabase/functions/digital-page-order-create/index.ts','utf8');
const payment=fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/paymob-webhook/index.ts','utf8');
const atomicPayment=fs.readFileSync('supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql','utf8');
const trustedFinalization=fs.readFileSync('supabase/migrations/20261016100000_digital_page_payment_intent_server_only_finalization.sql','utf8');
for(const [src,marker,label] of [
 [order,'admin.auth.getUser','authenticated order creation'],[order,'idempotencyKey','order idempotency'],[order,'digital_page_products','server product pricing'],[order,'BUSINESS_SCOPE_FORBIDDEN','business scope check'],
 [payment,'p_user_id:user.id','authenticated order ownership binding'],[payment,'provider_intent_id','duplicate payment-intent guard'],[payment,'p_provider_intent_id:String(p.id)','provider correlation finalization'],
 [payment,'CUSTOMER_BILLING_CONTACT_REQUIRED','real billing contact required'],[payment,'claim_digital_page_payment_intent_backend','atomic payment-intent claim'],[payment,'finalize_digital_page_payment_intent_backend','payment-intent finalization boundary'],[payment,'release_digital_page_payment_intent_claim_backend','payment-intent claim release'],[payment,'PAYMENT_INTENT_IN_PROGRESS','concurrent intent guard'],[payment,'PAYMOB_PUBLIC_KEY','checkout URL contract'],
 [atomicPayment,'digital_page_payment_events','digital-page payment event ledger'],[webhook,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','amount/currency binding'],[webhook,'DIGITAL_PAGE_PAYMENT','payment notification'],[webhook,'process_verified_digital_page_payment_backend','atomic verified payment processor'],
 [atomicPayment,'for update','order row lock for payment state transition'],[atomicPayment,'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH','atomic amount/currency binding'],[atomicPayment,'DIGITAL_PAGE_EVENT_ORDER_MISMATCH','event/order correlation'],[atomicPayment,'to service_role','service-role-only payment processor'],[atomicPayment,'PAGE_ALREADY_LINKED_TO_DIFFERENT_ORDER','page cannot be reused across orders'],[atomicPayment,'MENU_BUSINESS_SCOPE_REQUIRED','menu fulfillment business ownership'],[atomicPayment,'PUBLISHED_PAGE_NOT_LINKED_TO_ORDER','published-page replay binding']
]) if(!src.includes(marker)) throw new Error('Digital page boundary marker missing: '+label);
for (const [src, marker, label] of [
  [payment, 'admin.rpc("finalize_digital_page_payment_intent_backend"', 'server-role finalization after provider response'],
  [payment, 'p_provider_order_id:providerOrderId', 'provider order correlation persisted server-side'],
  [payment, 'PAYMENT_PROVIDER_ORDER_ID_MISSING', 'missing provider order ID fails closed'],
  [trustedFinalization, 'request.jwt.claim.role', 'trusted role check'],
  [trustedFinalization, 'from authenticated', 'authenticated execute revoked'],
  [trustedFinalization, 'to service_role', 'service role execute grant'],
  [trustedFinalization, "set search_path = ''", 'empty finalizer search path'],
  [trustedFinalization, "to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)')", 'replay-safe five-argument overload detection'],
  [trustedFinalization, 'from public, anon, authenticated, service_role', 'old five-argument overload grants cleared before redefinition'],
  [trustedFinalization, 'p_provider_order_id text', 'five-argument provider order correlation input'],
  [trustedFinalization, 'provider_order_id = p_provider_order_id', 'provider order ID stored on the order'],
  [trustedFinalization, 'grant execute on function public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text) to service_role', 'five-argument finalizer service-role-only grant'],
]) if (!src.toLowerCase().includes(marker.toLowerCase())) throw new Error('Digital-page trusted-finalization boundary missing: ' + label);
if (/userClient\.rpc\("finalize_digital_page_payment_intent_backend"/.test(payment)) throw new Error("Authenticated client must not finalize provider intent IDs");
// Fail closed if a later recovered migration re-exposes the five-argument overload.
const migrationDir = 'supabase/migrations';
const fiveArgAclEvents = [];
for (const filename of fs.readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(migrationDir + '/' + filename, 'utf8');
  const aclPattern = /(grant\s+(?:all|execute)\s+on\s+function\s+public\.finalize_digital_page_payment_intent_backend\s*\(\s*uuid\s*,\s*uuid\s*,\s*text\s*,\s*text\s*,\s*text\s*\)\s+to\s+authenticated|revoke\s+all\s+on\s+function\s+public\.finalize_digital_page_payment_intent_backend\s*\(\s*uuid\s*,\s*uuid\s*,\s*text\s*,\s*text\s*,\s*text\s*\)\s+from\s+authenticated)/ig;
  for (const match of sql.matchAll(aclPattern)) {
    fiveArgAclEvents.push({ filename, index: match.index ?? 0, grants: /^grant/i.test(match[0]) });
  }
}
// The forward migration conditionally revokes every execution grant from the recovered
// overload. Represent that dynamic revoke as the final ACL event for chronological replay.
if (trustedFinalization.includes("to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)')") &&
    trustedFinalization.includes('from public, anon, authenticated, service_role')) {
  fiveArgAclEvents.push({
    filename: '20261016100000_digital_page_payment_intent_server_only_finalization.sql',
    index: Number.MAX_SAFE_INTEGER,
    grants: false,
  });
}
fiveArgAclEvents.sort((a, b) => a.filename.localeCompare(b.filename) || a.index - b.index);
if (fiveArgAclEvents.length && fiveArgAclEvents[fiveArgAclEvents.length - 1].grants) {
  throw new Error('Five-argument digital-page finalizer remains executable by authenticated after migration replay');
}
if(/customer@example\.com|\+201000000000/.test(payment)) throw new Error('Fake payment billing fallback detected');
if(webhook.includes('from(\"digital_page_payment_events\").insert') || webhook.includes('from(\"digital_page_orders\").update')) throw new Error('Digital-page webhook must use the atomic database payment processor');
console.log('RC424 digital pages/payment boundary validation: PASS');
