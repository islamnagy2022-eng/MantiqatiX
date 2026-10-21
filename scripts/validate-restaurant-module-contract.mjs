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

// An explicit stale membership selection must fail closed rather than silently switching tenant.
assert.match(moduleSource, /if\(saved\)\{\s*const selected=await base\(\)\.eq\('id',saved\)\.maybeSingle\(\);\s*return \{membership:selected\.data\|\|null,options:\[\],stale:!selected\.data,error:selected\.error\|\|null\};\s*\}/,
  'stale or inaccessible active membership selection must not fall back to another tenant');
assert.doesNotMatch(moduleSource, /if\(!r\.data\)\{r=await sb\.from\('user_memberships'\)/,
  'membership lookup must not silently replace an invalid saved selection');
assert.match(moduleSource, /rest-clear-membership/,
  'a stale saved selection must expose an explicit recovery action');
assert.match(moduleSource, /removeItem\('MNTYActiveMembershipId'\);load\(\)/,
  'membership selection is cleared only after the user explicitly chooses recovery');
assert.match(moduleSource, /const pageSize=100;\s*const maxMemberships=500;[\s\S]*?base\(\)\.order\('id'\)\.range\(from,from\+pageSize-1\)/,
  'active memberships must be paginated deterministically rather than silently truncating at 20');
assert.match(moduleSource, /if\(options\.length>=maxMemberships\)return \{membership:null,options:\[\],needsSelection:false,stale:false,error:new Error\(/,
  'membership lists beyond the safety cap must fail closed rather than show an incomplete choice list');
assert.match(moduleSource, /if\(state\.selectionRequired\).*data-select-membership/s,
  'multiple active memberships must render a membership choice screen');
assert.match(moduleSource, /const selectedScope=scope\(\);\s*if\(!selectedScope\)\{state\.membership=null;state\.error='بيانات نطاق المؤسسة أو النشاط أو الفرع غير مكتملة/,
  'incomplete tenant/business/branch membership scope must fail closed before data queries');
assert.match(moduleSource, /Do not expose raw database\/provider errors in the user interface/);
assert.match(moduleSource, /state\.error=errs\.length\?'تعذر تحميل بعض بيانات المطعم/);
assert.match(moduleSource, /finally\{state\.loading=false;render\(\);\}/,
  'data loading must recover from query failures and always clear loading state');
assert.match(moduleSource, /انتهت الجلسة أو لم يتم تسجيل الدخول/,
  'unauthenticated users must see a human-readable session message');
assert.match(moduleSource, /تعذر التحقق من جلسة المستخدم أو عضوياته/,
  'membership/session exceptions must fail closed with a generic message');
assert.doesNotMatch(moduleSource, /notify\('تعذر الحفظ: '\+r\.error\.message/,
  'raw database mutation errors must not be exposed to the user');
assert.doesNotMatch(moduleSource, /تعذر تحديث حالة الطلب: '\+\(e\?\.message/,
  'raw server mutation errors must not be exposed to the user');
assert.doesNotMatch(moduleSource, /notify\('تعذر إنشاء الطلب: '\+\(e\?\.message/,
  'raw order-creation errors must not be exposed to the user');
assert.doesNotMatch(moduleSource, /notify\('تعذر الحفظ: '\+r\.error\.message/,
  'raw save errors must not be exposed to the user in any restaurant editor');
assert.match(moduleSource, /setItem\('MNTYActiveMembershipId',id\);load\(\)/,
  'the chosen membership must be explicitly saved before loading its workspace');

// Reads must be scoped independently by each module capability.
assert.match(moduleSource, /canOperate\('CATALOG','view'\)/, 'menu reads must respect catalog view capability');
assert.match(moduleSource, /Limited catalog reads remain pinned to the selected tenant, business and branch\.\s*menuQ=menuQ\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.eq\('is_available',true\)/,
  'limited catalog reads must remain branch-scoped when CATALOG:view is denied');
assert.match(moduleSource, /canOperate\('ORDERS','view'\)/, 'order reads must respect order view capability');
assert.match(moduleSource, /canOperate\('OPERATIONS','view'\)/, 'table/inventory reads must respect operations view capability');
assert.match(moduleSource, /Tables and inventory are operational records, not personal fallback data/,
  'tables and inventory must not use owner_user_id as a fallback when OPERATIONS:view is denied');
assert.match(moduleSource, /tablesQ=Promise\.resolve\(\{data:\[\],error:null\}\);\s*invQ=Promise\.resolve\(\{data:\[\],error:null\}\);/,
  'unauthorized operations reads must resolve to empty results without querying operational tables');
assert.doesNotMatch(moduleSource, /tablesQ=tablesQ\.eq\('owner_user_id',state\.user\.id\)|invQ=invQ\.eq\('owner_user_id',state\.user\.id\)/,
  'operations read denial must not fall back to owner-filtered table or inventory queries');

// Order creation/status must go through the canonical server functions.
assert.match(moduleSource, /invokeMntyFunction\('order-create',payload\)/,
  'restaurant order creation must use canonical order-create function');
assert.match(moduleSource, /function askOrderDetails\(items\)/, 'order form must let staff select an authoritative catalog item');
assert.match(moduleSource, /const selection=await askOrderDetails\(items\)/, 'selected catalog item and quantity must be used for order creation');
assert.match(moduleSource, /field\('rest-customer','اسم العميل'\).*field\('rest-phone','رقم الهاتف'.*field\('rest-address','عنوان التوصيل'/, 'restaurant order form must capture customer contact and delivery details');
assert.match(moduleSource, /customerName:selection\.customerName\|\|state\.user\.email\|\|'',customerPhone:selection\.customerPhone,deliveryAddress:selection\.deliveryAddress/,
  'canonical order payload must carry the entered customer details');
assert.match(moduleSource, /rest-notes.*selection\.notes/, 'canonical order payload must carry order notes');
assert.doesNotMatch(moduleSource, /function askQuantity\(/, 'order flow must not silently choose the first catalog item');
assert.match(moduleSource, /invokeMntyFunction\('order-status-update'/,
  'restaurant order status changes must use canonical status function');
assert.doesNotMatch(moduleSource, /from\('restaurant_orders'\)\.update/,
  'legacy restaurant orders must not be updated directly by the browser');
assert.ok(moduleSource.includes("data-current-status=\"'+esc(x.status)+'\""), 'order status selector must preserve its persisted value');
assert.ok(moduleSource.includes("if(ok)s.dataset.currentStatus=selected;else s.value=previous"), 'rejected status updates must restore the prior selection');
assert.match(moduleSource, /money\(x\.total_amount\?\?x\.total\)/, 'order totals must render from either supported canonical total field');
assert.ok(moduleSource.includes("if(s.dataset.pending==='1')return;const previous=s.dataset.currentStatus||s.value;const selected=s.value;s.dataset.pending='1';s.disabled=true"), 'concurrent status changes must be serialized per order selector');
assert.ok(moduleSource.includes("delete s.dataset.pending;if(s.isConnected)s.disabled=false"), 'status selector must be re-enabled after completion or failure');
assert.ok(moduleSource.includes("await load();return true;")&&moduleSource.includes("return false}"), 'status update handler must report success or failure');

// Editing a table must preserve the saved status instead of silently resetting to EMPTY.
assert.ok(moduleSource.includes("(x.status||'EMPTY')===status"),
  'table editor must select the persisted status');
assert.match(moduleSource, /if\(!Number\.isInteger\(payload\.table_number\)\|\|payload\.table_number<1\|\|!Number\.isInteger\(payload\.capacity_persons\)\|\|payload\.capacity_persons<1\)/,
  'table number and capacity must be validated');
assert.match(moduleSource, /if\(!existing\)payload\.current_stock_qty=Number\(o\.querySelector\('#stock'\)\.value\)/, 'existing stock balance must not be directly overwritten');
assert.match(moduleSource, /لا يمكن تعديل الرصيد مباشرة من هذه الشاشة/, 'inventory UI must explain the stock movement boundary');
assert.match(moduleSource, /restaurant_menu_items'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'menu updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_tables'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'table updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_inventory'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'inventory updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /if\(!r\.data\)return notify\('لم يتم الحفظ:/, 'zero-row updates must not be reported as success');
assert.ok(moduleSource.includes("if(saveButton.disabled)return;saveButton.disabled=true;try{await onSave(o)}catch(error){notify('حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى.','error')}finally{if(o.isConnected)saveButton.disabled=false}"), 'modal saves must be single-flight and surface unexpected errors');
assert.match(moduleSource, /function modal\(title,html,onSave,onCancel\)/, 'modal must expose an explicit cancellation callback');
assert.match(moduleSource, /document\.removeEventListener\('keydown',onKey\)/, 'modal keyboard listeners must be removed when the dialog closes');
assert.match(moduleSource, /o\._close=\(\)=>close\(false\)/, 'successful saves must close dialogs through the cleanup path');
assert.match(moduleSource, /o\._close\(\);resolve\(\{item,quantity\}\);\s*\},\(\)=>resolve\(null\)\)/, 'canceling order details must resolve the pending order flow without leaving a stuck promise');

console.log('Restaurant module contract PASS');
