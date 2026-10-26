import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('web/digital-page-self-service.js', 'utf8');
const html = fs.readFileSync('web/digital-page-self-service.html', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261025210000_rc569_digital_page_menu_subscription_guard.sql', 'utf8');
const createOrder = fs.readFileSync('supabase/functions/digital-page-order-create/index.ts', 'utf8');

assert.match(ui, /loadOwnedBusinesses\(\)/, 'menu subscriptions must be restricted to businesses owned by the signed-in user');
assert.match(ui, /role', \['OWNER','BUSINESS_OWNER','ADMIN','MANAGER'\]/, 'business membership query must be role-scoped');
assert.match(ui, /p\.page_type === 'MENU' && businesses\.length > 0/, 'menu packages are shown only when a business context exists');
assert.match(ui, /targetBusinessId: targetBusinessId \|\| undefined/, 'menu order must carry the selected business ID');
assert.match(ui, /pageType: product\.page_type/, 'order type must match the selected package type');
assert.match(ui, /owner_user_id: selectedOrder\.page_type === 'MENU' \? null : user\.id/, 'menu pages must use business ownership, not personal ownership');
assert.match(ui, /business_id: selectedOrder\.page_type === 'MENU' \? selectedOrder\.target_business_id : null/, 'menu page must bind to the order business');
assert.match(ui, /\.in\('business_id', businesses\.map\(b => b\.id\)\)/, 'dashboard may list only pages for businesses the user manages');
assert.match(createOrder, /if\(pageType==="MENU"&&!targetBusinessId\)/, 'server must require business ID for menu subscription');
assert.match(createOrder, /eq\("business_id",targetBusinessId\)/, 'server must validate the requester membership for the selected business');
assert.match(migration, /create or replace function public\.digital_page_business_menu_insert_guard\(\)/, 'menu page insertion guard must exist');
assert.match(migration, /v_order\.target_business_id is distinct from new\.business_id/, 'order and page business IDs must match');
assert.match(migration, /v_order\.payment_status <> 'PAID'/, 'unpaid menu orders must not create pages');
assert.match(migration, /digital_page_subscription_active\(v_order\.id, v_actor\)/, 'subscription expiry must be enforced by the database');
assert.match(migration, /for update/, 'order lock must serialize duplicate menu-page creation attempts');
assert.match(migration, /DIGITAL_PAGE_ORDER_ALREADY_USED/, 'one subscription order cannot be reused for multiple pages');
assert.match(html, /منيو|قائمة/, 'self-service page UI must explain menu support');

console.log('Digital-page MENU subscription boundary: PASS (static contract; authenticated RLS/E2E remains required).');
