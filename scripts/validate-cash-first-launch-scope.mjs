import fs from "node:fs";
import assert from "node:assert/strict";

const payment=fs.readFileSync("supabase/functions/payment-intent/index.ts","utf8");
const digital=fs.readFileSync("supabase/functions/digital-page-payment-intent/index.ts","utf8");
const mantigo=fs.readFileSync("supabase/functions/mantigo-payment-intent/index.ts","utf8");
const subscription=fs.readFileSync("supabase/functions/subscription-payment-intent/index.ts","utf8");
const api=fs.readFileSync("supabase/functions/api/index.ts","utf8");
const cashGuard=fs.readFileSync("supabase/migrations/20261020100000_rc458_mantigo_cash_confirmation_fail_closed.sql","utf8");
const app=fs.readFileSync("web/app.js","utf8");
const home=fs.readFileSync("web/home.js","utf8");
const smm=fs.readFileSync("web/smm.html","utf8");
const smmRuntime=fs.readFileSync("web/smm.js","utf8");
const sw=fs.readFileSync("web/sw.js","utf8");
const index=fs.readFileSync("web/index.html","utf8");

for (const [name,source] of [["payment-intent",payment],["digital-page-payment-intent",digital],["mantigo-payment-intent",mantigo],["subscription-payment-intent",subscription]]) {
  assert.match(source,/MNTY_ELECTRONIC_PAYMENTS_ENABLED/,name+" must require explicit electronic payment flag");
  assert.match(source,/MNTY_ELECTRONIC_PAYMENTS_POST_LAUNCH_APPROVED/,name+" must require explicit post-launch approval");
  assert.match(source,/ELECTRONIC_PAYMENTS_DEFERRED/,name+" must fail closed with a stable response");
}
assert.match(api,/provider !== "CASH_ON_DELIVERY"/,"general payment API must remain cash-only");
assert.match(cashGuard,/revoke all on function public\.confirm_mantigo_cash_payment_backend\(uuid,text\) from public, anon, authenticated/i,"MantiGO customer self-confirmation RPC must be fail-closed until role-scoped confirmation is implemented");
assert.match(app,/MNTY_ELECTRONIC_PAYMENTS_ENABLED!==true/,"digital-page order modal must stop before creating a paid order");
assert.doesNotMatch(home,/id="mx-mg-card"/,"MantiGO UI must not expose online checkout before launch");
assert.doesNotMatch(home,/id="mx-mg-cash"/,"MantiGO customer UI must not self-confirm cash receipt");
assert.doesNotMatch(home,/confirm_mantigo_cash_payment_backend/,"MantiGO customer UI must not call self-confirmation RPC");
assert.match(home,/تأكيد استلام النقد من حساب العميل متوقف/,"MantiGO must explain the safe cash-confirmation limitation");
assert.match(smm,/الخدمة غير متاحة للطلبات حاليًا/,"SMM page must remain unavailable before launch");
assert.doesNotMatch(smm,/smm\.js/,"SMM page must not load the operational runtime before launch");
assert.match(smmRuntime,/SMM_LAUNCH_ENABLED=false/,"SMM runtime must be default-disabled");
assert.match(sw,/mnty-web-v130/,"service worker cache must be bumped for cash-first UI");
assert.match(sw,/home\.js\?v=rc402-cash-first/,"service worker must precache the updated home script");
assert.match(sw,/app\.js\?v=rc458-cash-first-20261020/,"service worker must precache the updated app script");
assert.match(index,/home\.js\?v=rc402-cash-first/,"index must reference updated home script");
assert.match(index,/app\.js\?v=rc458-cash-first-20261020/,"index must reference updated app script");
console.log("Cash-first launch boundary: PASS");
