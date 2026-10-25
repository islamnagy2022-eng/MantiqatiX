import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('web/app.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261025203000_digital_page_subscription_expiry_reminders.sql', 'utf8');

assert.match(app, /function subscriptionReminderPanel\(\)/, 'dashboard subscription reminder renderer must exist');
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
assert.match(migration, /new\.payment_status = 'PAID' and old\.payment_status is distinct from 'PAID'/i, 'paid timestamp must be recorded only on transition to PAID');
assert.match(migration, /new\.paid_at := coalesce\(new\.paid_at, pg_catalog\.now\(\)\)/i, 'paid timestamp must be set once and preserved on replay');
assert.match(migration, /before update of payment_status on public\.digital_page_orders/i, 'paid timestamp trigger must be installed');
assert.match(migration, /revoke all on function public\.mnty_set_digital_page_paid_at\(\) from public, anon, authenticated/i, 'trigger function must not be callable directly by browser roles');

assert.match(app, /function launchScopePanel\(\)/, 'dashboard must disclose launch-scope status');
assert.match(app, /الإعلانات الممولة[\s\S]{0,300}تحت الإنشاء/, 'deferred sponsored ads must be labeled under construction');
assert.match(app, /خدمات التسويق الرقمي SMM[\s\S]{0,300}مديول مستقل/, 'SMM must remain a separate module');
assert.match(app, /عمولات طلبات واتساب[\s\S]{0,300}تحت الإنشاء/, 'new WhatsApp commissions must remain deferred');

console.log('Subscription reminder and launch-scope source contract: PASS');
