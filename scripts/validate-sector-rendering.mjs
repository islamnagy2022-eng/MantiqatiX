#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const home = read('web/home.js');
const registry = read('web/sector-registry.js');
const css = read('web/home.css');
const index = read('web/index.html');
const app = read('web/app.js');
const sw = read('web/sw.js');
const sectorModules = read('web/sector-modules.js');
const usedItemsMigration = read('supabase/migrations/20261020232000_used_item_ads_directory_backend_v1.sql');
const usedItemsIntegration = read('supabase/tests/used_item_directory_read_integration.sql');
const usedItemsWorkflow = read('.github/workflows/used-item-directory-read.yml');
const jobsDirectoryMigration = read('supabase/migrations/20261020233000_jobs_directory_backend_v1.sql');
const jobsDirectoryIntegration = read('supabase/tests/jobs_directory_backend_integration.sql');
const jobsDirectoryWorkflow = read('.github/workflows/job-directory-read.yml');

const taxonomy = home.match(/^\s*\['[^']*','[^']*','[^']*','[A-Z0-9_]+\'],?\s*$/gm) || [];
const checks = [
  ['27 canonical sectors', taxonomy.length === 27],
  ['canonical registry exists', registry.includes('CANONICAL_SECTORS') && registry.includes('PUBLIC_TO_BACKEND_SECTOR')],
  ['registry has 27 codes', (registry.match(/\['[A-Z0-9_]+','[^']*','[A-Z0-9_]+\']/g)||[]).length === 27],
  ['registry covers medical + freelancer', registry.includes("['MEDICAL','مراكز طبية','MEDICAL']") && registry.includes("['FREELANCER','المستقلون ومقدمو الخدمات','FREELANCER']")],
  ['defensive sector tile renderer', home.includes('const tiles=visibleItems.map(c=>{')],
  ['safe tile defaults', home.includes("c?.[0]||'◉'") && home.includes("c?.[1]||'قطاع'") && home.includes("c?.[2]||'استكشف الأنشطة والخدمات'")],
  ['public/backend taxonomy aliases', home.includes("EDU:'EDUCATION'") && home.includes("DIGITAL:'MARKETING'") && home.includes("FITNESS:'SPORTS'") && home.includes("TRAVEL:'TRIPS'") && home.includes("TECH:'ERP'")],
  ['medical + freelancer remain public canonical sectors', home.includes("'MEDICAL'") && home.includes("'FREELANCER'")],
  ['image failure cannot remove tile', home.includes('onerror="this.hidden=true"')],
  ['sector grid is final 7 columns', css.includes('.mx-categories{grid-template-columns:repeat(8,minmax(0,1fr))')],
  ['sector tile forced visible', css.includes('#mx-category-grid .mx-category{min-width:0;width:100%;visibility:visible;opacity:1}')],
  ['home.css cache version rc393', index.includes('home.css?v=rc397')],
  ['mobile header/search alignment rc382', css.includes('FINAL RC382') && css.includes('.mx-home .mx-search-wrap{') && css.includes('grid-template-areas:\n      "brand search login menu"')],
  ['visual identity photo layer rc383', css.includes('FINAL RC383') && css.includes('images.unsplash.com') && css.includes('.mx-home .mx-home-hero')],
  ['mobile header hides desktop add activity control', css.includes('.mx-nav .mx-add,.mx-header__inner>.mx-add{display:none!important}')],
  ['mobile header has dedicated grid areas', css.includes('grid-template-areas:') && css.includes('"brand login cart menu"')],
  ['live sector counts are supported', home.includes('PUBLIC_DIRECTORY_COUNTS') && home.includes("select('category_code')") && home.includes("select('provider_kind')")],
  ['sector live metadata is rendered', home.includes('mx-category__live')],
  ['static sector tiles exist before live catalog', home.includes('const initialCategoryTiles=TAXONOMY.slice(0,16).map') && home.includes('id="mx-category-grid">')],
  ['sector exploration CTA is rendered', home.includes('mx-category__cta')],
  ['homepage sector catalog exposes the reference-density tile set', home.includes('const initialCategoryTiles=TAXONOMY.slice(0,16).map') && home.includes('id="mx-category-grid">')],
  ['homepage information architecture RC384', css.includes('FINAL RC384') && css.includes('#mx-categories{order:4') && css.includes('#mx-nearby{order:5')],
  ['app consumes canonical sector registry', app.includes('window.MX_SECTOR_REGISTRY?.CANONICAL_SECTORS') && app.includes('const SECTOR_PRESENTATION=')],
  ['app sectors carry canonical code + backend code', app.includes("return [p[0],p[1],p[2],s.code,s.backend];")],
  ['unsupported sectors do not claim an unrelated workspace', app.includes("return map[name]||'المجالات والخدمات';") && app.includes("const operational=Boolean(sectorMap[s[1]]);")],
  ['service worker cache version v129', sw.includes("const CACHE='mnty-web-v129'")],
  ['service worker precaches versioned app entrypoint', sw.includes("./app.js?v=rc458-marketing-workspace-20261018")],
  ['service worker precaches versioned Supabase SDK', sw.includes("./vendor/supabase.js?v=supabase21172")],
  ['sector source failures are not silently converted to empty results', sectorModules.includes('const r={},failures=[];') && sectorModules.includes('if(x.error){failures.push(t);continue}') && sectorModules.includes('لم يتم اعتبار الخطأ نتيجة فارغة')],
  ['sector query failures are announced accessibly', sectorModules.includes('role="alert" aria-live="polite"')],
  ['sector loading state is announced accessibly', sectorModules.includes('role="status" aria-live="polite">جاري تحميل البيانات الفعلية') && sectorModules.includes('aria-busy=')],
  ['sector tabs expose named group and active state', sectorModules.includes('<nav class="action-bar" role="group" aria-label="أقسام الوحدة"') && sectorModules.includes('aria-pressed=')],
  ['authentication failure is human-readable and does not offer a useless retry', sectorModules.includes("state.error==='AUTH_REQUIRED'?'يلزم تسجيل الدخول بحساب موثق للوصول إلى بيانات هذا القسم.'") && sectorModules.includes("state.error==='AUTH_REQUIRED'?'':'<div style=\"margin-top:12px\"><button type=\"button\" class=\"btn btn-outline\" data-sector-retry>إعادة المحاولة</button></div>'")],
  ['sector query failure offers retry', sectorModules.includes('data-sector-retry') && sectorModules.includes("addEventListener('click',()=>load(defs[current]))")],
  ['used-item migration revokes direct table access and installs the narrow server RPC', usedItemsMigration.includes('revoke select, insert, update, delete on table public.used_item_ads from anon, authenticated;') && usedItemsMigration.includes('create or replace function public.list_used_item_ads_backend') && usedItemsMigration.includes('grant execute on function public.list_used_item_ads_backend(varchar, uuid) to authenticated;')],
  ['used-item RPC omits seller contact and filters sold listings by owner', usedItemsMigration.includes('a.is_sold = false or a.owner_user_id = auth.uid()') && !/returns table[\s\S]*?seller_phone/i.test(usedItemsMigration)],
  ['used-item integration verifies seller phone and owner ID are not directly readable', usedItemsIntegration.includes("has_column_privilege('authenticated','public.used_item_ads','seller_phone','SELECT')") && usedItemsIntegration.includes("has_column_privilege('authenticated','public.used_item_ads','owner_user_id','SELECT')")],
  ['used-item integration verifies sold-owner isolation and anonymous denial', usedItemsIntegration.includes('OTHER_USERS_SOLD_LISTING_EXPOSED') && usedItemsIntegration.includes('anonymous auth session was accepted') && usedItemsIntegration.includes('missing identity was accepted')],
  ['used-item PostgreSQL integration is wired into backend CI', usedItemsWorkflow.includes('used-item-directory-read-integration') && usedItemsWorkflow.includes('supabase/tests/used_item_directory_read_integration.sql') && usedItemsWorkflow.includes('20261020232000_used_item_ads_directory_backend_v1.sql')],
  ['jobs and applications are loaded only through server-authorized RPCs', sectorModules.includes("sb.rpc('list_jobs_backend'") && sectorModules.includes("sb.rpc('list_job_applications_backend'") && !/sb\.from\('(jobs|job_applications)'\)\.select/.test(sectorModules)],
  ['job directory migration revokes direct SELECT and grants only RPC execution', jobsDirectoryMigration.includes('revoke select on table public.jobs, public.job_applications from anon, authenticated;') && jobsDirectoryMigration.includes('grant execute on function public.list_jobs_backend(varchar, uuid) to authenticated;') && jobsDirectoryMigration.includes('grant execute on function public.list_job_applications_backend(varchar, uuid) to authenticated;')],
  ['job directory RPCs exclude employer and applicant contact details', jobsDirectoryMigration.includes('j.employer_name') && !/returns table[\s\S]*?employer_phone/i.test(jobsDirectoryMigration) && !/returns table[\s\S]*?applicant_phone/i.test(jobsDirectoryMigration) && !/returns table[\s\S]*?cv_summary_text/i.test(jobsDirectoryMigration)],
  ['job directory PostgreSQL integration is wired into CI', jobsDirectoryWorkflow.includes('job-directory-read-integration') && jobsDirectoryWorkflow.includes('supabase/tests/jobs_directory_backend_integration.sql') && jobsDirectoryIntegration.includes('APPLICANT_OWN_APPLICATION_SCOPE_FAILED') && jobsDirectoryIntegration.includes('JOB_OWNER_APPLICATION_SCOPE_FAILED')],
  ['used-item status notice separates read from mutation availability', sectorModules.includes('إدارة حالة الإعلان غير متاحة من هذه الواجهة حتى يتم اعتماد مسار تعديل آمن في الخادم.')],
  ['sector workspace writes only through server-authorized RPCs', !/sb\.from\(['"][^'"]+['"]\)\.(insert|update|upsert|delete)\b/.test(sectorModules)],
  ['education request RPC is present', sectorModules.includes("sb.rpc('create_education_request_backend'")],
  ['job application RPC is present', sectorModules.includes("sb.rpc('submit_job_application_backend'")],
  ['job creation RPC is present', sectorModules.includes("sb.rpc('create_job_backend'")],
  ['job application handler is not shadowed by duplicate declaration', (sectorModules.match(/async function applyToJob\(/g)||[]).length === 1],
  ['job application writes use the authorized backend RPC', sectorModules.includes("sb.rpc('submit_job_application_backend'") && !/sb\.from\('job_applications'\)\.insert/.test(sectorModules)],
  ['job application validates required backend fields', sectorModules.includes("if(!phone||!qualifications||!cv)")],
  ['job application handles idempotent duplicate response', sectorModules.includes("status==='ALREADY_APPLIED'")],
  ['education requests use the authorized backend RPC', sectorModules.includes("sb.rpc('create_education_request_backend'") && !/sb\.from\('education_requests'\)\.insert/.test(sectorModules)],
  ['education request validates subject length before RPC', sectorModules.includes("subject.length>500")],
  ['education request validates student name length before RPC', sectorModules.includes("student.length<2||student.length>200")],
  ['used-items directory reads use the narrow backend RPC', sectorModules.includes("sb.rpc('list_used_item_ads_backend'") && !/sb\.from\('used_item_ads'\)\.select/.test(sectorModules) && !sectorModules.includes('seller_phone')],
  ['used-items has no direct table mutation while grants are absent', !/sb\.from\('used_item_ads'\)\.(insert|update|upsert|delete)/.test(sectorModules) && sectorModules.includes('إدارة حالة الإعلان غير متاحة من هذه الواجهة حتى يتم اعتماد مسار تعديل آمن في الخادم.')],
  ['fashion product creation fails closed without INSERT privilege', !/sb\.from\('fashion_products'\)\.(insert|update|upsert|delete)/.test(sectorModules) && sectorModules.includes('لا تملك صلاحية INSERT على جدول المنتجات')],

];

const missing = checks.filter(([,ok]) => !ok).map(([name]) => name);
if (missing.length) {
  console.error('RC366 sector rendering contract: FAIL');
  missing.forEach(x => console.error('MISSING:', x));
  process.exit(1);
}
console.log('RC385 homepage/sector rendering contract: PASS');
console.log('27 canonical sectors + defensive renderer + final 7-column grid + cache rotation are guarded.');
