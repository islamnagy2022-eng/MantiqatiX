import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('web/industry-workspaces.js', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

const codes = [...ui.matchAll(/\{code:'([A-Z_]+)'/g)].map(x => x[1]);
const expected = [
  'FOOD','HEALTH','PHARMACY','LABS','RADIOLOGY','DENTAL','HOSPITAL','MEDICAL',
  'REAL_ESTATE','AUTO','MAINTENANCE','ACCOUNTING','LEGAL','COMPANIES','EDU',
  'DIGITAL','TECH','FITNESS','TRAVEL','MANTIGO','JOBS','MATRIMONY','USED_ITEMS',
  'FASHION','GROCERY','VETERINARY','FREELANCER'
];
assert.equal(codes.length, 27, 'exactly 27 sector workspaces must be defined');
assert.equal(new Set(codes).size, 27, 'sector codes must be unique');
assert.deepEqual([...codes].sort(), [...expected].sort(), 'all canonical sectors must have a workspace');
assert.match(ui, /const common=\{/);
assert.match(ui, /function hubHtml\(\)/);
assert.match(ui, /function detailHtml\(s\)/);
assert.match(ui, /data-mxiw-search/);
assert.match(ui, /data-mxiw-group/);
assert.match(ui, /data-mxiw-tab/);
assert.match(ui, /window\.MNTYIndustryWorkspace=Object\.freeze/);
assert.match(ui, /واجهة فقط · Backend غير موصول/);
assert.match(ui, /لا يوجد اتصال بجداول القطاع أو حفظ أو دفع أو حجز حقيقي/);
assert.match(ui, /الخصوصية والامتثال الدوائي/);
assert.match(ui, /سلسلة الحيازة/);
assert.match(ui, /إخفاء بيانات الموقع بعد انتهاء الحاجة/);
assert.doesNotMatch(ui, /\bsb\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\bfetch\s*\(|invokeMntyFunction|invokeMntyApi|createClient/, 'industry UI must remain frontend-only');
assert.match(app, /window\.MNTYIndustryWorkspace\?\.supports\(current\)\)return window\.MNTYIndustryWorkspace\.render\(current\)/);
assert.match(app, /if\(!window\.MNTYIndustryWorkspace\?\.supports\(current\)\)await loadDomainModule\(current\)/);
assert.match(app, /window\.MNTY_RBAC\.can\(role,'الموديولات','view',live\.permissions\)/);
assert.match(app, /window\.MNTYIndustryWorkspace\?\.renderHub\?\.\(\)/);
assert.match(index, /industry-workspaces\.js\?v=ui20261019/);
assert.match(sw, /const CACHE='mnty-web-v130'/);
assert.match(sw, /\.\/industry-workspaces\.js\?v=ui20261019/);
console.log('Industry workspace frontend contract: PASS');
console.log('27 unique sectors; frontend-only boundary; RBAC-preserving routing; PWA loading/cache: PASS');
