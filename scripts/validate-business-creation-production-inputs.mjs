import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const dashboard = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
const appContext = read('apps/catalog-frontend/src/context/AppContext.tsx');
const production = read('apps/catalog-frontend/src/lib/production.ts');
const platformAdmin = read('supabase/functions/catalog-platform-admin/index.ts');
const directory = read('apps/catalog-frontend/src/components/DirectoryView.tsx');
const storefront = read('apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx');
const placeholder = read('apps/catalog-frontend/public/business-placeholder.svg');

const addStart = dashboard.indexOf('const handleAddBusiness = async');
const addEnd = dashboard.indexOf('const handleCreateCategory =', addStart);
if (addStart < 0 || addEnd <= addStart) {
  throw new Error('Business-creation handler is missing or its boundaries changed.');
}
const addHandler = dashboard.slice(addStart, addEnd);

for (const [pattern, label] of [
  [/\+201000000000/, 'a test phone number must not be used as business contact data'],
  [/نشاط تجاري معتمد مسجل في منصة MantiqatiX/, 'businesses must not be given a fabricated approved-status description'],
  [/photo-1544816155|photo-1501339847302/, 'business creation must not assign unrelated stock photos as the business logo or cover'],
  [/paymentStatus:\s*['"]paid['"]/, 'business creation must not create a new activity as already paid'],
  [/paymentConfirmedByAdmin:\s*true/, 'business creation must not fabricate payment confirmation'],
  [/isVerified:\s*true/, 'business creation must not fabricate verification'],
  [/newBizPaymobEnabled|newBizPaymobFeePercentage|newBizPaymobFeeFixed/, 'the catalog release must not expose non-persistent Paymob activation controls'],
]) {
  if (pattern.test(addHandler) || (label.includes('Paymob activation') && pattern.test(dashboard))) {
    throw new Error('FAIL: ' + label);
  }
}

for (const [pattern, label] of [
  [/newBizOwnerWhatsApp\.trim\(\)/, 'persist the owner-provided WhatsApp number'],
  [/newBizGov\.trim\(\)/, 'persist the owner-provided governorate'],
  [/newBizMarkaz\.trim\(\)/, 'persist the owner-provided center/district'],
  [/newBizVillage\.trim\(\)/, 'persist the owner-provided neighborhood/village'],
  [/newBizWorkingHours\.trim\(\)/, 'persist working hours only when entered'],
  [/commissionPerOrder,/, 'submit configured commission to the server'],
  [/paymentDueDay,/, 'submit configured monthly due day to the server'],
]) {
  if (!pattern.test(addHandler)) throw new Error('FAIL: ' + label);
}

if (!/type="tel"[\s\S]{0,150}required[\s\S]{0,150}value=\{newBizOwnerWhatsApp\}/.test(dashboard)) {
  throw new Error('FAIL: WhatsApp is required for the WhatsApp-order catalog flow.');
}
if (!dashboard.includes('الدفع عبر Paymob غير مفعّل في إصدار الكتالوج الحالي')) {
  throw new Error('FAIL: the catalog release must clearly state that online payment is disabled.');
}

for (const [pattern, label] of [
  [/const hasCommissionInput = input\.commissionPerOrder/, 'validate the requested commission on the server'],
  [/INVALID_COMMISSION_PER_ORDER/, 'reject an invalid commission value'],
  [/INVALID_PAYMENT_DUE_DAY/, 'reject an invalid monthly payment due day'],
  [/paymentStatus: "pending"/, 'new businesses begin with pending payment status'],
  [/paymentConfirmedByAdmin: false/, 'new businesses are not marked as paid by the administrator'],
  [/functionalGroupId \? \{ functionalGroupId \} : \{\}/, 'persist the selected functional group in business metadata'],
]) {
  if (!pattern.test(platformAdmin)) throw new Error('FAIL: server-side business creation contract: ' + label);
}

if (!/const requestedFunctionalGroup = String\(meta\.functionalGroupId/.test(production) ||
    !/functionalGroupId: resolvedFunctionalGroup/.test(production)) {
  throw new Error('FAIL: the selected functional group must be restored from persisted production metadata.');
}

for (const source of [directory, storefront]) {
  if (!source.includes('business-placeholder.svg')) {
    throw new Error('FAIL: storefront and directory must use the local neutral placeholder for missing business photos.');
  }
}
if (!placeholder.includes('صورة النشاط غير متاحة')) {
  throw new Error('FAIL: neutral business placeholder asset is missing or malformed.');
}

console.log('Business creation production inputs: PASS');
