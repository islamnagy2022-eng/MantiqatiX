import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const dashboard = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const platformAdmin = read('supabase/functions/catalog-platform-admin/index.ts');

for (const [pattern, label] of [
  [/adminPassInput/, 'the non-functional legacy admin password control must not return'],
  [/كلمة مرور لوحة الإدارة العامة/, 'settings must not claim a traditional admin password exists'],
  [/adminPassword:\s*adminPassInput/, 'the browser must not submit the obsolete password setting'],
]) {
  if (pattern.test(dashboard)) throw new Error('FAIL: ' + label);
}

if (!dashboard.includes('تسجيل دخول مالك المنصة يتم عبر Google')) {
  throw new Error('FAIL: platform settings must describe the actual Google sign-in mechanism.');
}
if (!/await updateAdminSettings\(\{[\s\S]*?adminWhatsApp:\s*adminPhone[\s\S]*?defaultCommissionPerOrder:\s*commission/.test(dashboard)) {
  throw new Error('FAIL: the settings form must await persistence of the actual editable settings.');
}
if (!dashboard.includes('أكد الخادم حفظ إعدادات المنصة في قاعدة الإنتاج.') ||
    !dashboard.includes('تعذر حفظ الإعدادات لدى الخادم؛ لم يتم اعتماد التغيير.')) {
  throw new Error('FAIL: the UI must distinguish server-confirmed success from a failed save.');
}
if (!/const updateAdminSettings = async[\s\S]*?await callPlatformAdmin\(\{ action: 'SAVE_SETTINGS', settings: safe \}\)[\s\S]*?if \(result\?\.success !== true\)[\s\S]*?setAdminSettings\(/.test(context)) {
  throw new Error('FAIL: local admin settings must only update after a successful server response.');
}
if (!/INVALID_ADMIN_WHATSAPP/.test(platformAdmin) ||
    !/INVALID_DEFAULT_COMMISSION/.test(platformAdmin)) {
  throw new Error('FAIL: the Edge Function must validate admin WhatsApp and default commission values.');
}
if (!/const merged = \{ \.\.\.current, \.\.\.safe \}/.test(platformAdmin) ||
    !/settings: merged/.test(platformAdmin)) {
  throw new Error('FAIL: partial settings saves must preserve existing platform settings.');
}


if (!dashboard.includes(String.raw`adminPhone.replace(/\D/g, '')`) ||
    dashboard.includes(String.raw`adminPhone.replace(/\\D/g, '')`)) {
  throw new Error('FAIL: the browser must strip all non-digit characters from the WhatsApp number before checking its length.');
}
if (!platformAdmin.includes(String.raw`adminWhatsApp.replace(/\D/g, "")`) ||
    platformAdmin.includes(String.raw`adminWhatsApp.replace(/\\D/g, "")`)) {
  throw new Error('FAIL: the Edge Function must normalize phone digits correctly.');
}

console.log('Platform settings persistence and Google-only authentication copy: PASS');
