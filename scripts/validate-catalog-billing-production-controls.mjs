import fs from 'node:fs';

const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');
const dashboard = fs.readFileSync('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx', 'utf8');

for (const [source, pattern, label] of [
  [context, /advanceBusinessOverdueDay/, 'billing context must not expose a simulated overdue-day mutation'],
  [dashboard, /advanceBusinessOverdueDay|\+يوم تأخير|محاكاة مرور يوم/, 'production admin UI must not expose the overdue-day simulator'],
]) {
  if (pattern.test(source)) throw new Error('FAIL: ' + label);
}

for (const [pattern, label] of [
  [/await updateBillingSetting\(businessId, changes\);\s*setBusinesses\(/, 'payment confirmation updates local state only after server persistence'],
  [/await updateBillingSetting\(businessId, changes\);\s*setBusinesses\(/, 'manual freeze state updates only after server persistence'],
  [/await confirmAdminPayment\(biz\.id\);/, 'admin UI waits for server confirmation before showing payment success'],
  [/await toggleBusinessFreeze\(biz\.id\);/, 'admin UI waits for server confirmation before showing freeze success'],
  [/billingActionMsg\.type === 'error'/, 'billing action failures are presented as errors, not green success notices'],
]) {
  if (!pattern.test(context + '\n' + dashboard)) throw new Error('FAIL: ' + label);
}

if (!dashboard.includes('التنبيهات اليومية أو التجميد التلقائي مفعّلين قبل توافر مهمة خادمية موثقة')) {
  throw new Error('FAIL: billing UI must not claim automated overdue enforcement without a verified server scheduler.');
}

console.log('Production billing controls: PASS');
