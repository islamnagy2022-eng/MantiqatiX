import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync('web/restaurant-module.js', 'utf8');
const operationsSource = fs.readFileSync('web/operations-modules.js', 'utf8');
const rbacSource = fs.readFileSync('web/rbac.js', 'utf8');

// The restaurant workspace must use the shared RBAC contract, not its own role allowlist.
assert.match(moduleSource, /window\.MNTY_RBAC\?\.can\(role,module,action,state\.membership\?\.permissions\)===true/,
  'restaurant actions must be checked through shared RBAC');
assert.doesNotMatch(moduleSource, /\['OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER','STAFF'\]/,
  'restaurant must not keep a local hard-coded role allowlist');
assert.match(rbacSource, /'المطاعم والمطابخ':'CATALOG'/,
  'restaurant module alias must resolve through the shared catalog permission model');
assert.match(rbacSource, /'المطاعم':'CATALOG'.*'كافيهات':'CATALOG'/,
  'restaurant and cafe aliases must resolve through the shared catalog permission model');
assert.match(moduleSource, /\['المطاعم والمطابخ','المطاعم','كافيهات'\]\.includes\(label\)/,
  'the restaurant workspace must explicitly support restaurant and cafe routes');
assert.match(moduleSource, /function isCafe\(\)/,
  'the shared workspace must adapt its labels for cafe operators');
assert.match(operationsSource, /const restaurantWorkspace=\['المطاعم والمطابخ','المطاعم','كافيهات'\]\.includes\(n\);if\(restaurantWorkspace\)\{current=null;return\}/,
  'generic operations workspace must not race the restaurant workspace on restaurant/cafe routes');

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
assert.match(moduleSource, /let loadGeneration=0;/, 'restaurant loads must have a monotonically increasing generation');
assert.match(moduleSource, /const generation=\+\+loadGeneration;/, 'each restaurant load must invalidate prior in-flight reads');
assert.match(moduleSource, /if\(generation!==loadGeneration\)return;/, 'stale asynchronous results must be discarded after membership or branch changes');
assert.match(moduleSource, /catch\(error\)\{\s*if\(generation!==loadGeneration\)return;\s*state\.menu=\[\];state\.orders=\[\];state\.tables=\[\];state\.inventory=\[\];/,
  'unexpected read failures must clear stale rows and fail closed');
assert.match(moduleSource, /if\(errs\.length\)\{\s*state\.menu=\[\];state\.orders=\[\];state\.tables=\[\];state\.inventory=\[\];/,
  'partial query errors must not leave a misleading mixed dashboard');
assert.match(moduleSource, /canOperate\('CATALOG','view'\)/, 'menu reads must respect catalog view capability');
assert.match(moduleSource, /canOperate\('ORDERS','view'\)/, 'order reads must respect order view capability');
assert.match(moduleSource, /canOperate\('OPERATIONS','view'\)/, 'table/inventory reads must respect operations view capability');
assert.match(moduleSource, /tablesQ=tablesQ\.eq\('id','__MNTY_NO_OPERATIONS_VIEW__'\);\s*invQ=invQ\.eq\('id','__MNTY_NO_OPERATIONS_VIEW__'\);/,
  'users without operations view must not fall back to owner-only reads across tenants or branches');
assert.doesNotMatch(moduleSource, /tablesQ=tablesQ\.eq\('owner_user_id',state\.user\.id\)|invQ=invQ\.eq\('owner_user_id',state\.user\.id\)/,
  'table and inventory reads must not use owner-only fallback scope');

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
assert.ok(moduleSource.includes("if(!Number.isInteger(payload.table_number)||payload.table_number<1||payload.table_number>10000||!Number.isInteger(payload.capacity_persons)||payload.capacity_persons<1||payload.capacity_persons>100"),
  'table number and capacity must be validated within configured bounds');
assert.ok(moduleSource.includes('if(!existing)payload.current_stock_qty=0;'), 'new inventory items must start at zero until an auditable stock-movement endpoint exists');
assert.match(moduleSource, /لا يمكن تعديل الرصيد مباشرة من هذه الشاشة/, 'inventory UI must explain the stock movement boundary');
assert.match(moduleSource, /restaurant_menu_items'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'menu updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_tables'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'table updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_inventory'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'inventory updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /if\(!r\.data\)return notify\('لم يتم الحفظ:/, 'zero-row updates must not be reported as success');
assert.ok(moduleSource.includes("if(saveButton.disabled)return;saveButton.disabled=true;try{await onSave(o)}catch(error){notify('حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى.','error')}finally{if(o.isConnected)saveButton.disabled=false;else if(!closed)"), 'modal saves must be single-flight, surface unexpected errors, and clean up after removal');

// Menu and inventory inputs must have explicit client-side bounds and decimal precision checks.
assert.match(moduleSource, /payload\.name_ar\.length>150\|\|!payload\.category\|\|payload\.category\.length>80\|\|payload\.description_ar\.length>2000/,
  'menu text fields must have bounded lengths');
assert.match(moduleSource, /Math\.round\(payload\.base_price_egp\*100\)\/100!==payload\.base_price_egp/,
  'menu price must not contain more than two decimal places');
assert.match(moduleSource, /payload\.min_stock_alert_threshold\*1000\)!==payload\.min_stock_alert_threshold\*1000/,
  'inventory alert threshold must not contain more than three decimal places');
assert.match(moduleSource, /payload\.unit_cost_egp\*100\)!==payload\.unit_cost_egp\*100/,
  'inventory unit cost must not contain more than two decimal places');
assert.match(moduleSource, /max="100000000"/,
  'numeric menu and inventory fields must expose a reasonable upper bound');

// The restaurant operations dashboard must not substitute customer-history reads for order-view permission.
assert.match(moduleSource, /ordersQ=ordersQ\.eq\('id','__MNTY_NO_ORDERS_VIEW__'\)/,
  'users without ORDERS:view must receive no rows in the restaurant order console');
assert.doesNotMatch(moduleSource, /ordersQ=ordersQ\.eq\('customer_id',state\.user\.id\)/,
  'restaurant order dashboard must not use a customer-history fallback');

// Table and reservation inputs must be bounded before persistence.
assert.match(moduleSource, /payload\.table_number>10000\|\|!Number\.isInteger\(payload\.capacity_persons\)\|\|payload\.capacity_persons<1\|\|payload\.capacity_persons>100/,
  'table number and capacity must stay within bounded operational limits');
assert.ok(moduleSource.includes("String(payload.reserved_customer_name||'').length>150"),
  'reservation name must have a bounded length');

assert.match(moduleSource, /let ordersQ=sb\.from\('orders'\)\.select\('id,tenant_id,business_id,branch_id,status,total_amount,customer_name,created_at,updated_at'\)/,
  'restaurant order list must request only fields used by its current operational table');
assert.doesNotMatch(moduleSource, /ordersQ=sb\.from\('orders'\)\.select\([^)]*(customer_phone|delivery_address|items_json|notes)/,
  'restaurant order list must not fetch customer contact, delivery address, item payloads, or notes when the UI does not use them');

assert.match(moduleSource, /let menuQ=sb\.from\('restaurant_menu_items'\)\.select\('id,name_ar,description_ar,base_price_egp,category,is_available,is_popular'\)/,
  'restaurant menu reads must request only fields rendered or used by its current workspace');
assert.match(moduleSource, /let tablesQ=sb\.from\('restaurant_tables'\)\.select\('id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name'\)/,
  'restaurant table reads must not retrieve unused owner identifiers');
assert.match(moduleSource, /let invQ=sb\.from\('restaurant_inventory'\)\.select\('id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name'\)/,
  'restaurant inventory reads must not retrieve unused owner identifiers or timestamps');
assert.doesNotMatch(moduleSource, /(?:menuQ|tablesQ|invQ)=sb\.from\([^)]*\.select\([^)]*owner_user_id/,
  'restaurant workspace list queries must not fetch unused owner_user_id fields');

assert.equal(Math.round(0.29 * 100) / 100, 0.29, 'valid 0.29 EGP must survive floating-point-safe cents validation');
assert.notEqual(Math.round(1.234 * 100) / 100, 1.234, 'prices with more than two decimal places must be rejected');

assert.match(moduleSource, /async function createRestaurantOrder\(\)/,
  'restaurant order creation awaits catalog and order APIs and must be declared async');
assert.ok(moduleSource.includes("const catalog=await invokeMntyApi('/api/v1/catalog?"),
  'restaurant order creation must await the authoritative catalog response before asking for an item');
assert.match(moduleSource, /const r=await invokeMntyFunction\('order-create',payload\)/,
  'restaurant order creation must await the server-authoritative order endpoint');

assert.match(moduleSource, /function modal\(title,html,onSave,onClose\)/,
  'shared restaurant modal must support an explicit cancellation callback');
assert.match(moduleSource, /if\(typeof onClose==='function'\)onClose\(\)/,
  'closing a modal by button, Escape, or backdrop must invoke its cancellation callback once');
assert.match(moduleSource, /\},\(\)=>resolve\(null\)\);/,
  'cancelling restaurant order details must resolve the pending promise instead of leaving the flow suspended');

