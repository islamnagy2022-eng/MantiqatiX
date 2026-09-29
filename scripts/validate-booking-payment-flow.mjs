import fs from "node:fs";

const app=fs.readFileSync("web/app.js","utf8");
const home=fs.readFileSync("web/home.js","utf8");
const api=fs.readFileSync("supabase/functions/api/index.ts","utf8");
const order=fs.readFileSync("supabase/functions/order-create/index.ts","utf8");
const payment=fs.readFileSync("supabase/functions/payment-intent/index.ts","utf8");

const required=[
  ["Public provider booking requires auth", "MNTYPendingProvider", home],
  ["Public provider booking opens catalog", "openProviderCatalog", home],
  ["Order endpoint requires Bearer token", 'authHeader?.startsWith("Bearer ")', api],
  ["Order endpoint rejects anonymous users", "user.is_anonymous", api],
  ["Order creation uses backend RPC", 'rpc("create_order_backend"', api],
  ["Order creation validates catalog items", "CATALOG_ITEM_NOT_AVAILABLE", order],
  ["Order creation validates active pricing", "ACTIVE_PRICE_NOT_AVAILABLE", order],
  ["Order creation uses server-authoritative pricing", "pricing_server_authoritative: true", order],
  ["Order creation records catalog pricing authority", 'pricing_authority: "catalog_v1"', order],
  ["Payment requires authenticated user", "user.is_anonymous", payment],
  ["Payment requires pricing snapshot", "pricing_hash", payment],
  ["Payment revalidates pricing before provider call", "Authoritative pricing changed; restart payment", payment],
  ["Payment provider is Paymob", 'p_provider: "PAYMOB"', payment],
  ["Paymob secret remains server-side", "PAYMOB_SECRET_KEY", payment]
];

const forbiddenClientOrder=[
  [/.from\(['"]orders['"]\)\.insert\(/, "Direct client order INSERT"],
  [/\.from\(['"]orders['"]\)\.update\(/, "Direct client order UPDATE"],
  [/\.from\(['"]payment_intents['"]\)\.insert\(/, "Direct client payment_intent INSERT"]
];

const failures=[];
for(const [name,marker,source] of required) if(!source.includes(marker)) failures.push(name);
for(const [re,label] of forbiddenClientOrder) if(re.test(app)) failures.push(label);

if(failures.length){
  console.error("Booking/payment production invariant check failed:");
  failures.forEach(x=>console.error("-",x));
  process.exit(1);
}
console.log(`Booking/payment production invariants passed: ${required.length} required checks + ${forbiddenClientOrder.length} forbidden direct-write checks.`);
