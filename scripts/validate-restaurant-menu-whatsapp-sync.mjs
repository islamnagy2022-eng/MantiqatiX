import assert from 'node:assert/strict';
import fs from 'node:fs';

const restaurant = fs.readFileSync('web/restaurant-module.js', 'utf8');
const publicPage = fs.readFileSync('web/digital-page.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261025220000_rc570_restaurant_menu_whatsapp_catalog.sql', 'utf8');
const html = fs.readFileSync('web/digital-page.html', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

assert.match(migration, /add column if not exists image_url text/i, 'restaurant catalog must support optional product images');
assert.match(migration, /restaurant_menu_items_image_url_https_check/, 'product image URLs must be constrained to HTTPS');
assert.match(restaurant, /select\('id,name_ar,description_ar,base_price_egp,category,is_available,is_popular,image_url'\)/, 'restaurant editor must read canonical menu image URLs');
assert.match(restaurant, /field\('image','رابط صورة المنتج \(HTTPS\)'/, 'restaurant editor must expose the optional image field');
assert.match(restaurant, /image_url:imageUrl\|\|null/, 'restaurant editor must save image URL into canonical menu item');
assert.match(restaurant, /function syncRestaurantMenuToDigitalPage\(\)/, 'restaurant menu must have a canonical-to-public-page sync action');
assert.match(restaurant, /canOperate\('CATALOG','update'\)/, 'menu sync must use shared RBAC');
assert.match(restaurant, /eq\('business_id',s\.business_id\)\.eq\('status','PUBLISHED'\)/, 'sync must target a published menu page for the active business');
assert.match(restaurant, /digital_page_subscription_active/, 'sync must verify active subscription');
assert.match(restaurant, /filter\(x=>x\.is_available===true\)/, 'only available products may be published');
assert.match(restaurant, /branch_id:s\.branch_id/, 'sync snapshot must record the explicitly selected branch');
assert.match(restaurant, /from\('digital_page_sections'\)/, 'sync must update the existing public MENU section');
assert.match(restaurant, /rest-sync-menu-page/, 'restaurant menu screen must expose the sync action');
assert.match(restaurant, /digital-page-self-service\.html/, 'restaurant menu screen must link to menu page management');
assert.match(publicPage, /x\.category\?'<p class="chip">/, 'public menu must display product category');
assert.match(publicPage, /اطلب المنتج عبر واتساب/, 'public menu must provide WhatsApp product handoff');
assert.match(publicPage, /safeImage\(x\.image_url\)/, 'public menu must accept only safe HTTPS image URLs');
assert.match(publicPage, /الكمية المطلوبة: أرجو التواصل لتأكيد الكمية والتفاصيل/, 'WhatsApp order must ask business to confirm quantity/details');
assert.match(html, /digital-page\.js\?v=rc570/, 'public page must request the refreshed script');
assert.match(index, /restaurant-module\.js\?v=rc570/, 'main app must request the refreshed restaurant module');
assert.match(sw, /mnty-web-v137-restaurant-menu-wa/, 'PWA cache must be invalidated for menu sync release');
assert.match(sw, /restaurant-module\.js\?v=rc570/, 'PWA must precache the refreshed restaurant module');

console.log('Restaurant canonical menu → published digital MENU → WhatsApp contract: PASS (static contract only; authenticated RLS/browser E2E and production deploy remain required).');
