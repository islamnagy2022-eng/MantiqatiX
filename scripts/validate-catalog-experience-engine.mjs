import fs from 'node:fs';
import assert from 'node:assert/strict';

const engine = fs.readFileSync('web/catalog-experience-engine.js', 'utf8');
const digitalHtml = fs.readFileSync('web/digital-page-self-service.html', 'utf8');
const digitalJs = fs.readFileSync('web/digital-page-self-service.js', 'utf8');
const publicPageHtml = fs.readFileSync('web/digital-page.html', 'utf8');
const publicPageJs = fs.readFileSync('web/digital-page.js', 'utf8');
const marketingHtml = fs.readFileSync('web/marketing-services.html', 'utf8');
const marketingJs = fs.readFileSync('web/marketing-services.js', 'utf8');
const smmHtml = fs.readFileSync('web/smm.html', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');
const sectors = fs.readFileSync('web/sector-registry.js', 'utf8');
const sectorModules = fs.readFileSync('web/sector-modules.js', 'utf8');
const operationsModules = fs.readFileSync('web/operations-modules.js', 'utf8');

for (const code of ['FOOD','PHARMACY','HEALTH','DENTAL','MEDICAL','HOSPITAL','LABS','RADIOLOGY','COMPANIES','FREELANCER','MAINTENANCE','GROCERY','FASHION','MARKETING']) {
  assert.ok(engine.includes("'" + code + "': Object.freeze"), 'missing sector adapter profile ' + code);
}
assert.match(engine, /function escapeHtml/);
assert.match(engine, /encodeURIComponent/);
assert.match(engine, /UNDER_CONSTRUCTION: \{ label: 'تحت الإنشاء'/);
assert.match(engine, /requestMode: 'INFORMATION_ONLY'/, 'high-risk sector may use information-only rather than generic order');
assert.match(engine, /preserve: \['pharmacist-review', 'prescription-controls', 'regulated-products'\]/);
assert.match(engine, /preserve: \['departments', 'emergency-routing', 'patient-privacy', 'institutional-workflow'\]/);
assert.match(engine, /function subscriptionDisplay/);
assert.match(engine, /Never use this function to grant access or publish a page/);
assert.match(digitalHtml, /catalog-experience-engine\.js/);
assert.match(digitalJs, /loadSubscriptionReminders/);
assert.match(digitalJs, /digital_page_subscription_active/);
assert.match(digitalJs, /تعذر التحقق من مواعيد الاشتراك/);
assert.match(marketingHtml, /catalog-experience-engine\.js/);
assert.match(marketingJs, /MNTYCatalogExperience\?\.whatsappUrl/);
assert.match(index, /load\('catalog-experience-engine\.js\?v=launch-catalog-engine-2'\);\s*await load\('app\.js\?v=launch-catalog-engine-2'\);/, 'load shared engine before dashboard/module runtime');
assert.match(sw, /catalog-experience-engine\.js\?v=launch-catalog-engine-2/);
assert.match(sw, /app\.js\?v=launch-catalog-engine-2/);
assert.match(sectors, /CANONICAL_SECTORS/);
assert.match(sectorModules, /function shell\(d,body\)/);
assert.match(operationsModules, /const defs=/);
assert.match(app, /function subscriptionReminderPanel\(\)/);
assert.match(app, /case'الإشعارات':return subscriptionReminderPanel\(\)/);
assert.match(smmHtml, /smm\.js/);
assert.doesNotMatch(engine, /smm-gateway|payment-intent|paymob/i, 'shared public catalog engine must not execute SMM or payment operations');

console.log('Shared catalog engine profiles + WhatsApp helper + dashboard subscription reminder source contracts: PASS');
