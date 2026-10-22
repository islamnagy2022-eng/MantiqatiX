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

// Route detection must not poll forever when the DOM observer already covers route changes.
assert.match(moduleSource, /const mo=new MutationObserver\(observe\);\s*mo\.observe\(document\.body,\{childList:true,subtree:true\}\);\s*\/\/ Handle the initial route once; subsequent route changes are observed through DOM mutations\.\s*observe\(\);/,
  'restaurant route detection must initialize once and observe subsequent DOM changes');
assert.doesNotMatch(moduleSource, /setInterval\(observe,\s*800\)/,
  'restaurant route detection must not use an unnecessary permanent polling timer');

// Membership selection must fail closed and require an explicit choice when ambiguous.
assert.match(moduleSource, /async function activeMemberships\(user\)/,
  'active memberships must be loaded for an explicit, user-scoped choice');
assert.match(moduleSource, /state\.memberships=await activeMemberships\(state\.user\)/,
  'membership selection must be based on the signed-in user');
assert.match(moduleSource, /state\.memberships\.find\(m=>String\(m\.id\)===String\(saved\)\)\|\|null/,
  'a stale saved membership must not silently switch businesses');
assert.match(moduleSource, /if\(!state\.membership&&state\.memberships\.length===1\)/,
  'auto-selection is allowed only when exactly one active membership exists');
assert.match(moduleSource, /if\(!state\.membership\.tenant_id\|\|!state\.membership\.business_id\|\|!state\.membership\.branch_id\)/,
  'incomplete tenant/business/branch scope must fail closed before data reads');
assert.match(moduleSource, /function membershipChooser\(\)/,
  'ambiguous memberships must display an explicit chooser');
assert.match(moduleSource, /data-membership-choice/,
  'the user must explicitly choose the intended membership');
assert.match(moduleSource, /localStorage\.setItem\('MNTYActiveMembershipId',selected\.id\)/,
  'only the selected active membership may be persisted');
assert.doesNotMatch(moduleSource, /\.limit\(1\)\.maybeSingle\(\)/,
  'membership lookup must not silently select the first active membership');

// Reads must be scoped independently by each module capability.
assert.match(moduleSource, /canOperate\('CATALOG','view'\)/, 'menu reads must respect catalog view capability');
assert.match(moduleSource, /canOperate\('ORDERS','view'\)/, 'order reads must respect order view capability');
assert.match(moduleSource, /canOperate\('OPERATIONS','view'\)/, 'table/inventory reads must respect operations view capability');

// Inventory balances must not be edited as untraceable scalar values.
assert.ok(moduleSource.includes('if(!existing)payload.current_stock_qty=0;'), 'new inventory items must start at zero until an auditable stock-movement endpoint exists');
assert.doesNotMatch(moduleSource, /field\('stock','رصيد افتتاحي'/,
  'the browser must not accept unaudited opening stock balances');

// Order creation/status must go through the canonical server functions.
assert.match(moduleSource, /invokeMntyFunction\('order-create',payload\)/,
  'restaurant order creation must use canonical order-create function');
assert.match(moduleSource, /function askOrderDetails\(items\)/, 'order form must let staff select an authoritative catalog item');
assert.match(moduleSource, /const selection=await askOrderDetails\(items\)/, 'selected catalog item and quantity must be used for order creation');
assert.doesNotMatch(moduleSource, /function askQuantity\(/, 'order flow must not silently choose the first catalog item');
assert.match(moduleSource, /invokeMntyFunction\('order-status-update'/,
  'restaurant order status changes must use canonical status function');
assert.doesNotMatch(moduleSource, /from\('restaurant_orders'\)\.update/,
  'legacy restaurant orders must not be updated directly by the browser');
assert.ok(moduleSource.includes("data-current-status=\"'+esc(x.status)+'\""), 'order status selector must preserve its persisted value');
assert.ok(moduleSource.includes("if(ok)s.dataset.currentStatus=selected;else s.value=previous"), 'rejected status updates must restore the prior selection');
assert.ok(moduleSource.includes("if(s.dataset.pending==='1')return;const previous=s.dataset.currentStatus||s.value;const selected=s.value;s.dataset.pending='1';s.disabled=true"), 'concurrent status changes must be serialized per order selector');
assert.ok(moduleSource.includes("delete s.dataset.pending;if(s.isConnected)s.disabled=false"), 'status selector must be re-enabled after completion or failure');
assert.ok(moduleSource.includes("await load();return true;")&&moduleSource.includes("return false}"), 'status update handler must report success or failure');

// Editing a table must preserve the saved status instead of silently resetting to EMPTY.
assert.ok(moduleSource.includes("(x.status||'EMPTY')===status"),
  'table editor must select the persisted status');
assert.match(moduleSource, /if\(!Number\.isInteger\(payload\.table_number\)\|\|payload\.table_number<1\|\|!Number\.isInteger\(payload\.capacity_persons\)\|\|payload\.capacity_persons<1\)/,
  'table number and capacity must be validated');
assert.match(moduleSource, /if\\(!existing\\)payload\\.current_stock_qty=0;/, 'new inventory items must start at zero until an auditable stock-movement endpoint exists');
assert.match(moduleSource, /لا يمكن تعديل الرصيد مباشرة من هذه الشاشة/, 'inventory UI must explain the stock movement boundary');
assert.match(moduleSource, /restaurant_menu_items'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'menu updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_tables'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'table updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_inventory'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'inventory updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /if\(!r\.data\)return notify\('لم يتم الحفظ:/, 'zero-row updates must not be reported as success');
assert.ok(moduleSource.includes("if(saveButton.disabled)return;saveButton.disabled=true;try{await onSave(o)}catch(error){notify('حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى.','error')}finally{if(o.isConnected)saveButton.disabled=false}"), 'modal saves must be single-flight and surface unexpected errors');

console.log('Restaurant module contract PASS');
