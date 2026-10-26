import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('web/demo/index.html', 'utf8');
const source = fs.readFileSync('web/demo/demo.js', 'utf8');
const page = new JSDOM(html, {
  url: 'http://localhost/demo/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = page;
window.confirm = () => true;
window.eval(source);

const click = selector => {
  const el = window.document.querySelector(selector);
  assert.ok(el, 'Expected clickable element: ' + selector);
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return el;
};
const submit = selector => {
  const el = window.document.querySelector(selector);
  assert.ok(el, 'Expected form: ' + selector);
  el.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
};
const set = (selector, value) => {
  const el = window.document.querySelector(selector);
  assert.ok(el, 'Expected input: ' + selector);
  el.value = value;
  return el;
};
const db = () => JSON.parse(window.localStorage.getItem('MANTIQATIX_DEMO_DB_V1'));

assert.ok(window.document.querySelector('#login-form'), 'login form is rendered');
assert.match(window.document.body.textContent, /بيئة تجريبية مستقلة عن الإنتاج/);
click('[data-action="demo-login"][data-user-id="demo_owner"]');
assert.ok(window.document.querySelector('[data-tab="activities"]'), 'owner can open activities');

click('[data-action="tab"][data-tab="activities"]');
set('#business-name', 'نشاط اختبار آلي');
set('#business-sector', 'STORE');
set('#business-phone', '01000000055');
set('#business-city', 'القاهرة');
set('#business-description', 'إنشاء آلي ضمن اختبار DEMO');
submit('#business-form');

let data = db();
const business = data.businesses.find(b => b.name === 'نشاط اختبار آلي');
assert.ok(business, 'new activity is stored locally');
assert.equal(business.sector, 'STORE');
assert.ok(data.memberships.some(m => m.userId === 'demo_owner' && m.businessId === business.id && m.role === 'OWNER'), 'activity creator is its owner');

set('#product-name', 'منتج آلي');
set('#product-price', '42.5');
set('#product-stock', '3');
set('#product-available', 'true');
set('#product-description', 'منتج ينشأ أثناء الاختبار');
submit('#product-form');

data = db();
const product = data.products.find(p => p.businessId === business.id && p.name === 'منتج آلي');
assert.ok(product, 'new product is stored locally');
assert.equal(product.price, 42.5);
assert.equal(product.stock, 3);

const updateForm = window.document.querySelector('form[data-form="update-product"][data-product-id="' + product.id + '"]');
assert.ok(updateForm, 'owner gets edit controls for their own product');
updateForm.querySelector('[name="price"]').value = '50';
updateForm.querySelector('[name="stock"]').value = '2';
updateForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
data = db();
assert.equal(data.products.find(p => p.id === product.id).price, 50, 'price editing works');
assert.equal(data.products.find(p => p.id === product.id).stock, 2, 'stock editing works');

click('[data-action="tab"][data-tab="team"]');
set('#team-email', 'manager@demo.mantiqatix');
set('#team-role', 'STAFF');
submit('#team-form');
data = db();
assert.ok(data.memberships.some(m => m.userId === 'demo_manager' && m.businessId === business.id && m.role === 'STAFF' && m.active), 'owner can assign a staff role');

click('[data-action="tab"][data-tab="catalog"]');
set('#catalog-business', business.id);
window.document.querySelector('#catalog-business').dispatchEvent(new window.Event('change', { bubbles: true }));
click('[data-action="place-order"][data-business-id="' + business.id + '"][data-product-id="' + product.id + '"]');

data = db();
const order = data.orders.find(o => o.businessId === business.id && o.productId === product.id && o.customerId === 'demo_owner');
assert.ok(order, 'order creation works');
assert.equal(order.paymentMode, 'DEMO_ONLY', 'order cannot select a real payment route');
assert.equal(order.status, 'PENDING');
const updateOrderForm = window.document.querySelector('form[data-form="update-order"][data-order-id="' + order.id + '"]');
assert.ok(updateOrderForm, 'business owner can see status transition');
updateOrderForm.querySelector('[name="status"]').value = 'CONFIRMED';
updateOrderForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
data = db();
assert.equal(data.orders.find(o => o.id === order.id).status, 'CONFIRMED', 'allowed order status transition works');

click('[data-action="demo-login"][data-user-id="demo_customer"]');
assert.ok(window.document.querySelector('[data-tab="catalog"]'), 'customer can access public catalog');
click('[data-action="tab"][data-tab="catalog"]');
set('#catalog-business', business.id);
window.document.querySelector('#catalog-business').dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }));
click('[data-action="place-order"][data-business-id="' + business.id + '"][data-product-id="' + product.id + '"]');
data = db();
const customerOrder = data.orders.find(o => o.businessId === business.id && o.productId === product.id && o.customerId === 'demo_customer');
assert.ok(customerOrder, 'customer can place an order');
assert.equal(customerOrder.paymentMode, 'DEMO_ONLY');
assert.equal(data.orders.find(o => o.id === order.id).customerId, 'demo_owner', 'existing order identity remains separate');

click('[data-action="reset-demo"]');
assert.equal(window.localStorage.getItem('MANTIQATIX_DEMO_SESSION_V1'), null, 'reset clears demo session');
assert.equal(db().businesses.length, 4, 'reset restores only four seeded sector activities');
assert.equal(db().orders.every(o => o.paymentMode === 'DEMO_ONLY'), true, 'all seed orders remain simulation-only');

page.window.close();
console.log('DEMO workflow integration tests PASS: account access, activity creation, catalog/price/stock, team role assignment, order lifecycle, customer order, reset, and no real payment.');
