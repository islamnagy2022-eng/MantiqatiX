import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const app = read('web/app.js');
const restaurant = read('web/restaurant-module.js');
const orderCreate = read('supabase/functions/order-create/index.ts');
const orderStatus = read('supabase/functions/order-status-update/index.ts');
const paymentIntent = read('supabase/functions/payment-intent/index.ts');
const settlement = read('supabase/functions/settlement-create/index.ts');
const workflow = read('.github/workflows/pages.yml');

const checks = [
  ['customer order creation uses canonical Edge Function', /order-create/ .test(app)],
  ['customer status mutation uses canonical Edge Function', /order-status-update/.test(app)],
  ['restaurant order creation uses canonical Edge Function', /order-create/.test(restaurant)],
  ['restaurant status mutation uses canonical Edge Function', /order-status-update/.test(restaurant)],
  ['order creation authenticates the user', /auth\.getUser\(token\)/.test(orderCreate)],
  ['order creation rejects anonymous sessions', /user\.is_anonymous/.test(orderCreate)],
  ['order creation validates idempotency key', /clientIdempotencyKey/.test(orderCreate)],
  ['order creation reads canonical catalog', /catalog_items/.test(orderCreate)],
  ['order creation reads canonical pricing', /catalog_item_prices/.test(orderCreate)],
  ['order creation persists pricing snapshot/hash', /pricing_snapshot|pricing_hash|pricing_version/.test(orderCreate)],
  ['order status mutation delegates to backend authority', /update_order_status_backend/.test(orderStatus)],
  ['payment intent requires authenticated user', /auth\.getUser/.test(paymentIntent)],
  ['payment intent requires authoritative pricing snapshot', /pricing_hash/.test(paymentIntent) && /pricing_version/.test(paymentIntent)],
  ['payment intent carries idempotency key', /idempotencyKey/.test(paymentIntent)],
  ['settlement is server-side', /create_settlement_backend/.test(settlement)],
  ['production CI checks lifecycle sources', /order-create/.test(workflow) && /order-status-update/.test(workflow) && /payment-intent/.test(workflow) && /settlement-create/.test(workflow)]
];

for (const [label, ok] of checks) {
  if (!ok) throw new Error('Order lifecycle contract guard failed: ' + label);
}

// The browser must never mutate canonical orders directly.
const directOrderMutation = /\.from\(['"]orders['"]\)\s*\.update\(/.test(app) ||
  /\.from\(['"]orders['"]\)\s*\.insert\(/.test(app) ||
  /\.from\(['"]orders['"]\)\s*\.delete\(/.test(app);
if (directOrderMutation) {
  throw new Error('Order lifecycle contract guard failed: browser direct mutation of public.orders detected.');
}

console.log('Order lifecycle contract: PASS');