assert.match(moduleSource, /let creatingRestaurantOrder=false;/,
  'restaurant order creation must track an in-flight submission');
assert.match(moduleSource, /if\(creatingRestaurantOrder\)return;/,
  'a second order submission must be ignored while the first is in progress');
assert.match(moduleSource, /function pendingRestaurantOrderKey\(m\)/,
  'pending order retries must be scoped to the authenticated user, tenant, business, and branch');
assert.match(moduleSource, /function savePendingRestaurantOrder\(m,payload\)/,
  'order retry data must be persisted before the request can time out');
assert.match(moduleSource, /const \{orderId,tenantId,businessId,branchId,clientIdempotencyKey,currency,items,notes,metadata\}=payload/,
  'session retry storage must omit customer contact/name fields');
assert.match(moduleSource, /let payload=readPendingRestaurantOrder\(m\)/,
  'a retry must restore the previous logical order instead of generating a new idempotency key');
assert.match(moduleSource, /savePendingRestaurantOrder\(m,payload\);\s*const r=await invokeMntyFunction\('order-create',payload\);\s*clearPendingRestaurantOrder\(m\);/,
  'pending idempotency state must be saved before submission and cleared only after confirmed success');
assert.match(moduleSource, /trigger\.disabled=true;trigger\.textContent='جارٍ تجهيز الطلب…'/,
  'the order creation control must visibly disable while catalog/order requests are pending');
assert.match(moduleSource, /finally\{\s*creatingRestaurantOrder=false;\s*if\(trigger\?\.isConnected\)\{trigger\.disabled=false;trigger\.textContent=originalLabel;\}/,
  'order creation must restore its control after success, error, or cancellation');

assert.match(moduleSource, /else if\(!closed\)\{closed=true;document\.removeEventListener\('keydown',onKey\)/,
  'successful modal saves that remove the dialog directly must clean up the keyboard listener and restore focus');

console.log('Restaurant module contract PASS');
