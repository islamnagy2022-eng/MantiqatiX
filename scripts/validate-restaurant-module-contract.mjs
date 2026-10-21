import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync('web/restaurant-module.js', 'utf8');
const rbacSource = fs.readFileSync('web/rbac.js', 'utf8');

// The restaurant workspace must use the shared RBAC contract, not its own role allowlist.
assert.match(moduleSource, /window\.MNTY_RBAC\?\.can\(role,module,action,state\.membership\?\.permissions\)===true/,
  'restaurant actions must be checked through shared RBAC');
assert.doesNotMatch(moduleSource, /\['OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER','STAFF'\]/,
  'restaurant must not keep a local hard-coded role allowlist');
assert.match(rbacSource, /'المطاعم والمطابخ':'CATALOG'/,
  'restaurant module alias must resolve through the shared catalog permission model');

// Reads must be scoped independently by each module capability.
assert.match(moduleSource, /canOperate\('CATALOG','view'\)/, 'menu reads must respect catalog view capability');
assert.match(moduleSource, /canOperate\('ORDERS','view'\)/, 'order reads must respect order view capability');
assert.match(moduleSource, /canOperate\('OPERATIONS','view'\)/, 'table/inventory reads must respect operations view capability');

// Order creation/status must go through the canonical server functions.
assert.match(moduleSource, /invokeMntyFunction\('order-create',payload\)/,
  'restaurant order creation must use canonical order-create function');
assert.match(moduleSource, /invokeMntyFunction\('order-status-update'/,
  'restaurant order status changes must use canonical status function');
assert.doesNotMatch(moduleSource, /from\('restaurant_orders'\)\.update/,
  'legacy restaurant orders must not be updated directly by the browser');

// Editing a table must preserve the saved status instead of silently resetting to EMPTY.
assert.match(moduleSource, /\['EMPTY','OCCUPIED','RESERVED','CLEANING','OUT_OF_SERVICE'\]\.map\(status=>'<option '\+\+\(\(x\.status\|\|'EMPTY'\)===status\?'selected':''\)/,
  'table editor must select the persisted status');
assert.match(moduleSource, /if\(!Number\.isInteger\(payload\.table_number\)\|\|payload\.table_number<1\|\|!Number\.isInteger\(payload\.capacity_persons\)\|\|payload\.capacity_persons<1\)/,
  'table number and capacity must be validated');

console.log('Restaurant module contract PASS');
