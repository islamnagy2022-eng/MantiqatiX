import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const moduleSource = fs.readFileSync('web/restaurant-module.js', 'utf8');
const rbacSource = fs.readFileSync('web/rbac.js', 'utf8');

// The restaurant workspace must use the shared RBAC contract, not its own role allowlist.
assert.match(moduleSource, /window\.MNTY_RBAC\?\.can\(role,module,action,state\.membership\?\.permissions\)===true/,
  'restaurant actions must be checked through shared RBAC');
assert.doesNotMatch(moduleSource, /\['OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER','STAFF'\]/,
  'restaurant must not keep a local hard-coded role allowlist');
assert.match(rbacSource, /'المطاعم والمطابخ':'CATALOG'/,
  'restaurant module alias must resolve through the shared catalog permission model');

// Membership selection must fail closed when the saved membership is stale or multiple active memberships exist.
assert.match(moduleSource, /if\(saved\)\{\s*const r=await base\(\)\.eq\('id',saved\)\.maybeSingle\(\);/);
assert.match(moduleSource, /if\(!r\.data\)return \{membership:null,error:'العضوية المحفوظة غير متاحة/);
assert.match(moduleSource, /const r=await base\(\)\.limit\(2\);/);
assert.match(moduleSource, /if\(rows\.length===1\)return \{membership:rows\[0\],error:null\};/);
assert.match(moduleSource, /if\(rows\.length>1\)return \{membership:null,error:'لديك أكثر من عضوية نشطة/);
assert.doesNotMatch(moduleSource, /\.limit\(1\)\.maybeSingle\(\)/, 'restaurant membership must never silently select the first active membership');
assert.match(moduleSource, /if\(!s\)\{state\.error='العضوية لا تحتوي نطاق نشاط وفرع كامل/);
assert.match(moduleSource, /const membershipResult=await membership\(state\.user\);/);

// Reads must be scoped independently by each module capability.
assert.match(moduleSource, /canOperate\('CATALOG','view'\)/, 'menu reads must respect catalog view capability');
assert.match(moduleSource, /canOperate\('ORDERS','view'\)/, 'order reads must respect order view capability');
assert.match(moduleSource, /canOperate\('OPERATIONS','view'\)/, 'table/inventory reads must respect operations view capability');

// Order creation/status must go through the canonical server functions.
assert.match(moduleSource, /invokeMntyFunction\('order-create',payload\)/,
  'restaurant order creation must use canonical order-create function');
assert.match(moduleSource, /function askOrderDetails\(items\)/, 'order form must let staff select an authoritative catalog item');
assert.match(moduleSource, /const selection=await askOrderDetails\(items\)/, 'selected catalog item and quantity must be used for order creation');
assert.doesNotMatch(moduleSource, /function askQuantity\(/, 'order flow must not silently choose the first catalog item');
assert.match(moduleSource, /field\('rest-customer','اسم العميل'/, 'order form must collect the customer name');
assert.match(moduleSource, /field\('rest-phone','رقم الهاتف'/, 'order form must collect a phone number');
assert.match(moduleSource, /field\('rest-address','عنوان التوصيل'/, 'order form must collect a delivery address');
assert.match(moduleSource, /customerPhone:selection\.customerPhone,deliveryAddress:selection\.deliveryAddress/, 'order payload must use the validated customer contact details');
assert.ok(moduleSource.includes("if(!/^[+0-9()\\s.-]{7,24}$/.test(customerPhone)"), 'order form must validate phone input before submitting');
assert.match(moduleSource, /o\.__close\(false\);resolve\(selection\);/, 'successful order-form completion must close cleanly without resolving as cancellation');
assert.match(moduleSource, /function modal\(title,html,onSave,onClose\)/, 'modal must expose cancellation handling for async forms');
assert.match(moduleSource, /if\(cancel&&typeof onClose==='function'\)onClose\(\)/, 'closing a modal must resolve pending async forms as cancelled');

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
assert.match(moduleSource, /if\(!existing\)payload\.current_stock_qty=Number\(o\.querySelector\('#stock'\)\.value\)/, 'existing stock balance must not be directly overwritten');
assert.match(moduleSource, /لا يمكن تعديل الرصيد مباشرة من هذه الشاشة/, 'inventory UI must explain the stock movement boundary');
assert.match(moduleSource, /restaurant_menu_items'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'menu updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_tables'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'table updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_inventory'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'inventory updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /if\(!r\.data\)return notify\('لم يتم الحفظ:/, 'zero-row updates must not be reported as success');
assert.ok(moduleSource.includes("if(saveButton.disabled)return;saveButton.disabled=true;try{await onSave(o)}catch(error){notify('حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى.','error')}finally{if(o.isConnected)saveButton.disabled=false}"), 'modal saves must be single-flight and surface unexpected errors');

// Exercise the actual membership selector against mocked Supabase query results.
const membershipSource = moduleSource.slice(moduleSource.indexOf('async function membership(user){'), moduleSource.indexOf('function canOperate('));
assert.ok(membershipSource.startsWith('async function membership(user){'), 'membership function must be extractable for behavior tests');
function membershipHarness(rows, savedId = null) {
  const localStorage = { getItem: () => savedId };
  const sb = { from: () => {
    const filters = [];
    let maxRows = Infinity;
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push([key, value]); return query; },
      limit: (n) => { maxRows = n; return query; },
      maybeSingle: async () => {
        const found = rows.filter(row => filters.every(([key, value]) => row[key] === value)).slice(0, maxRows);
        return { data: found.length === 1 ? found[0] : null, error: null };
      },
      then: (resolve, reject) => Promise.resolve({
        data: rows.filter(row => filters.every(([key, value]) => row[key] === value)).slice(0, maxRows),
        error: null
      }).then(resolve, reject)
    };
    return query;
  }};
  return vm.runInNewContext(membershipSource + '; membership', { localStorage, sb });
}
const activeMembershipA = { id: 'membership-a', user_id: 'user-a', tenant_id: 'tenant-a', business_id: 'business-a', branch_id: 'branch-a', role: 'BUSINESS_OWNER', status: 'ACTIVE' };
const activeMembershipB = { id: 'membership-b', user_id: 'user-a', tenant_id: 'tenant-b', business_id: 'business-b', branch_id: 'branch-b', role: 'BUSINESS_OWNER', status: 'ACTIVE' };
const oneMembershipResult = await membershipHarness([activeMembershipA])( { id: 'user-a' } );
assert.equal(oneMembershipResult.membership.id, 'membership-a', 'a single active membership may be selected automatically');
const ambiguousMembershipResult = await membershipHarness([activeMembershipA, activeMembershipB])({ id: 'user-a' });
assert.equal(ambiguousMembershipResult.membership, null, 'multiple active memberships must not auto-select the first');
assert.match(ambiguousMembershipResult.error, /أكثر من عضوية نشطة/);
const staleSavedMembershipResult = await membershipHarness([activeMembershipA], 'deleted-membership')({ id: 'user-a' });
assert.equal(staleSavedMembershipResult.membership, null, 'a stale saved membership must fail closed even if another active membership exists');
assert.match(staleSavedMembershipResult.error, /العضوية المحفوظة غير متاحة/);

console.log('Restaurant module contract PASS');
