#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const home = read('web/home.js');
const css = read('web/home.css');
const index = read('web/index.html');
const sw = read('web/sw.js');

const taxonomy = home.match(/^\s*\['[^']*','[^']*','[^']*','[A-Z0-9_]+\'],?\s*$/gm) || [];
const checks = [
  ['27 canonical sectors', taxonomy.length === 27],
  ['defensive sector tile renderer', home.includes('const tiles=items.map(c=>{')],
  ['safe tile defaults', home.includes("c?.[0]||'◉'") && home.includes("c?.[1]||'قطاع'") && home.includes("c?.[2]||'خدمات وأنشطة منشورة على المنصة'")],
  ['image failure cannot remove tile', home.includes('onerror="this.hidden=true"')],
  ['sector grid is final 7 columns', css.includes('#mx-category-grid.mx-categories{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))')],
  ['sector tile forced visible', css.includes('#mx-category-grid .mx-category{min-width:0;width:100%;visibility:visible;opacity:1}')],
  ['home.js cache version rc365', index.includes('home.js?v=rc365')],
  ['service worker cache version v116', sw.includes("const CACHE='mnty-web-v116'")],
];

const missing = checks.filter(([,ok]) => !ok).map(([name]) => name);
if (missing.length) {
  console.error('RC366 sector rendering contract: FAIL');
  missing.forEach(x => console.error('MISSING:', x));
  process.exit(1);
}
console.log('RC366 sector rendering contract: PASS');
console.log('27 canonical sectors + defensive renderer + final 7-column grid + cache rotation are guarded.');
