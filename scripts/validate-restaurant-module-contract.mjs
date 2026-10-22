import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSource = fs.readFileSync('web/restaurant-module.js', 'utf8');
const rbacSource = fs.readFileSync('web/rbac.js', 'utf8');
const optionSnapshotMigration = fs.readFileSync('supabase/migrations/20261022140000_rc530_order_option_snapshot_details.sql', 'utf8');
const orderCreateSource = fs.readFileSync('supabase/functions/order-create/index.ts', 'utf8');

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
assert.match(moduleSource, /pendingOrderPayload/,
  'an uncertain order-create response must retain the original payload for an idempotent retry');
assert.match(moduleSource, /state\.pendingOrderPayload=payload/,
  'the exact order id and client idempotency key must be retained before calling the server');
assert.match(moduleSource, /إعادة محاولة الطلب المعلق/,
  'the UI must offer an explicit retry for an order with an uncertain response');
assert.match(moduleSource, /payload\.tenantId!==m\.tenant_id\|\|payload\.businessId!==m\.business_id\|\|payload\.branchId!==m\.branch_id/,
  'a pending order must not be retried under a different tenant/business/branch');

assert.match(moduleSource, /function askOrderDetails\(items, catalogOptions=\[\]\)/, 'order form must let staff select an authoritative catalog item and its options');
assert.match(moduleSource, /const selection=await askOrderDetails\(items,catalog\?\.options\|\|\[\]\)/, 'selected catalog item, quantity, and options must be used for order creation');
assert.match(moduleSource, /field\('rest-customer','اسم العميل'.*field\('rest-phone','رقم الهاتف'.*field\('rest-address','عنوان التوصيل'/, 'restaurant order form must capture customer contact and delivery details');
assert.match(moduleSource, /field\('rest-customer','اسم العميل','',? ?'text','maxlength="120" required autocomplete="name"'\)/, 'multi-item order form must require an explicit customer name');
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

assert.match(moduleSource, /متوسط قيمة الطلب/, 'dashboard must show a clearly scoped average order value');
assert.match(moduleSource, /ليس تقرير مبيعات محاسبيًا/, 'dashboard must not misrepresent order totals as accounting sales');
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
assert.match(moduleSource, /o\._close\(\);resolve\(\{items:selectedItems,customerName,customerPhone,deliveryAddress,notes\}\);\s*\},\(\)=>resolve\(null\)\)/, 'canceling multi-item order details must resolve the pending order flow without leaving a stuck promise');

// Order detail disclosure must render only escaped server-returned values and be keyboard/screen-reader discoverable.
assert.match(moduleSource, /data-order-details=/, 'order rows must expose a detail disclosure control');
assert.match(moduleSource, /aria-expanded="false"/, 'order detail disclosure must expose its initial expanded state');
assert.match(moduleSource, /data-order-details.*?b\.setAttribute\('aria-expanded',String\(opening\)\)/s, 'order detail disclosure must keep aria-expanded synchronized');
assert.match(moduleSource, /esc\(x\.customer_phone\|\|'غير مسجل'\)/, 'order details must HTML-escape customer phone data');
assert.match(moduleSource, /esc\(x\.delivery_address\|\|'غير مسجل'\)/, 'order details must HTML-escape delivery address data');
assert.match(moduleSource, /هذه شاشة القائمة المحلية القديمة ولا تتحكم في الأصناف أو الأسعار التي تُستخدم عند إنشاء الطلب.*?الكتالوج المركزي/s, 'the legacy restaurant menu must clearly disclose that order creation uses the central catalog');
assert.match(moduleSource, /function orderSnapshotView\(order\)/, 'order details must render the saved item snapshot in a dedicated view');
assert.match(moduleSource, /esc\(name\).*?esc\(item\?\.quantity\?\?'—'\).*?orderAmount\(item\?\.unit_price,currency\).*?orderAmount\(item\?\.line_subtotal,currency\).*?orderAmount\(item\?\.line_tax,currency\)/s, 'structured order item fields must be escaped and use saved pricing values');
assert.match(moduleSource, /order\.subtotal,currency\).*?order\.discount,currency\).*?order\.tax,currency\).*?order\.delivery_fee,currency\).*?order\.total_amount\?\?order\.total,currency/s, 'order detail must display the stored pricing breakdown and final total');
assert.match(moduleSource, /typeof items==='string'\)\{\s*try\{items=JSON\.parse\(items\)\}catch\(e\)\{items=null\}/, 'order snapshot parser must safely handle malformed JSON');

assert.match(moduleSource, /<td colspan="7">'\+details\+'<\/td>/, 'order detail content must remain inside the corresponding hidden table row');

