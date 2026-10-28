#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const backend = fs.readFileSync('supabase/functions/catalog-platform-admin/index.ts', 'utf8');
const productionMapper = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');
const types = fs.readFileSync('apps/catalog-frontend/src/types/index.ts', 'utf8');
const admin = fs.readFileSync('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx', 'utf8');

const createStart = backend.indexOf('if (action === "CREATE_SUBSCRIBER")');
const statusStart = backend.indexOf('if (action === "SUBSCRIBER_STATUS")', createStart);
const settingsStart = backend.indexOf('if (action === "BUSINESS_SETTINGS_UPDATE")', statusStart);
assert.ok(createStart >= 0 && statusStart > createStart && settingsStart > statusStart, 'Subscriber and billing action boundaries must exist');
const createBlock = backend.slice(createStart, statusStart);
const statusBlock = backend.slice(statusStart, settingsStart);
const settingsBlock = backend.slice(settingsStart);

assert.match(createBlock, /role: "BUSINESS_OWNER", status: "INACTIVE", permissions: \{ catalog: true, subscription_status: "PENDING_PAYMENT" \}/,
  'New subscriber memberships must be inactive until payment is confirmed');
assert.match(createBlock, /paymentRequired: true/,
  'New subscriber creation must tell the UI that payment is required');
assert.doesNotMatch(createBlock, /update\(\{ status: "ACTIVE" \}\)/,
  'Reusing an existing inactive membership must not auto-activate it');
assert.match(productionMapper, /status: isAccountOnly \? 'pending' : rawStatus === 'ACTIVE' \? 'active' : rawStatus === 'SUSPENDED' \? 'suspended' : 'pending'/,
  'Inactive memberships must appear as pending payment in the admin list');

assert.match(statusBlock, /if \(status === "ACTIVE"\)/,
  'Membership activation must have a server-side guard');
assert.match(statusBlock, /SUBSCRIPTION_PAYMENT_REQUIRED/,
  'Server must reject activation without confirmed payment');
assert.match(statusBlock, /isOfficialShowcase/,
  'Official platform showcase memberships must remain manageable without commercial billing');

assert.match(settingsBlock, /paymentStatus \|\| ""\)\.toLowerCase\(\) === "paid" && patch\.paymentConfirmedByAdmin === true/,
  'Payment confirmation must be explicit and admin-controlled');
assert.match(settingsBlock, /PAID_SUBSCRIPTION_ACTIVATION_FAILED/,
  'Payment confirmation must activate pending owner memberships server-side');
assert.match(settingsBlock, /contains\("permissions", \{ subscription_status: "PENDING_PAYMENT" \}\)/,
  'Only memberships explicitly marked pending payment may be activated');
assert.match(settingsBlock, /subscription_status: "ACTIVE"/,
  'Activated memberships must leave the pending-payment state');

assert.match(types, /status: 'active' \| 'pending' \| 'suspended'/,
  'Subscriber model must represent pending payment');
assert.match(context, /const confirmAdminPayment = async/,
  'Payment confirmation must be awaited');
assert.match(context, /await updateBillingSetting\(businessId, \{[\s\S]{0,180}paymentConfirmedByAdmin: true, paymentStatus: 'paid'/,
  'Client must persist confirmed payment before attempting activation');
assert.match(context, /const pending = subscribers\.filter\(\(subscriber\) => subscriber\.businessId === businessId && subscriber\.status === 'pending'\)/,
  'Client must reflect pending subscriber activation after payment confirmation');
assert.match(context, /status: backendStatus === 'ACTIVE' \? 'active' : backendStatus === 'SUSPENDED' \? 'suspended' : 'pending'/,
  'Newly assigned subscribers must remain pending by default');
assert.match(context, /paymentConfirmedByAdmin\)\)\s*\{\s*throw new Error\('لا يمكن تفعيل الاشتراك قبل تأكيد سداد/,
  'Client must not activate a subscriber without paid and confirmed business state');
assert.match(context, /لا تُفعّل صلاحيات إدارة النشاط إلا بعد تأكيد السداد/,
  'Credential instructions must disclose the payment gate');
assert.match(admin, /حالة الاشتراك/);
assert.match(admin, /بانتظار السداد/);
assert.doesNotMatch(admin, /setActiveAdminTab\('backup'\)/,
  'Unverified backup/restore UI must not be exposed in the catalog pilot');
assert.doesNotMatch(admin, /setActiveAdminTab\('control_center'\)/,
  'Unverified advanced control-center UI must not be exposed in the catalog pilot');
assert.doesNotMatch(context, /updateBusinessPaymobConfig|merchantApiKey|integrationIdCard/,
  'The production catalog context must not expose unverified Paymob credential persistence');
assert.match(admin, /لن تُحفظ مفاتيح Paymob من هذه الواجهة ولن يُفعّل التحصيل الإلكتروني/,
  'The admin UI must explicitly disclose that online collection is disabled until production verification');
assert.doesNotMatch(admin, /handleSavePaymobConfig|paymobMerchantApiKey|Integration ID|تفعيل Paymob/,
  'The admin UI must not expose a fake Paymob credential-save or activation path');

console.log('PAID_SUBSCRIPTION_ACTIVATION_GATE=PASS');
