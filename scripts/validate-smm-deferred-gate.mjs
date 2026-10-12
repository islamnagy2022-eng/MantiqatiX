#!/usr/bin/env node
import fs from 'node:fs';

const gateway=fs.readFileSync('supabase/functions/smm-gateway/index.ts','utf8');
const holding=fs.readFileSync('web/smm.html','utf8');
const home=fs.readFileSync('web/home.js','utf8');
const app=fs.readFileSync('web/app.js','utf8');

const fail=[];
const check=(condition,message)=>{if(!condition)fail.push(message)};

const options=gateway.indexOf('if(req.method==="OPTIONS")');
const gate=gateway.indexOf('if(Deno.env.get("SMM_LAUNCH_ENABLED")!=="true")');
const auth=gateway.indexOf('const user=await getUser(req)');
check(options>=0 && gate>options, 'SMM default-deny gate must follow OPTIONS handling');
check(gate>=0 && auth>gate, 'SMM default-deny gate must run before authentication and action routing');
check(gateway.includes('json({error:"SMM_DEFERRED"') && gateway.includes('},503);'), 'disabled SMM gateway must return a non-success deferred response');
check(gateway.includes('SMM_LAUNCH_ENABLED') && gateway.includes('!== "true"')===false, 'SMM rollout must require an exact explicit true flag');
check(!/<script[^>]+src=["'][^"']*smm\\.js/i.test(holding), 'deferred holding page must not load smm.js');
check(!/<script[^>]+src=["'][^"']*vendor\\/supabase\\.js/i.test(holding), 'deferred holding page must not initialize Supabase browser SDK');
check(!/<script[^>]+src=["'][^"']*config\\.js/i.test(holding), 'deferred holding page must not load application config');
check(!/<iframe[^>]+src=["'][^"']*smm\\.html/i.test(app), 'internal workspace must not embed the live SMM storefront');
check(holding.includes('الخدمة المستقلة مؤجلة للإطلاق الأول'), 'holding page must clearly disclose deferral');
check(home.includes('خدمات SMM — قريبًا'), 'desktop navigation must label SMM as deferred');
check(home.includes('خدمات التسويق الرقمي SMM — قريبًا'), 'mobile navigation must label SMM as deferred');
check(app.includes('خدمات التسويق الرقمي SMM — قريبًا') && app.includes('المتجر المستقل مؤجل للإطلاق الأول'), 'internal SMM module entry must be marked deferred');
check(app.includes('التسويق والإعلان'), 'internal Marketing & Advertising module must remain present');

if(fail.length){console.error('P0 SMM deferral gate: FAIL');for(const item of fail)console.error(' - '+item);process.exit(1)}
console.log('P0 SMM deferral gate: PASS');
console.log('Static storefront, desktop/mobile navigation, internal workspace, and default-deny API gate are covered.');
