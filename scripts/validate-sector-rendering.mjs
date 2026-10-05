#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const home = read('web/home.js');
const registry = read('web/sector-registry.js');
const css = read('web/home.css');
const index = read('web/index.html');
const app = read('web/app.js');
const sw = read('web/sw.js');

const taxonomy = home.match(/^\s*\['[^']*','[^']*','[^']*','[A-Z0-9_]+\'],?\s*$/gm) || [];
const checks = [
  ['27 canonical sectors', taxonomy.length === 27],
  ['canonical registry exists', registry.includes('CANONICAL_SECTORS') && registry.includes('PUBLIC_TO_BACKEND_SECTOR')],
  ['registry has 27 codes', (registry.match(/\['[A-Z0-9_]+','[^']*','[A-Z0-9_]+\']/g)||[]).length === 27],
  ['registry covers medical + freelancer', registry.includes("['MEDICAL','مراكز طبية','MEDICAL']") && registry.includes("['FREELANCER','المستقلون ومقدمو الخدمات','FREELANCER']")],
  ['defensive sector tile renderer', home.includes('const tiles=items.map(c=>{')],
  ['safe tile defaults', home.includes("c?.[0]||'◉'") && home.includes("c?.[1]||'قطاع'") && home.includes("c?.[2]||'استكشف الأنشطة والخدمات'")],
  ['public/backend taxonomy aliases', home.includes("EDU:'EDUCATION'") && home.includes("DIGITAL:'MARKETING'") && home.includes("FITNESS:'SPORTS'") && home.includes("TRAVEL:'TRIPS'") && home.includes("TECH:'ERP'")],
  ['medical + freelancer remain public canonical sectors', home.includes("'MEDICAL'") && home.includes("'FREELANCER'")],
  ['image failure cannot remove tile', home.includes('onerror="this.hidden=true"')],
  ['sector grid is final 7 columns', css.includes('#mx-category-grid.mx-categories{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))')],
  ['sector tile forced visible', css.includes('#mx-category-grid .mx-category{min-width:0;width:100%;visibility:visible;opacity:1}')],
  ['home.js cache version rc371', index.includes('home.js?v=rc371')],
  ['mobile header hides desktop add activity control', css.includes('.mx-nav .mx-add,.mx-header__inner>.mx-add{display:none!important}')],
  ['mobile header has dedicated grid areas', css.includes('grid-template-areas:') && css.includes('"brand login cart menu"')],
  ['live sector counts are supported', home.includes('PUBLIC_DIRECTORY_COUNTS') && home.includes("select('category_code')") && home.includes("select('provider_kind')")],
  ['sector live metadata is rendered', home.includes('mx-category__live')],
  ['static sector tiles exist before live catalog', home.includes('const initialCategoryTiles=TAXONOMY.map') && home.includes('id="mx-category-grid">')],
  ['sector exploration CTA is rendered', home.includes('mx-category__cta')],
  ['app consumes canonical sector registry', app.includes('window.MX_SECTOR_REGISTRY?.CANONICAL_SECTORS') && app.includes('const SECTOR_PRESENTATION=')],
  ['app sectors carry canonical code + backend code', app.includes("return [p[0],p[1],p[2],s.code,s.backend];")],
  ['unsupported sectors do not claim an unrelated workspace', app.includes("return map[name]||'المجالات والخدمات';") && app.includes("const operational=Boolean(sectorMap[s[1]]);")],
  ['service worker cache version v117', sw.includes("const CACHE='mnty-web-v117'")],
];

const missing = checks.filter(([,ok]) => !ok).map(([name]) => name);
if (missing.length) {
  console.error('RC366 sector rendering contract: FAIL');
  missing.forEach(x => console.error('MISSING:', x));
  process.exit(1);
}
console.log('RC367 sector rendering contract: PASS');
console.log('27 canonical sectors + defensive renderer + final 7-column grid + cache rotation are guarded.');
