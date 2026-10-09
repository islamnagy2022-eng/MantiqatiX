import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');

// Restaurant source failures must survive loading and render as an explicit
// unavailable state instead of being indistinguishable from a valid empty list.
assert.match(app, /cache\.rows\.__errors\s*=\s*cache\.errors/, 'restaurant source errors must be carried to the renderer');
assert.match(app, /const errors\s*=\s*rows\.__errors\s*\|\|\s*\{\}/, 'restaurant renderer must read source errors');
assert.match(app, /NOT AVAILABLE/, 'restaurant source errors must be shown as unavailable');
assert.match(app, /esc\(errors\[key\]\)/, 'source error messages must be HTML escaped');

// CRM/support controls and mutation entry points must use the canonical RBAC
// contract; a hard-coded role list is not an authorization source.
assert.match(app, /MNTY_RBAC\?\.can\(role,\s*'CRM',\s*'create',\s*live\.permissions\)\s*===\s*true/, 'CRM create action must be RBAC-gated');
assert.match(app, /MNTY_RBAC\?\.can\(role,\s*'SUPPORT',\s*'create',\s*live\.permissions\)\s*===\s*true/, 'support create action must be RBAC-gated');
assert.match(app, /function canManageSupport\(\)\s*\{\s*return window\.MNTY_RBAC\?\.can\(String\(live\.role\|\|''\),\s*'SUPPORT',\s*'update',\s*live\.permissions\)\s*===\s*true\s*\}/, 'support update must use canonical RBAC');

// Restaurant membership must never fall back to an arbitrary ACTIVE row.
const restaurant = fs.readFileSync('web/restaurant-module.js', 'utf8');
assert.match(restaurant, /ACTIVE_MEMBERSHIP_SELECTION_REQUIRED/, 'multiple active memberships require explicit selection');
assert.match(restaurant, /ACTIVE_MEMBERSHIP_SELECTION_INVALID/, 'stale or invalid saved membership selection must fail closed');
assert.match(restaurant, /تعذر التحقق من العضوية التشغيلية/, 'membership lookup failures must render an explicit error state');
assert.match(restaurant, /if\(active\.length===1\)return active\[0\]/, 'only one active membership may be auto-selected');
assert.match(restaurant, /function askCart\(items,options\)/, 'restaurant order UI must support a multi-item cart');
assert.match(restaurant, /selectedOptionIds:select\?\[\.\.\.select\.selectedOptions\]/, 'restaurant cart must pass selected catalog options to server pricing');
assert.match(restaurant, /pendingOrderAttempt\.key/, 'order retry must reuse an idempotency key for an identical payload');
assert.match(restaurant, /الطاولات للقراءة فقط حاليًا/, 'table mutations must remain disabled until server-side lifecycle enforcement exists');
assert.match(restaurant, /المخزون للقراءة فقط حاليًا/, 'inventory mutations must remain disabled until the canonical stock ledger is wired');
assert.match(restaurant, /invokeMntyApi\('\/api\/v1\/catalog\?'/, 'restaurant menu must read from the canonical catalog API');
assert.match(restaurant, /clientIdempotencyKey:pendingOrderAttempt\.key/, 'order creation must send the stable idempotency key');
assert.doesNotMatch(restaurant, /from\('restaurant_tables'\)\.(insert|update|delete)/, 'restaurant tables must not be mutated directly from the browser');
assert.doesNotMatch(restaurant, /from\('restaurant_inventory'\)\.(insert|update|delete)/, 'restaurant inventory must not be mutated directly from the browser');
assert.match(restaurant, /select\('id,tenant_id,business_id,branch_id,role,permissions,status'\)/, 'membership permissions must be loaded from the authenticated membership row');
assert.match(restaurant, /window\.MNTY_RBAC\.can\(m\.role,module,action,m\.permissions\)===true/, 'restaurant actions must use the central RBAC contract');
assert.doesNotMatch(restaurant, /\['OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER','STAFF'\]/, 'restaurant must not authorize via a hard-coded role allowlist');

assert.match(restaurant, /canOperate\('ORDERS','create'\)/, 'order creation must require central order create permission');
assert.match(restaurant, /canOperate\('ORDERS','update'\)/, 'order status updates must require central order update permission');

assert.match(restaurant, /let saving=false;const save=o\.querySelector\('\[data-save\]'\)/, 'modal save actions must prevent repeated submissions while in flight');

assert.match(restaurant, /let creatingOrder=false/, 'order creation must prevent repeated concurrent clicks');




// Canonical catalog/order boundaries must fail closed.
const catalogAdmin = fs.readFileSync('supabase/functions/catalog-admin/index.ts', 'utf8');
const orderCreate = fs.readFileSync('supabase/functions/order-create/index.ts', 'utf8');
assert.match(catalogAdmin, /CATALOG_SCOPE_FORBIDDEN/, 'catalog writes must verify tenant/business/branch authorization at the Edge boundary');
assert.match(catalogAdmin, /ORIGIN_NOT_ALLOWED/, 'catalog-admin must reject unapproved browser origins');
assert.doesNotMatch(catalogAdmin, /Access-Control-Allow-Origin\": \"\*\"/, 'catalog-admin must not allow wildcard browser CORS');
assert.match(catalogAdmin, /m\.branch_id && String\(m\.branch_id\) === branchId/, 'branch-scoped managers must be constrained to their assigned branch');
assert.match(orderCreate, /select\("id,business_id,branch_id,name_ar,name_en,tax_rate,status,metadata"\)/, 'order-create must read catalog availability metadata');
assert.match(orderCreate, /x\.metadata\?\.is_available !== false/, 'server must reject unavailable catalog items');
assert.doesNotMatch(restaurant, /from\('restaurant_menu_items'\)\.(insert|update)/, 'legacy menu must not write prices that the canonical order path does not consume');
assert.match(restaurant, /قائمة الطعام — الكتالوج المركزي/, 'restaurant menu must render the canonical catalog rather than legacy menu records');
assert.match(restaurant, /إدارة الأصناف والأسعار متوقفة مؤقتًا/, 'menu writes must remain disabled until the secure canonical write path is deployed');

console.log('RC450 restaurant source-state and CRM/support RBAC contract PASS');
