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
assert.match(restaurant, /\.eq\('id',saved\)\.eq\('user_id',user\.id\)\.eq\('status','ACTIVE'\)\.maybeSingle\(\)/, 'saved membership selection must be checked by ID, authenticated owner, and ACTIVE status');
assert.match(restaurant, /\.eq\('user_id',user\.id\)\.eq\('status','ACTIVE'\)\.limit\(2\)/, 'ambiguous membership detection must not depend on an arbitrary first-row choice');
assert.match(restaurant, /if\(!scope\(\)\)\{state\.error='العضوية النشطة لا تحدد منشأة وفرعًا صالحين/, 'restaurant module must fail closed when tenant/business/branch scope is missing');
assert.match(restaurant, /تعذر التحقق من العضوية التشغيلية/, 'membership lookup failures must render an explicit error state');
assert.match(restaurant, /if\(active\.length===1\)return active\[0\]/, 'only one active membership may be auto-selected');
assert.match(restaurant, /function askCart\(items,options\)/, 'restaurant order UI must support a multi-item cart');
assert.match(restaurant, /لا يعيّن مندوبًا أو يفعّل تتبعًا تلقائيًا/, 'delivery UI must disclose that courier dispatch/tracking is not integrated');
assert.match(restaurant, /selectedOptionIds:select\?\[\.\.\.select\.selectedOptions\]/, 'restaurant cart must pass selected catalog options to server pricing');
assert.match(restaurant, /pendingOrderAttempt\.key/, 'order retry must reuse an idempotency key for an identical payload');
assert.match(restaurant, /الطاولات للقراءة فقط حاليًا/, 'table mutations must remain disabled until server-side lifecycle enforcement exists');
assert.match(restaurant, /المخزون للقراءة فقط حاليًا/, 'inventory mutations must remain disabled until the canonical stock ledger is wired');
assert.match(restaurant, /invokeMntyApi\('\/api\/v1\/catalog\?'/, 'restaurant menu must read from the canonical catalog API');
assert.match(restaurant, /clientIdempotencyKey:pendingOrderAttempt\.key/, 'order creation must send the stable idempotency key');
assert.doesNotMatch(restaurant, /from\('restaurant_tables'\)\.(insert|update|delete)/, 'restaurant tables must not be mutated directly from the browser');
assert.doesNotMatch(restaurant, /from\('restaurant_inventory'\)\.(insert|update|delete)/, 'restaurant inventory must not be mutated directly from the browser');
assert.match(restaurant, /const fields='id,tenant_id,business_id,branch_id,role,permissions,status'/, 'membership permissions must be loaded from the authenticated membership row');
assert.match(restaurant, /window\.MNTY_RBAC\.can\(m\.role,module,action,m\.permissions\)===true/, 'restaurant actions must use the central RBAC contract');
assert.doesNotMatch(restaurant, /\['OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER','STAFF'\]/, 'restaurant must not authorize via a hard-coded role allowlist');

assert.match(restaurant, /canOperate\('ORDERS','create'\)/, 'order creation must require central order create permission');
assert.match(restaurant, /canOperate\('ORDERS','update'\)/, 'order status updates must require central order update permission');
assert.match(restaurant, /window\.confirm\('هل تؤكد إلغاء الطلب/, 'order cancellation must require user confirmation');
assert.match(restaurant, /s\.value=previous;s\.disabled=false/, 'failed status changes must restore the prior displayed status');

assert.match(restaurant, /let saving=false;const save=o\.querySelector\('\[data-save\]'\)/, 'modal save actions must prevent repeated submissions while in flight');

assert.match(restaurant, /let creatingOrder=false/, 'order creation must prevent repeated concurrent clicks');




// Canonical catalog/order boundaries must fail closed.
const catalogAdmin = fs.readFileSync('supabase/functions/catalog-admin/index.ts', 'utf8');
const orderCreate = fs.readFileSync('supabase/functions/order-create/index.ts', 'utf8');
assert.match(catalogAdmin, /CATALOG_SCOPE_FORBIDDEN/, 'catalog writes must verify tenant/business/branch authorization at the Edge boundary');
assert.match(catalogAdmin, /ORIGIN_NOT_ALLOWED/, 'catalog-admin must reject unapproved browser origins');
assert.match(catalogAdmin, /const CATALOG_ACTIONS:/, 'catalog-admin must enforce action-specific catalog permissions');
assert.match(catalogAdmin, /admin\.rpc\("upsert_catalog_item_backend"/, 'catalog RPCs must run with service role only after Edge authorization');
assert.match(catalogAdmin, /admin\.rpc\("upsert_catalog_price_backend"/, 'catalog price RPC must use the authorized backend client');
assert.match(catalogAdmin, /admin\.rpc\("upsert_catalog_settings_backend"/, 'catalog settings RPC must use the authorized backend client');
assert.doesNotMatch(catalogAdmin, /client\.rpc\(/, 'catalog-admin must not forward user JWT context into service-role-only catalog RPCs');
assert.match(catalogAdmin, /BRANCH_SCOPED_ROLES/, 'branch-scoped catalog roles must be restricted to their assigned branch');
assert.match(catalogAdmin, /INVALID_UNIT_PRICE/, 'catalog price input must reject negative or non-finite amounts');
assert.match(catalogAdmin, /INVALID_TAX_RATE/, 'catalog item tax rate must be bounded and finite');
assert.match(catalogAdmin, /INVALID_BUSINESS_OR_BRANCH_ID/, 'catalog writes must validate business and branch identifier formats');
assert.doesNotMatch(catalogAdmin, /!isUuid\(branchId\)/, 'branch IDs are opaque varchar identifiers, not necessarily UUIDs');
assert.match(catalogAdmin, /INVALID_CATALOG_ITEM_ID/, 'catalog writes must validate item identifier formats');
const catalogMigration = fs.readFileSync('supabase/migrations/20261009130000_catalog_edge_service_role_boundary.sql', 'utf8');
assert.match(catalogMigration, /coalesce\(auth\.role\(\),''\) <> 'service_role'/, 'catalog RPC migration must permit trusted service-role execution without forwarding a user JWT');
assert.match(catalogMigration, /revoke all on function public\.upsert_catalog_item_backend[\s\S]*?from public, anon, authenticated;/i, 'catalog RPCs must remain inaccessible to public/anon/authenticated callers');
assert.match(catalogMigration, /grant execute on function public\.upsert_catalog_item_backend[\s\S]*?to service_role;/i, 'catalog RPCs must remain service-role-only');
assert.match(catalogMigration, /for update;/i, 'catalog price version allocation must serialize concurrent updates');
assert.match(catalogMigration, /v_authorized_membership boolean:=false/, 'order RPC must apply a database-side membership authorization backstop');
assert.match(catalogMigration, /where m\.user_id=p_customer_id\s+and m\.status='ACTIVE'/, 'order RPC membership backstop must require explicit ACTIVE status rather than treating NULL as active');
assert.doesNotMatch(catalogMigration, /coalesce\(m\.status,\s*'ACTIVE'\)\s*=\s*'ACTIVE'/i, 'catalog admin RPCs must never treat NULL membership status as ACTIVE');
assert.equal((catalogMigration.match(/m\.tenant_id=p_tenant_id and m\.status='ACTIVE'/g) || []).length, 4, 'all catalog role checks must require explicit ACTIVE tenant membership');
assert.match(catalogMigration, /jsonb_array_length\(p_items_json\)>100/, 'order RPC must independently cap item count');
assert.match(catalogMigration, /jsonb_typeof\(coalesce\(v_item->'selectedOptionIds','\[\]'::jsonb\)\) <> 'array'/, 'order RPC must reject malformed option selections');
assert.match(catalogMigration, /where business_id=p_business_id and tenant_id=p_tenant_id/, 'order settings must be loaded within the requested tenant scope');
assert.match(catalogMigration, /BUSINESS_SETTINGS_TENANT_MISMATCH/, 'order RPC must fail closed on cross-tenant settings mismatch');
assert.match(catalogMigration, /length\(trim\(p_client_idempotency_key\)\)>200/, 'order RPC must cap idempotency key length');
assert.match(catalogMigration, /upper\(trim\(coalesce\(p_currency,'EGP'\)\)\) <> 'EGP'/, 'order RPC must enforce the supported currency at the database boundary');
assert.match(catalogMigration, /if v_currency <> 'EGP' then raise exception 'UNSUPPORTED_CURRENCY'/, 'order RPC must reject unsupported currency in persisted business settings');
assert.match(catalogMigration, /INVALID_CATALOG_TAX_RATE/, 'order RPC must reject invalid persisted tax rates');
assert.match(catalogMigration, /INVALID_CATALOG_PRICE/, 'order RPC must reject invalid persisted unit prices');
assert.match(catalogMigration, /\(v_price\.unit_price\+v_opt_total\)<0/, 'order RPC must prevent options from producing a negative unit price');
assert.match(catalogMigration, /upper\(m\.role\)='CUSTOMER'/, 'customer order authorization must require an active customer membership');
assert.match(catalogMigration, /upper\(m\.role\) in \('BUSINESS_OWNER','ADMIN','MANAGER','SALES'\)/, 'database order authorization must include SALES for canonical ORDERS:create parity while retaining scoped membership checks');
assert.match(catalogMigration, /IDEMPOTENCY_LEGACY_PAYLOAD_UNVERIFIABLE/, 'legacy idempotency rows without a request hash must fail closed');
assert.doesNotMatch(catalogMigration, /if v_existing\.metadata \? 'request_hash' and/, 'idempotency must not silently accept existing keys with unverifiable payloads');
assert.doesNotMatch(catalogAdmin, /Access-Control-Allow-Origin\": \"\*\"/, 'catalog-admin must not allow wildcard browser CORS');
assert.match(catalogAdmin, /membershipBranchId === branchId/, 'branch-scoped managers must be constrained to their assigned branch');
assert.match(orderCreate, /select\("id,business_id,branch_id,name_ar,name_en,tax_rate,status,metadata"\)/, 'order-create must read catalog availability metadata');
assert.match(orderCreate, /x\.metadata\?\.is_available !== false/, 'server must reject unavailable catalog items');
assert.match(orderCreate, /const orderCreateRoles = new Set\(\["OWNER", "SALES"\]\)/, 'server order-create role set must match canonical RBAC roles with ORDERS:create');
assert.doesNotMatch(orderCreate, /roleDefaultCanManageOrders/, 'server order-create must not override canonical role permissions with a broad role-default bypass');
assert.match(orderCreate, /INVALID_CUSTOMER_PHONE/, 'order-create must validate customer phone server-side');
assert.match(orderCreate, /DELIVERY_ADDRESS_REQUIRED/, 'delivery orders must require a server-validated delivery address');
assert.match(orderCreate, /orderMetadata\.order_type == null \? "DELIVERY"/, 'unspecified order type must fail closed as delivery and require an address');
assert.match(orderCreate, /requestedBranchId && membershipBranchId === requestedBranchId/, 'branch-assigned order creators must be limited to their branch');
assert.match(catalogMigration, /coalesce\(auth\.role\(\),''\) <> 'service_role' and \(auth\.uid\(\) is null or auth\.uid\(\)<>p_customer_id\)/, 'order RPC must permit only the verified Edge service-role path or matching user JWT');
assert.match(catalogMigration, /IDEMPOTENCY_KEY_SCOPE_CONFLICT/, 'idempotency keys must not return another customer/business order');
assert.match(catalogMigration, /IDEMPOTENCY_PAYLOAD_CONFLICT/, 'idempotency keys must reject changed retry payloads');
assert.match(catalogMigration, /CATALOG_BRANCH_SCOPE_IMMUTABLE/, 'catalog item updates must not silently move an item across branch scope');
assert.match(catalogMigration, /CATALOG_BRANCH_SCOPE_MISMATCH/, 'branch-scoped price writes must match the catalog item branch');
assert.match(catalogMigration, /set search_path=public,pg_temp as \$function\$/, 'all new SECURITY DEFINER RPCs must pin a safe search_path');
assert.match(catalogMigration, /revoke all on function public\.create_order_backend[\s\S]*?from public, anon, authenticated;/i, 'order RPC must remain inaccessible to direct public/authenticated callers');
assert.match(catalogMigration, /on conflict \(tenant_id,client_idempotency_key\)[\s\S]*?do nothing/i, 'order idempotency insert must handle concurrent requests without duplicate creation');
assert.match(catalogMigration, /v_delivery:=0/, 'takeaway orders must not be charged delivery fees');
assert.match(catalogMigration, /lower\(coalesce\(ci\.metadata->>'is_available','true'\)\) <> 'false'/, 'order RPC must reject catalog items marked unavailable');
assert.doesNotMatch(restaurant, /from\('restaurant_menu_items'\)\.(insert|update)/, 'legacy menu must not write prices that the canonical order path does not consume');
assert.match(restaurant, /قائمة الطعام — الكتالوج المركزي/, 'restaurant menu must render the canonical catalog rather than legacy menu records');
assert.match(restaurant, /إدارة الأصناف والأسعار متوقفة مؤقتًا/, 'menu writes must remain disabled until the secure canonical write path is deployed');

console.log('RC450 restaurant source-state and CRM/support RBAC contract PASS');
