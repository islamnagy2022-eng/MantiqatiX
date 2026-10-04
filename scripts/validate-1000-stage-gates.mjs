#!/usr/bin/env node
import fs from 'node:fs';
const plan=fs.readFileSync('docs/RC1000_1000_STAGE_EXECUTION_PLAN.md','utf8');
const rows=[...plan.matchAll(/^([0-9]+)\. (.+?) — دورة ([0-9]+) —/gm)].map(m=>({n:Number(m[1]),cycle:Number(m[3])}));
const errors=[];
if(rows.length!==1000)errors.push('expected 1000 numbered stages, found '+rows.length);
rows.forEach((r,i)=>{if(r.n!==i+1)errors.push('sequence break at '+(i+1)+' => '+r.n);});
for(const p of ['docs/RC1000_1000_STAGE_EXECUTION_PLAN.md','docs/MASTER_PRODUCTION_TODO.md','docs/PROJECT_CONTINUITY.md','docs/RC339_MANTIQATI_OFFICIAL_SHOWCASE.md','docs/RC341_MANTIQATI_ACTIVITY_PROFILES.md'])if(!fs.existsSync(p))errors.push('missing '+p);
for(const [p,s] of [['web/index.html','MantiqatiX'],['web/app.js','loadMantiqatiShowcase'],['web/app.js','openMantiqatiShowcaseProfile'],['web/home.css','mnty-showcase-profile-modal'],['web/manifest.webmanifest','MantiqatiX'],['web/sw.js','mnty']])if(!fs.readFileSync(p,'utf8').includes(s))errors.push('contract '+p+' :: '+s);
const future=rows.filter(r=>r.n>=353);
if(future.length!==648)errors.push('expected 648 stages from 353-1000, found '+future.length);
if(errors.length){console.error('RC1000 gate FAILED');errors.forEach(e=>console.error('- '+e));process.exit(1);}
console.log(JSON.stringify({gate:'RC1000-STRUCTURAL',stages_total:rows.length,stages_353_1000:future.length,cycles:[...new Set(future.map(x=>x.cycle))].length,status:'STRUCTURAL_CONTRACTS_PASS',external_evidence:'NOT_CERTIFIED'},null,2));
