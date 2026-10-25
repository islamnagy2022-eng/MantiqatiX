import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('web/app.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261025193000_rc567_digital_page_self_service.sql', 'utf8');

assert.match(app, /function subscriptionReminderPanel\(\)/, 'dashboard subscription reminder renderer must exist');
assert.ok(app.indexOf('if(live.flags.digitalPageSubscriptionDataUnavailable)') < app.indexOf('if(!paid.length)return'), 'data retrieval errors must not be hidden as an empty reminder list');
assert.match(app, /digital_page_orders['"]\)\.select\([^\n]*paid_at/, 'dashboard must read the recorded paid_at timestamp');
assert.match(app, /digital_page_products['"]\)\.select\([^\n]*duration_days/, 'dashboard must read subscription duration');
assert.match(app, /daysLeft>30/, 'reminders must be limited to the 30-day window');
assert.match(app, /daysLeft<=7/, 'near-expiry subscriptions must be marked urgent');
assert.match(app, /daysLeft<0/, 'expired subscriptions must be identified');
assert.match(app, /تاريخ الانتهاء غير محدد في البيانات الحالية/, 'missing dates must not be silently presented as healthy');
assert.match(app, /case'الرئيسية':return subscriptionReminderPanel\(\)/, 'home dashboard must include subscription reminders');
assert.match(app, /case'الإشعارات':return subscriptionReminderPanel\(\)/, 'notification center must include subscription reminders');
assert.match(app, /target="_blank" rel="noopener noreferrer"/, 'WhatsApp support link must use safe new-tab attributes');

assert.match(migration, /add column if not exists paid_at timestamptz/i, 'activation timestamp column must exist');
assert.match(migration, /create or replace function public\.digital_page_orders_paid_at_guard\(\)/i, 'paid timestamp must use the canonical immutable guard');
assert.match(migration, /new\.paid_at := pg_catalog\.now\(\)/i, 'paid timestamp must be recorded at the paid transition');
assert.match(migration, /digital_page_orders_paid_at_guard/i, 'paid timestamp guard trigger must be installed');
assert.match(migration, /where o\.payment_status='PAID' and o\.paid_at is null/i, 'legacy paid orders must receive a conservative backfill');

assert.match(app, /function genericPage\(title,desc,items\)/, 'generic dashboard routes must identify placeholder workspaces');
assert.match(app, /الوظائف غير المكتملة تحت الإنشاء/, 'generic dashboard must visibly label unfinished functionality');
assert.match(app, /طبقة البيانات — تحت الإنشاء/, 'generic data sections must not claim readiness');
assert.match(app, /function launchScopePanel\(\)/, 'dashboard must disclose launch-scope status');
assert.match(app, /الإعلانات الممولة[\s\S]{0,300}تحت الإنشاء/, 'deferred sponsored ads must be labeled under construction');
assert.match(app, /خدمات التسويق الرقمي SMM[\s\S]{0,300}مديول مستقل/, 'SMM must remain a separate module');
assert.match(app, /عمولات طلبات واتساب[\s\S]{0,300}تحت الإنشاء/, 'new WhatsApp commissions must remain deferred');

console.log('Subscription reminder and launch-scope source contract: PASS');