assert.match(optionSnapshotMigration, /'selected_options',\(select coalesce\(jsonb_agg\(jsonb_build_object\('id',o\.id,'name',coalesce\(to_jsonb\(o\)->>'name_ar',to_jsonb\(o\)->>'name',to_jsonb\(o\)->>'label_ar',to_jsonb\(o\)->>'label',o\.id::text\),'price_delta',o\.price_delta\)/, 'RC530 must snapshot selected option identifiers, labels, and price deltas from the database');
assert.match(optionSnapshotMigration, /create or replace function public\.create_order_backend/, 'RC530 must update the canonical order creation function through a forward migration');
assert.match(moduleSource, /Array\.isArray\(item\?\.selected_options\).*?option\?\.name\|\|option\?\.id.*?orderAmount\(option\?\.price_delta,currency\)/s, 'order details must safely display option labels and saved price deltas');
assert.match(moduleSource, /optionDetails\?'<div class="muted">الخيارات: '\+optionDetails/s, 'option labels must be displayed alongside the matching item');

assert.match(moduleSource, /id="rest-order-search" type="search"/, 'orders view must provide a search input');
assert.match(moduleSource, /id="rest-order-status-filter"/, 'orders view must provide a status filter');
assert.match(moduleSource, /يعرض البحث آخر 100 طلب تم تحميلها لهذا الفرع فقط/, 'order search must disclose that it only filters the loaded branch-scoped result set');
assert.match(moduleSource, /data-order-search-value=.*?x\.customer_phone.*?x\.branch_id/s, 'order search must index escaped ID, customer, phone, and branch values');
assert.match(moduleSource, /orderSearch\?\.addEventListener\('input',filterOrders\).*?orderStatusFilter\?\.addEventListener\('change',filterOrders\)/s, 'order filters must update the visible list without re-querying or changing server scope');
assert.match(moduleSource, /if\(!visible\)\{detail\.hidden=true;const button=row\.querySelector\('\[data-order-details\]'\)/, 'hiding a filtered order must also close its detail disclosure');

assert.match(moduleSource, /id="rest-order-date-from" type="date"/, 'orders view must provide a start date filter');
assert.match(moduleSource, /id="rest-order-date-to" type="date"/, 'orders view must provide an end date filter');
assert.match(moduleSource, /data-order-date-value=.*?x\.created_at/s, 'order rows must carry their saved creation date for local date filtering');
assert.match(moduleSource, /from>to.*?setCustomValidity\('تاريخ النهاية يجب ألا يسبق تاريخ البداية'\)/s, 'date range validation must reject an end date before the start date');
assert.match(moduleSource, /matchesFrom=!from\|\|!!date&&date>=from.*?matchesTo=!to\|\|!!date&&date<=to/s, 'date filtering must compare normalized ISO calendar dates');
assert.match(moduleSource, /النتائج: '\+visibleCount\+' من '\+state\.orders\.length/s, 'order filters must report the number of visible results against the loaded set');

assert.match(moduleSource, /const statusLabels=\{PENDING:'معلق'.*?CANCELLED:'ملغي'\}/s, 'canonical order states must have Arabic display labels');
assert.match(moduleSource, /value="'\+esc\(current\)\+'">'\+esc\(statusLabels\[current\]\|\|current\|\|'غير محدد'\)/, 'localized status labels must preserve canonical status values');
assert.match(moduleSource, /next\.map\(s=>'<option value="'\+s\+'">'\+esc\(statusLabels\[s\]\|\|s\)/, 'next-state options must be localized while retaining canonical values');

assert.match(moduleSource, /function askOrderDetails\(items, catalogOptions=\[\]\)/, 'order form must accept options returned by the central catalog');
assert.match(moduleSource, /catalogOptions\.filter\(option=>String\(option\.catalog_item_id\)===String\(selectedId\)\)/, 'each order line may show only options belonging to its selected catalog item');
assert.match(moduleSource, /data-rest-option value="'\+esc\(option\.id\)/, 'option IDs must be escaped in the selection UI');
assert.match(moduleSource, /selectedOptionIds=\[\.\.\.line\.querySelectorAll\('\[data-rest-option\]:checked'\)\]/, 'each order line must submit explicitly selected option IDs');
assert.match(moduleSource, /askOrderDetails\(items,catalog\?\.options\|\|\[\]\)/, 'the restaurant order form must consume catalog options returned by the API');
assert.match(moduleSource, /items:selection\.items\.map\(line=>\(\{catalogItemId:line\.item\.id,quantity:line\.quantity,selectedOptionIds:line\.selectedOptionIds\}\)\)/, 'all validated order lines and their selected option IDs must reach the server-authoritative order creation function');
assert.match(moduleSource, /الأسعار والضرائب والإضافات النهائية يعتمدها الخادم/, 'the UI must clarify that the server controls final pricing for every line');

assert.match(moduleSource, /if\(window\.__MNTY_RESTAURANT_MODULE_OBSERVER__\)return;\s*window\.__MNTY_RESTAURANT_MODULE_OBSERVER__=true;\s*const mo=new MutationObserver\(observe\)/, 'repeated script evaluation must not attach duplicate restaurant module observers');
assert.match(moduleSource, /window\.__MNTY_RESTAURANT_MODULE_POLL__=window\.setInterval\(observe,800\)/, 'the singleton poll handle must be retained for lifecycle diagnostics');

assert.match(moduleSource, /function menuView\(\)[\s\S]*?id="rest-menu-search"[\s\S]*?id="rest-menu-category"[\s\S]*?data-menu-row="1"/, 'local menu records must expose searchable rows and category filters');
assert.match(moduleSource, /const filterMenu=\(\)=>[\s\S]*?matchesText[\s\S]*?matchesCategory[\s\S]*?menuFilterCount\.textContent/, 'menu filters must update visible rows and a result count');
assert.match(moduleSource, /النتائج ضمن أول 200 سجل قائمة محلي محمل/, 'menu filtering must disclose that it only covers loaded local legacy records');
assert.match(moduleSource, /تعديل السجل المحلي/, 'menu editing must be clearly labeled as local legacy data, not central catalog pricing');
assert.match(orderCreateSource, /customerName\.trim\(\)\.length > 120[\s\S]*?INVALID_CUSTOMER_NAME/, 'canonical order creation must reject blank or overlong customer names server-side');
assert.match(orderCreateSource, /customerPhone\.trim\(\)[\s\S]*?INVALID_CUSTOMER_PHONE/, 'canonical order creation must validate a supplied phone number server-side');
assert.match(orderCreateSource, /body\.deliveryAddress\.length > 500[\s\S]*?INVALID_DELIVERY_ADDRESS/, 'canonical order creation must bound delivery address length');
assert.match(orderCreateSource, /body\.notes\.length > 1000[\s\S]*?INVALID_ORDER_NOTES/, 'canonical order creation must bound order notes');
assert.match(orderCreateSource, /new Set\(x\.selectedOptionIds\)\.size !== x\.selectedOptionIds\.length[\s\S]*?INVALID_ITEM_OPTIONS/, 'canonical order creation must reject duplicate selected option IDs before pricing');

assert.ok(orderCreateSource.includes("INVALID_CUSTOMER_NAME") && orderCreateSource.includes("customerName.trim().length > 120"), 'server must validate customer name');
assert.ok(orderCreateSource.includes("INVALID_CUSTOMER_PHONE") && orderCreateSource.includes("customerPhone.trim()"), 'server must validate supplied customer phone');
assert.ok(orderCreateSource.includes("INVALID_DELIVERY_ADDRESS") && orderCreateSource.includes("body.deliveryAddress.length > 500"), 'server must bound delivery address');
assert.ok(orderCreateSource.includes("INVALID_ORDER_NOTES") && orderCreateSource.includes("body.notes.length > 1000"), 'server must bound order notes');
assert.ok(orderCreateSource.includes("new Set(x.selectedOptionIds).size !== x.selectedOptionIds.length"), 'server must reject duplicate option IDs before pricing');
assert.ok(orderCreateSource.includes('const orderCreatorRoles = new Set(["OWNER", "SALES"])') && orderCreateSource.includes('if (!orderCreatorRoles.has(role)) return false;'), 'restaurant staff must have ORDERS:create rather than merely any active branch membership');

// Multi-item orders must retain independent quantities and option selections per line.
assert.match(moduleSource, /data-order-line/,
  'order creation must render separately addressable item lines');
assert.match(moduleSource, /selectedItems\.push\(\{item,quantity,selectedOptionIds\}\)/,
  'each item line must preserve its own catalog item, quantity and selected options');
assert.match(moduleSource, /items:selection\.items\.map\(line=>\(\{catalogItemId:line\.item\.id,quantity:line\.quantity,selectedOptionIds:line\.selectedOptionIds\}\)\)/,
  'the canonical order payload must contain all selected item lines');
assert.match(moduleSource, /querySelectorAll\('\[data-order-line\]'\)\.length>=50/,
  'the UI must enforce a bounded number of item lines');
assert.match(moduleSource, /data-remove-order-line/,
  'users must be able to remove an accidental order line');

console.log('Restaurant module contract PASS');
