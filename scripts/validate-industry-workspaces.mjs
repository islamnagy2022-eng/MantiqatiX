import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('web/industry-workspaces.js', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');
const index = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');
const registry = fs.readFileSync('web/sector-registry.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/industry-workspaces-ui.yml', 'utf8');
const pagesWorkflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const backendAudit = fs.readFileSync('docs/SECTOR_BACKEND_CONTRACT_RECONNAISSANCE_20261019.md', 'utf8');

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
assert.match(ui, /const esc=v=>String\(v\?\?''\)\.replace\(\/\[&<>"'\]\/g/, 'dynamic UI text must pass through an HTML-escaping function');
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
assert.match(ui, /data-mxiw-action-check=/, 'actions must remain interactive and expose the incomplete-workflow state');
assert.match(ui, /حالة الإجراء: غير مكتمل/, 'non-wired operations must expose an explicit incomplete status');
assert.match(ui, /الموديول ظاهر · التشغيل غير مكتمل/, 'visibility must not be conflated with operational readiness');
assert.match(ui, /الظهور والتسويق منفصلان عن جاهزية الشراء أو تنفيذ الخدمة/);
assert.doesNotMatch(ui, /\sdisabled(?:\s|=|>)/i, 'sector UI must not globally disable its forms and action controls');
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
assert.match(ui, /find\(x=>x\.dataset\.mxiwGroup===state\.group\)\?\.focus\(\)/, 'filter selection must preserve keyboard focus after repaint');
assert.match(ui, /prefers-reduced-motion:reduce/);
assert.match(ui, /button:focus-visible/ , 'keyboard focus indicators must be visible on interactive controls');
assert.match(ui, /window\.MNTYIndustryWorkspace=Object\.freeze/);
assert.match(ui, /الموديول ظاهر · التشغيل غير مكتمل/, 'sector workspace must show visibility separately from operational readiness');
assert.match(ui, /لا يوجد اتصال بجداول القطاع أو حفظ أو دفع أو حجز حقيقي/);
assert.match(ui, /قيود صرف الأدوية حسب القوانين والسياسات/);
assert.match(ui, /سلسلة الحيازة/);
assert.match(ui, /إخفاء بيانات الموقع بعد انتهاء الحاجة/);
assert.match(ui, /s\.code==='DIGITAL'\?'<button type="button" class="mxiw-live-link" data-mxiw-live="التسويق والإعلان">/, 'marketing sector must link to the existing RBAC-guarded marketing workspace');
assert.doesNotMatch(ui, /\bsb\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\bfetch\s*\(|invokeMntyFunction|invokeMntyApi|createClient/, 'industry UI must remain frontend-only');
assert.match(app, /window\.MNTYIndustryWorkspace\?\.supports\(current\)\)return window\.MNTYIndustryWorkspace\.render\(current\)/);
assert.match(app, /if\(name==='الموديولات القطاعية'\)name='الموديولات';/, 'sector directory alias must resolve to the existing modules route');
assert.match(app, /if\(!window\.MNTYIndustryWorkspace\?\.supports\(current\)\)await loadDomainModule\(current\)/);
assert.match(app, /if\(name!=='ملف نشاطي'&&\(industryRoute\|\|rbacKnown\)\)/, 'industry routes must always enter RBAC checks, including unknown roles');
assert.match(app, /window\.MNTY_RBAC\?\.can\(role,'الموديولات','view',live\.permissions\)===true/, 'sector routes require explicit module-view permission');
assert.match(app, /window\.MNTYIndustryWorkspace\?\.renderHub\?\.\(\)/);
assert.match(app, /window\.MNTYIndustryWorkspace\?\.bind\)setTimeout\(window\.MNTYIndustryWorkspace\.bind,0\)/, 'sector UI event handlers must bind after the app root is rendered');
assert.match(ui, /root\.innerHTML=render\(name\);bind\(\)/, 'switching sector tabs must rebind handlers after repaint');
assert.match(ui, /root\.querySelector\('\[data-mxiw-search\]'\)\?\.addEventListener\('input'/, 'sector search must remain interactive after filtering');
assert.match(index, /industry-workspaces\.js\?v=ui20261019/);
assert.ok(index.indexOf('industry-workspaces.js?v=ui20261019') < index.indexOf('app.js?v=industry-ui-20261019'), 'industry workspace must load before app boot can render authenticated routes');
assert.match(sw, /const CACHE='mnty-web-v130'/);
assert.match(sw, /\.\/industry-workspaces\.js\?v=ui20261019/);
assert.match(workflow, /scripts\/test-industry-workspaces-runtime\.mjs/, 'dedicated CI must execute runtime tests');
assert.match(workflow, /web\/sector-registry\.js/, 'registry changes must trigger the dedicated contract workflow');
assert.match(pagesWorkflow, /node scripts\/test-industry-workspaces-runtime\.mjs/, 'release validation must run sector runtime tests');
assert.match(pagesWorkflow, /^permissions:\n  contents: read\n/m, 'Pages workflow default permissions must remain read-only');
assert.doesNotMatch(pagesWorkflow.slice(0, pagesWorkflow.indexOf('jobs:')), /pages:\s*write|id-token:\s*write/, 'Pages deployment permissions must not be granted workflow-wide');
const deployBlock = pagesWorkflow.match(/\n  deploy:\n([\s\S]*?)(?=\n  [a-zA-Z0-9_-]+:\n|$)/)?.[1] || '';
assert.match(deployBlock, /if: github\.ref == 'refs\/heads\/main' && \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\)/, 'Pages deployment must be restricted to explicit main-branch events');
assert.match(deployBlock, /permissions:\n      contents: read\n      pages: write\n      id-token: write/, 'Pages deployment permissions must be scoped to the deploy job');
assert.equal((workflow.match(/\.github\/workflows\/pages\.yml/g) || []).length, 2, 'Pages workflow changes must trigger the industry security contract on push and pull request');
assert.equal((workflow.match(/docs\/SECTOR_BACKEND_CONTRACT_RECONNAISSANCE_20261019\.md/g) || []).length, 2, 'sector backend audit changes must trigger the contract workflow on push and pull request');
assert.match(backendAudit, /No production rows, DDL, grants, RLS, Auth settings, Edge Functions, or migrations were changed/);
assert.ok(app.includes("Number(a.date_time)<=Date.now()"), 'NO_SHOW action must not appear before the scheduled appointment time');
assert.ok(app.includes("NO_SHOW"), 'medical provider workspace must expose the authoritative NO_SHOW status');
assert.ok(app.includes('لم يحضر'), 'medical provider workspace must label the no-show action in Arabic');
assert.match(backendAudit, /medical_appointments/);
assert.match(backendAudit, /fashion_products_select/);
assert.match(backendAudit, /PostgreSQL permissive policies combine with OR, while restrictive policies combine with AND/);
assert.match(backendAudit, /`legacy_scope_boundary` is explicitly RESTRICTIVE/);
assert.match(backendAudit, /the earlier statement that this boundary did not narrow reads was incorrect/);
assert.match(backendAudit, /BLOCKED/);


console.log('Industry workspace frontend contract: PASS');
console.log('27 unique sectors aligned with the canonical registry; frontend-only boundary; RBAC-preserving routing; PWA loading/cache: PASS');
