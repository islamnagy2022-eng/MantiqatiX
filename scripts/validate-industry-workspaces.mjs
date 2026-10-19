import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('web/industry-workspaces.js', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');
const registry = fs.readFileSync('web/sector-registry.js', 'utf8');

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
const registryEntries = [...registry.matchAll(/\['([A-Z_]+)','[^']*','([A-Z_]+)'\]/g)];
const registryCodes = registryEntries.map(x => x[1]);
const backendCodes = registryEntries.map(x => x[2]);
assert.equal(registryEntries.length, 27, 'canonical sector registry must define exactly 27 mappings');
assert.deepEqual([...codes].sort(), [...registryCodes].sort(), 'UI workspaces must match the canonical sector registry exactly');
assert.ok(backendCodes.every(Boolean), 'every public sector must map to a backend sector identifier');
assert.equal(new Set(registryCodes).size, 27, 'canonical registry sector codes must be unique');
assert.match(ui, /const common=\{/);
const tabKeys = [...new Set([...ui.matchAll(/tabs:\[([^\]]+)\]/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])))];
const commonBlock = ui.match(/const common=\{([\s\S]*?)\n\};/)?.[1] || '';
const screenLayoutsBlock = ui.match(/const screenLayouts=\{([\s\S]*?)\n\};/)?.[1] || '';
const screenKeys = new Set([
  ...[...commonBlock.matchAll(/^\s*([a-zA-Z]+):\{/gm)].map(x => x[1]),
  ...[...screenLayoutsBlock.matchAll(/^\s*([a-zA-Z]+):\{/gm)].map(x => x[1])
]);
assert.ok(tabKeys.length > 0, 'sector tabs must be declared');
assert.ok(tabKeys.every(key => screenKeys.has(key)), 'every sector tab must resolve to a shared content or screen-layout definition');
assert.match(ui, /function hubHtml\(\)/);
assert.match(ui, /function detailHtml\(s\)/);
assert.match(ui, /function supports\(name\)\{const route=String\(name\|\|''\);if\(route==='الموديولات القطاعية'\)return true;if\(!route\.startsWith\('قطاع: '\)\)return false;return Boolean\(byCode\(route\.slice\(6\)\.trim\(\)\)\)\}/, 'only canonical sector routes may be treated as sector workspaces');
assert.match(ui, /if\(state\.code!==s\.code\)state\.tab='overview'/, 'switching sectors must not carry a stale tab from another sector');
assert.match(ui, /function screenPreviewHtml\(s,key\)/);
assert.match(ui, /class="mxiw-preview-table"/);
assert.match(ui, /disabled title="سيُفعّل بعد اعتماد الربط الخلفي"/);
assert.match(ui, /class="mxiw-preview-fields"/);
assert.match(ui, /data-mxiw-search/);
assert.match(ui, /data-mxiw-group/);
assert.match(ui, /data-mxiw-tab/);
assert.match(ui, /role="status" aria-live="polite"/, 'directory result count must be announced to assistive technology');
assert.match(ui, /aria-pressed=/, 'sector filters must expose their selected state');
assert.match(ui, /aria-controls="mxiw-panel"/, 'sector tabs must point to their panel');
assert.match(ui, /tabindex=".*active===k/, 'sector tabs must use roving tabindex');
assert.match(ui, /role="tabpanel" tabindex="0" aria-labelledby="mxiw-tab-/, 'sector content must expose a labelled tab panel');
assert.match(ui, /e\.key==='ArrowLeft'/, 'sector tabs must support keyboard arrow navigation');
assert.match(ui, /e\.key==='Home'/, 'sector tabs must support Home/End keyboard navigation');
assert.match(ui, /prefers-reduced-motion:reduce/);
assert.match(ui, /window\.MNTYIndustryWorkspace=Object\.freeze/);
assert.match(ui, /واجهة فقط · Backend غير موصول/);
assert.match(ui, /لا يوجد اتصال بجداول القطاع أو حفظ أو دفع أو حجز حقيقي/);
assert.match(ui, /قيود صرف الأدوية حسب القوانين والسياسات/);
assert.match(ui, /سلسلة الحيازة/);
assert.match(ui, /إخفاء بيانات الموقع بعد انتهاء الحاجة/);
assert.doesNotMatch(ui, /\bsb\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\bfetch\s*\(|invokeMntyFunction|invokeMntyApi|createClient/, 'industry UI must remain frontend-only');
assert.match(app, /window\.MNTYIndustryWorkspace\?\.supports\(current\)\)return window\.MNTYIndustryWorkspace\.render\(current\)/);
assert.match(app, /if\(!window\.MNTYIndustryWorkspace\?\.supports\(current\)\)await loadDomainModule\(current\)/);
assert.match(app, /if\(name!=='ملف نشاطي'&&\(industryRoute\|\|rbacKnown\)\)/, 'industry routes must always enter RBAC checks, including unknown roles');
assert.match(app, /window\.MNTY_RBAC\?\.can\(role,'الموديولات','view',live\.permissions\)===true/, 'sector routes require explicit module-view permission');
assert.match(app, /window\.MNTYIndustryWorkspace\?\.renderHub\?\.\(\)/);
assert.match(app, /window\.MNTYIndustryWorkspace\?\.bind\)setTimeout\(window\.MNTYIndustryWorkspace\.bind,0\)/, 'sector UI event handlers must bind after the app root is rendered');
assert.match(ui, /root\.innerHTML=render\(name\);bind\(\)/, 'switching sector tabs must rebind handlers after repaint');
assert.match(ui, /root\.querySelector\('\[data-mxiw-search\]'\)\?\.addEventListener\('input'/, 'sector search must remain interactive after filtering');
assert.match(index, /industry-workspaces\.js\?v=ui20261019/);
assert.match(sw, /const CACHE='mnty-web-v130'/);
assert.match(sw, /\.\/industry-workspaces\.js\?v=ui20261019/);
console.log('Industry workspace frontend contract: PASS');
console.log('27 unique sectors aligned with the canonical registry; frontend-only boundary; RBAC-preserving routing; PWA loading/cache: PASS');
