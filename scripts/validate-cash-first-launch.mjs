import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const app=read('web/app.js');
const restaurant=read('web/restaurant-module.js');
const api=read('supabase/functions/api/index.ts');
const payment=read('supabase/functions/payment-intent/index.ts');
const digitalPayment=read('supabase/functions/digital-page-payment-intent/index.ts');
const subscriptionPayment=read('supabase/functions/subscription-payment-intent/index.ts');
const mantigoPayment=read('supabase/functions/mantigo-payment-intent/index.ts');
const smm=read('supabase/functions/smm-gateway/index.ts');
const smmPage=read('web/smm.html');
const index=read('web/index.html');
const sw=read('web/sw.js');
const scope=read('docs/release/CASH_FIRST_LAUNCH_SCOPE_20261020.md');
const todo=read('docs/MASTER_PRODUCTION_TODO.md');

assert.match(api,/provider !== "CASH_ON_DELIVERY"/,'cash API must reject non-cash methods');
assert.match(api,/IDEMPOTENCY_KEY_REUSED/,'cash intent must reject idempotency-key reuse across different intent contracts');
assert.match(api,/ignoreDuplicates: true/,'cash intent insert must not overwrite state on duplicate key');
assert.match(api,/matchesRequestedCashIntent/,'existing cash intent must be bound to order, amount, currency and method');

const customerOrder=app.indexOf("invokeMntyFunction('order-create'");
const customerCash=app.indexOf("invokeMntyApi('/api/v1/payments/intents'");
assert.ok(customerOrder>=0 && customerCash>customerOrder,'customer checkout must request a cash intent after authoritative order creation');
assert.ok(app.includes("MNTY-CASH:'+createdOrderId"),'cash idempotency key must be stable per order');
assert.match(app,/لا يُسجل مدفوعًا إلا بعد تأكيد التحصيل بواسطة موظف مخول/,'UI must not equate cash intent with collection');
assert.match(app,/MNTY_LAUNCH_PAYMENT_MODE='CASH_ONLY'/,'frontend launch payment mode must be explicit');
const digitalGate=app.indexOf("if(MNTY_LAUNCH_PAYMENT_MODE==='CASH_ONLY')");
const digitalOrder=app.indexOf("sb.functions.invoke('digital-page-order-create'");
assert.ok(digitalGate>=0 && digitalOrder>digitalGate,'paid digital-page checkout must be gated before creating an order');

const restaurantOrder=restaurant.indexOf("invokeMntyFunction('order-create'");
const restaurantCash=restaurant.indexOf("invokeMntyApi('/api/v1/payments/intents'");
assert.ok(restaurantOrder>=0 && restaurantCash>restaurantOrder,'restaurant orders must request cash intent after creation');
assert.ok(restaurant.includes("MNTY-CASH:'+createdOrderId"),'restaurant cash idempotency key must be stable per order');
for(const [name,source] of [['payment-intent',payment],['digital-page-payment-intent',digitalPayment],['subscription-payment-intent',subscriptionPayment],['mantigo-payment-intent',mantigoPayment]]){
 assert.match(source,/ELECTRONIC_PAYMENTS_LAUNCH_DEFERRED\s*=\s*true/,name+' must remain deferred by default');
 assert.match(source,/ELECTRONIC_PAYMENTS_DEFERRED/,name+' must reject electronic checkout during launch one');
}
assert.match(smm,/const SMM_INITIAL_LAUNCH_DEFERRED\s*=\s*true/,'SMM must remain deferred server-side');
assert.match(smm,/SMM_DEFERRED/,'SMM launch gate must reject actions');
assert.match(smmPage,/خارج نطاق الإطلاق الأول/,'SMM public page must present a deferred state');
assert.match(scope,/POST-LAUNCH DEFERRED/,'scope doc must record post-launch services');
assert.match(todo,/Cash payment lifecycle — NOT VERIFIED/,'master TODO must keep cash E2E as a launch gate');
assert.match(index,/rc459-cash-first-launch-20261020/,'index must load the new app version');
assert.match(index,/rc315-cash-first-20261020/,'index must load the new restaurant module version');
assert.match(index,/rc370-cash-first-launch/,'service worker URL must be versioned');
assert.match(sw,/mnty-web-v130/,'PWA cache must be bumped');
assert.match(sw,/rc459-cash-first-launch-20261020/,'service worker must precache new app version');
assert.match(sw,/rc315-cash-first-20261020/,'service worker must precache new restaurant module version');
console.log('Cash-first launch scope contract: PASS');
