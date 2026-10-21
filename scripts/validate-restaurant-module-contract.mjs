import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync('web/restaurant-module.js', 'utf8');
const rbacSource = fs.readFileSync('web/rbac.js', 'utf8');

// The restaurant workspace must use the shared RBAC contract, not its own role allowlist.
assert.match(moduleSource, /select\('id,tenant_id,business_id,branch_id,role,status,permissions'\)/, 'membership lookup must include permission claims required by shared RBAC');
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
assert.match(moduleSource, /field\('rest-customer','اسم العميل'.*field\('rest-phone','رقم الهاتف'.*field\('rest-address','عنوان التوصيل'/, 'restaurant order form must capture customer contact and delivery details');
assert.match(moduleSource, /field\('rest-customer','اسم العميل','', 'text','maxlength="120" required autocomplete="name"'\)/, 'order form must require an explicit customer name');
assert.match(moduleSource, /if\(!customerName\|\|customerName\.length>120\)/, 'customer name must be validated before order submission');
assert.match(moduleSource, /customerName:selection\.customerName,customerPhone:selection\.customerPhone,deliveryAddress:selection\.deliveryAddress/,
  'canonical order payload must carry the entered customer details without silently substituting an email');
assert.match(moduleSource, /#rest-notes[\s\S]*notes:selection\.notes/, 'canonical order payload must carry order notes');
assert.doesNotMatch(moduleSource, /function askQuantity\(/, 'order flow must not silently choose the first catalog item');
assert.match(moduleSource, /invokeMntyFunction\('order-status-update'/,
  'restaurant order status changes must use canonical status function');
assert.doesNotMatch(moduleSource, /from\('restaurant_orders'\)\.update/,
  'legacy restaurant orders must not be updated directly by the browser');
assert.ok(moduleSource.includes("data-current-status=\"'+esc(current)+'\""), 'order status selector must preserve its persisted value');
assert.match(moduleSource, /PENDING:\['CONFIRMED','CANCELLED'\],[\s\S]*?CONFIRMED:\['PREPARING','CANCELLED'\],[\s\S]*?PREPARING:\['OUT_FOR_DELIVERY','CANCELLED'\],[\s\S]*?OUT_FOR_DELIVERY:\['DELIVERED'\]/, 'UI must mirror the canonical server order transition graph');
assert.ok(moduleSource.includes("(next.length?'':'disabled')"), 'terminal order statuses must not offer further transitions');
assert.ok(moduleSource.includes("if(ok)s.dataset.currentStatus=selected;else s.value=previous"), 'rejected status updates must restore the prior selection');
assert.match(moduleSource, /money\(x\.total_amount\?\?x\.total\)/, 'order totals must render from either supported canonical total field');
assert.match(moduleSource, /توزيع الطلبات حسب الحالة/, 'dashboard must show canonical order counts by state');
assert.match(moduleSource, /PENDING:\['CONFIRMED','CANCELLED'\][\s\S]*OUT_FOR_DELIVERY:\['DELIVERED'\]/, 'order status UI must only offer canonical legal transitions');
assert.match(moduleSource, /function reservationsView\(\)/, 'restaurant module must expose the reservation workspace');
assert.match(moduleSource, /sb\.rpc\('restaurant_reservation_mutate',\{p_action:'CREATE',p_payload:/, 'reservation creation must use the secured database RPC');
assert.match(moduleSource, /sb\.rpc\('restaurant_reservation_mutate',\{p_action:action,p_payload:/, 'reservation state transitions must use the secured database RPC');
assert.match(moduleSource, /guestCount>Number\(table\.capacity_persons\)/, 'reservation UI must validate the selected table capacity');
assert.match(moduleSource, /ends_at:endsAt,notes,idempotency_key:key/, 'reservation payload must carry bounded time range and idempotency key');

// Financial KPIs are intentionally omitted until an authoritative payment/settlement source is wired.
assert.match(moduleSource, /لا نعرض إجمالي مبيعات أو متوسط طلب باعتبارهما أرقامًا مالية معتمدة/,
  'dashboard must explicitly avoid presenting unverified financial KPIs as authoritative');
assert.ok(moduleSource.includes("if(s.dataset.pending==='1')return;const previous=s.dataset.currentStatus||s.value;const selected=s.value;s.dataset.pending='1';s.disabled=true"), 'concurrent status changes must be serialized per order selector');
assert.ok(moduleSource.includes("delete s.dataset.pending;if(s.isConnected)s.disabled=false"), 'status selector must be re-enabled after completion or failure');
assert.ok(moduleSource.includes("await load();return true;")&&moduleSource.includes("return false}"), 'status update handler must report success or failure');

// Editing a table must preserve the saved status instead of silently resetting to EMPTY.
assert.ok(moduleSource.includes("(x.status||'EMPTY')===status"),
  'table editor must select the persisted status');
assert.match(moduleSource, /if\(!Number\.isInteger\(payload\.table_number\)\|\|payload\.table_number<1\|\|!Number\.isInteger\(payload\.capacity_persons\)\|\|payload\.capacity_persons<1\)/,
  'table number and capacity must be validated');
assert.match(moduleSource, /if\(!existing\)\{payload\.current_stock_qty=0;payload\.unit_cost_egp=0;\}/, 'new inventory items must start at zero until an audited movement is recorded');
assert.match(moduleSource, /sb\.rpc\('restaurant_inventory_move'/, 'stock changes must use the atomic server-side movement RPC');
assert.match(moduleSource, /restaurant_inventory_movements'\)\.select\('id,movement_type,quantity,unit_cost_egp,idempotency_key,notes,created_by,created_at'\)/, 'inventory movement history must be read from the audit ledger');
assert.doesNotMatch(moduleSource, /restaurant_inventory'\)\.update\(\{[^}]*current_stock_qty/, 'browser code must not directly overwrite an existing stock balance');
assert.match(moduleSource, /restaurant_menu_items'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'menu updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_tables'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'table updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /restaurant_inventory'\)\.update\(payload\)\.eq\('id',existing\.id\)\.eq\('tenant_id',s\.tenant_id\)\.eq\('business_id',s\.business_id\)\.eq\('branch_id',s\.branch_id\)\.select\('id'\)\.maybeSingle\(\)/, 'inventory updates must be scoped to the active branch and detect unmatched writes');
assert.match(moduleSource, /if\(!r\.data\)return notify\('لم يتم الحفظ:/, 'zero-row updates must not be reported as success');
assert.ok(moduleSource.includes("if(saveButton.disabled)return;saveButton.disabled=true;try{await onSave(o)}catch(error){notify('حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى.','error')}finally{if(o.isConnected)saveButton.disabled=false}"), 'modal saves must be single-flight and surface unexpected errors');
assert.match(moduleSource, /function modal\(title,html,onSave,onCancel\)/, 'modal must expose an explicit cancellation callback');
assert.match(moduleSource, /document\.removeEventListener\('keydown',onKey\)/, 'modal keyboard listeners must be removed when the dialog closes');
assert.match(moduleSource, /o\._close=\(\)=>close\(false\)/, 'successful saves must close dialogs through the cleanup path');
assert.match(moduleSource, /o\._close\(\);resolve\(\{item,quantity,customerName,customerPhone,deliveryAddress,notes\}\);\s*\},\(\)=>resolve\(null\)\)/, 'canceling order details must resolve the pending order flow without leaving a stuck promise');

// Dashboard metrics must remain grounded in the bounded set of loaded orders.
assert.match(moduleSource, /const statusCounts=\{\};[\s\S]*state\.orders\.forEach\(order=>\{const key=String\(order\.status\|\|'UNKNOWN'\)\.toUpperCase\(\)/,
  'dashboard status counts must be derived from loaded order records');
assert.match(moduleSource, /ضمن آخر 100 طلب محمّل/,
  'dashboard must disclose the bounded sample behind status counts');
assert.match(moduleSource, /لا نعرض إجمالي مبيعات أو متوسط طلب باعتبارهما أرقامًا مالية معتمدة/,
  'dashboard must not present unverified sales totals as authoritative financial metrics');
assert.match(moduleSource, /async function refreshDashboard\(\)[\s\S]*if\(state\.refreshing\|\|state\.loading\)return/,
  'dashboard refresh must prevent overlapping refresh requests');
assert.match(moduleSource, /if\(!errs\.length\)state\.lastLoadedAt=new Date\(\)\.toISOString\(\)/,
  'last-updated timestamp must only advance after all dashboard queries succeed');
assert.match(moduleSource, /id="rest-refresh"/,
  'dashboard must expose a manual refresh control');

// Order details are rendered only from the active, already scoped order set.
assert.match(moduleSource, /function viewOrderDetails\(order\)/,
  'orders workspace must provide a dedicated order detail view');
assert.match(moduleSource, /state\.orders\.some\(x=>x\.id===order\.id\)/,
  'order details must only open for an order already present in the scoped loaded set');
assert.match(moduleSource, /data-order-detail=/,
  'order list must expose an explicit order detail action');
assert.match(moduleSource, /order\.items_json/,
  'order detail view must display item details when present in the loaded record');
assert.match(moduleSource, /ليست إثباتًا على تحصيل المبلغ أو تسويته ماليًا/,
  'order details must not imply that recorded totals are proof of payment settlement');

// Status mutation must be constrained by the currently loaded order and allowed transition map.
assert.match(moduleSource, /const order=state\.orders\.find\(x=>String\(x\.id\)===String\(id\)\)/,
  'status updates must target an order in the currently loaded scoped dataset');
assert.match(moduleSource, /allowed\[current\]\.includes\(String\(status\|\|''\)\.toUpperCase\(\)\)/,
  'status updates must reject transitions not allowed from the current loaded status');

assert.match(moduleSource, /const reservation=state\.reservations\.find\(r=>String\(r\.id\)===String\(id\)\)/, 'reservation actions must target a reservation in the currently loaded scoped dataset');
assert.match(moduleSource, /const allowed=\{CONFIRM:\['PENDING'\],SEAT:\['CONFIRMED'\],NO_SHOW:\['PENDING','CONFIRMED'\]\}/, 'reservation actions must be constrained by the current reservation status');
assert.match(moduleSource, /if\(!\['PENDING','CONFIRMED'\]\.includes\(String\(reservation\.status\|\|''\)\.toUpperCase\(\)\)\)/, 'reservation cancellation must reject terminal or unsupported states in the UI');

assert.match(moduleSource, /const startLabel=Number\.isFinite\(startMs\)\?new Date\(startMs\)\.toLocaleString\('ar-EG'\):'تاريخ غير صالح'/, 'reservation list must safely display invalid start timestamps');
assert.match(moduleSource, /const endLabel=Number\.isFinite\(endMs\)\?new Date\(endMs\)\.toLocaleString\('ar-EG'\):'تاريخ غير صالح'/, 'reservation list must safely display invalid end timestamps');
// Reservation filters must remain local and bounded to the already scoped loaded reservations.
assert.match(moduleSource, /id="rest-reservation-search"/, 'reservation view must expose customer/phone/table search');
assert.match(moduleSource, /id="rest-reservation-status"/, 'reservation view must expose a status filter');
assert.match(moduleSource, /id="rest-reservation-from"/, 'reservation view must expose a start-date filter');
assert.match(moduleSource, /id="rest-reservation-to"/, 'reservation view must expose an end-date filter');
assert.match(moduleSource, /state\.reservations\.filter\(r=>\{/, 'reservation filters must operate on the scoped loaded reservations');
assert.match(moduleSource, /آخر 100 حجز محمّل/, 'reservation view must disclose its local loaded-record bound');
assert.match(moduleSource, /filtered\.length\?filtered\.map\(r=>\{[\s\S]*?\.join\(''\):''/, 'empty filtered reservation results must use the shared empty-state message rather than claim there are no reservations');

// Kitchen board uses existing server-supported order statuses and the existing scoped dataset.
assert.match(moduleSource, /const orders=state\.orders\.filter\(o=>String\(o\.status\|\|''\)\.toUpperCase\(\)===stage\.status\)\.sort\(/,
  'kitchen queue must order each stage FIFO by order creation time');
assert.match(moduleSource, /Number\.POSITIVE_INFINITY/,
  'kitchen queue must place orders with invalid timestamps after timestamped orders');
assert.match(moduleSource, /function kitchenView\(\)/,
  'restaurant module must expose a dedicated kitchen board');
assert.match(moduleSource, /state\.tab==='kitchen'\?kitchenView\(\)/,
  'kitchen board must be reachable from module navigation');
assert.match(moduleSource, /title:'بانتظار بدء التحضير',next:'PREPARING'/,
  'kitchen board must start preparation using the existing CONFIRMED to PREPARING transition');
assert.match(moduleSource, /next:'OUT_FOR_DELIVERY',action:'تسليم للمندوب'/,
  'kitchen board must use the existing OUT_FOR_DELIVERY transition rather than inventing a ready status');
assert.match(moduleSource, /function kitchenView\(\)[\s\S]*?id="rest-refresh"[\s\S]*?آخر تحديث ناجح/,
  'kitchen board must expose a manual refresh control and the last successful refresh time');
assert.match(moduleSource, /مدة الانتظار وقت عرض الشاشة/,
  'kitchen cards must display elapsed time from the recorded order timestamp');
assert.match(moduleSource, /Date\.now\(\)-created\.getTime\(\)/,
  'kitchen elapsed time must be derived from the loaded order creation timestamp');
assert.match(moduleSource, /تعرض الشاشة الطلبات المحمّلة ضمن الفرع النشط فقط، بحد أقصى آخر 100 طلب/,
  'kitchen board must disclose its bounded active-branch dataset');
assert.match(moduleSource, /لا تُنشأ حالات جديدة من الواجهة/,
  'kitchen board must not introduce unsupported status transitions');

// Order search/filter must stay within the already scoped and bounded client result set.
assert.match(moduleSource, /const filtered=state\.orders\.filter\(x=>\{/,
  'order filters must operate on the loaded scoped order set');
assert.match(moduleSource, /x\.id,x\.customer_name,x\.customer_phone/,
  'order search must support order ID, customer name and phone');
assert.match(moduleSource, /invalidDateRange=Boolean\(state\.orderFromDate&&state\.orderToDate&&state\.orderFromDate>state\.orderToDate\)/,
  'order date filters must reject an inverted date range');
assert.match(moduleSource, /تاريخ البداية لازم يكون قبل تاريخ النهاية أو مساويًا له/,
  'inverted order date ranges must display a clear Arabic validation message');
assert.match(moduleSource, /id="rest-order-from-date"/,
  'orders view must expose a start-date filter');
assert.match(moduleSource, /id="rest-order-to-date"/,
  'orders view must expose an end-date filter');
assert.match(moduleSource, /state\.orderFromDate/,
  'order date filtering must be based on explicit local UI state');
assert.match(moduleSource, /id="rest-order-status-filter"/,
  'order list must expose a status filter');
assert.match(moduleSource, /النتائج: '\+filtered\.length\+' من '\+state\.orders\.length\+' طلب محمّل/,
  'order list must disclose the loaded result bound');
assert.match(moduleSource, /البحث محلي داخل آخر 100 طلب محمّل فقط/,
  'order list must disclose that local search is not historical global search');
assert.doesNotMatch(moduleSource, /const average=billable\.length\?[\s\S]{0,250}متوسط قيمة الطلب/,
  'dashboard must not imply an unverified order average is a verified financial metric');

// Menu search and filters remain bounded to the loaded catalog records.
assert.match(moduleSource, /const filtered=state\.menu\.filter\(x=>\{/,
  'menu search and filters must operate on the loaded menu set');
assert.match(moduleSource, /id="rest-menu-search"/,
  'menu view must expose a search field');
assert.match(moduleSource, /id="rest-menu-category-filter"/,
  'menu view must expose a category filter');
assert.match(moduleSource, /id="rest-menu-availability-filter"/,
  'menu view must expose an availability filter');
assert.match(moduleSource, /البحث والفلاتر محلية داخل آخر 200 صنف محمّل/,
  'menu view must disclose its loaded-record limit');

console.log('Restaurant module contract PASS');
