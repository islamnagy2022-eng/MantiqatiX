import fs from 'node:fs';

const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');
const dashboard = fs.readFileSync('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx', 'utf8');

for (const [source, pattern, label] of [
  [context, /advanceBusinessOverdueDay/, 'billing context must not expose a simulated overdue-day mutation'],
  [dashboard, /advanceBusinessOverdueDay|\+يوم تأخير|محاكاة مرور يوم/, 'production admin UI must not expose the overdue-day simulator'],
]) {
  if (pattern.test(source)) throw new Error('FAIL: ' + label);
}

const paymentStart = context.indexOf('const confirmAdminPayment = async');
const freezeStart = context.indexOf('const toggleBusinessFreeze = async');
const commissionStart = context.indexOf('const updateBusinessCommissionRate = async');
const paymentFn = paymentStart >= 0 && freezeStart > paymentStart ? context.slice(paymentStart, freezeStart) : '';
const freezeFn = freezeStart >= 0 && commissionStart > freezeStart ? context.slice(freezeStart, commissionStart) : '';

if (!paymentFn.includes('await updateBillingSetting(businessId, changes);') ||
    paymentFn.indexOf('await updateBillingSetting(businessId, changes);') > paymentFn.indexOf('setBusinesses(')) {
  throw new Error('FAIL: payment confirmation must persist successfully before local state changes.');
}
if (!freezeFn.includes('await updateBillingSetting(businessId, changes);') ||
    freezeFn.indexOf('await updateBillingSetting(businessId, changes);') > freezeFn.indexOf('setBusinesses(')) {
  throw new Error('FAIL: manual freeze state must persist successfully before local state changes.');
}

for (const [pattern, label] of [
  [/await confirmAdminPayment\(biz\.id\);/, 'admin UI waits for server confirmation before showing payment success'],
  [/await toggleBusinessFreeze\(biz\.id\);/, 'admin UI waits for server confirmation before showing freeze success'],
  [/billingActionMsg\.type === 'error'/, 'billing action failures are presented as errors, not green success notices'],
]) {
  if (!pattern.test(dashboard)) throw new Error('FAIL: ' + label);
}

if (!dashboard.includes('التنبيهات اليومية أو التجميد التلقائي مفعّلين قبل توافر مهمة خادمية موثقة')) {
  throw new Error('FAIL: billing UI must not claim automated overdue enforcement without a verified server scheduler.');
}

console.log('Production billing controls: PASS');
