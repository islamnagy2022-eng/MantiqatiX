import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('web/app.js', 'utf8');
const orderQuery = app.match(/sb\.from\('orders'\)\.select\('([^']+)'\)/);
assert.ok(orderQuery, 'orders query must exist');
for (const column of [
  'items_json','subtotal','discount','tax','delivery_fee','total_amount','currency',
  'customer_name','customer_phone','delivery_address','notes','pricing_snapshot','pricing_authority'
]) assert.ok(orderQuery[1].split(',').includes(column), `order query must load ${column}`);
assert.match(app, /items:Array\.isArray\(r\.items_json\)\?r\.items_json/, 'items_json must feed order details');
assert.match(app, /x\.catalogItemId\|\|x\.catalog_item_id\|\|x\.item_id/, 'snapshot item IDs must be supported');
assert.match(app, /x\.unitPrice\?\?x\.unit_price/, 'snapshot unit price must be shown');
assert.match(app, /x\.lineSubtotal\?\?x\.line_subtotal/, 'snapshot line total must be shown');
assert.match(app, /invokeMntyFunction\('order-status-update'/, 'state changes must remain server-authoritative');
console.log('ORDER_DETAIL_SNAPSHOT=PASS');
