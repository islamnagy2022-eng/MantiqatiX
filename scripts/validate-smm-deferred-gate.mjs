#!/usr/bin/env node
import fs from 'node:fs';

const gateway=fs.readFileSync('supabase/functions/smm-gateway/index.ts','utf8');
const transport=fs.readFileSync('supabase/functions/smm-gateway/provider-transport.ts','utf8');
const tests=fs.readFileSync('supabase/functions/smm-gateway/provider-transport.test.ts','utf8');
const ngateway=gateway;
const holding=fs.readFileSync('web/smm.html','utf8');
const home=fs.readFileSync('web/home.js','utf8');
const app=fs.readFileSync('web/app.js','utf8');

const fail=[];
const check=(condition,message)=>{if(!condition)fail.push(message)};

const options=gateway.indexOf('if(req.method==="OPTIONS")');
const gate=gateway.indexOf('if(Deno.env.get("MNTY_SMM_ENABLED")!=="true")');
const auth=gateway.indexOf('const user=await getUser(req)');
check(options>=0 && gate>options, 'SMM default-deny gate must follow OPTIONS handling');
check(gate>=0 && auth>gate, 'SMM default-deny gate must run before authentication and action routing');
check(gateway.includes('json({error:"SMM_DEFERRED"') && gateway.includes('},503);'), 'disabled SMM gateway must return a non-success deferred response');
check(gateway.includes('Deno.env.get("MNTY_SMM_ENABLED")!=="true"'), 'SMM rollout must require an exact explicit true flag');
check(!/<script[^>]+src=["'][^"']*smm\.js/i.test(holding), 'deferred holding page must not load smm.js');
check(!/<script[^>]+src=["'][^"']*vendor\/supabase\.js/i.test(holding), 'deferred holding page must not initialize Supabase browser SDK');
check(!/<script[^>]+src=["'][^"']*config\.js/i.test(holding), 'deferred holding page must not load application config');
check(!/<iframe[^>]+src=["'][^"']*smm\.html/i.test(app), 'internal workspace must not embed the live SMM storefront');
check(holding.includes('الخدمة المستقلة مؤجلة للإطلاق الأول'), 'holding page must clearly disclose deferral');
check(home.includes('خدمات SMM — قريبًا'), 'desktop navigation must label SMM as deferred');
check(home.includes('خدمات التسويق الرقمي SMM — قريبًا'), 'mobile navigation must label SMM as deferred');
check(app.includes('خدمات التسويق الرقمي SMM — قريبًا') && app.includes('المتجر المستقل مؤجل للإطلاق الأول'), 'internal SMM module entry must be marked deferred');
check(app.includes('التسويق والإعلان'), 'internal Marketing & Advertising module must remain present');


const providerCall=gateway.slice(gateway.indexOf('async function call('),gateway.indexOf('\nDeno.serve'));
check(transport.includes('new URL(String(value ?? ""))'), 'provider endpoint must be parsed with a URL constructor');
check(transport.includes('endpoint.protocol !== "https:"'), 'provider calls must require HTTPS');
check(providerCall.includes('redirect:"error"'), 'provider calls must reject redirects');
check(providerCall.includes('setTimeout(()=>controller.abort(),15000)'), 'provider calls must have a bounded timeout');
check(transport.includes('total > maxBytes'), 'provider response body must be size-bounded');
check(transport.includes('Provider returned invalid JSON'), 'provider response must fail closed when it is not valid JSON');
check(!providerCall.includes('d={raw:t}'), 'provider response text must not be returned or propagated as raw fallback');

check(gateway.includes('import { assertSafeProviderEndpoint, readProviderJson } from "./provider-transport.ts"'), 'gateway must use tested provider transport policy');
check(gateway.includes('Deno.env.get("SMM_PROVIDER_HOSTS")'), 'provider calls must fail closed without explicit host allowlist');
check(fs.existsSync('supabase/functions/smm-gateway/provider-transport.test.ts'), 'provider transport unit tests must exist');

const placeOrder=gateway.slice(gateway.indexOf('if(a==="place_order")'),gateway.indexOf('if(a==="order_status")'));
check(placeOrder.includes('WALLET_DEBIT_RESULT_UNKNOWN'), 'ambiguous wallet debit must be quarantined for reconciliation');
check(placeOrder.includes('PROVIDER_RESULT_UNKNOWN'), 'ambiguous provider outcomes must be quarantined for reconciliation');
check(placeOrder.includes('PROVIDER_ACCEPTED_PERSISTENCE_PENDING'), 'provider acceptance with failed persistence must be surfaced for reconciliation');
check(!placeOrder.includes('smm_refund_wallet'), 'provider exceptions must not trigger automatic wallet refunds');
check(!placeOrder.includes('Automatic refund after provider failure'), 'ambiguous provider outcomes must never auto-refund');

const orderStatus=gateway.slice(gateway.indexOf('if(a==="order_status")'),gateway.indexOf('return json({error:"UNKNOWN_ACTION"}',gateway.indexOf('if(a==="order_status")')));
check(orderStatus.includes('normalizeProviderOrderStatus(o.data.status,rawStatus)'), 'order polling must use the tested status normalizer');
check(orderStatus.includes('ORDER_STATUS_PERSISTENCE_PENDING'), 'failed order-status persistence must be surfaced for reconciliation');
check(!orderStatus.includes('result:r'), 'raw provider status response must not be returned to clients');

check(ngateway.includes('import { normalizeProviderOrderStatus } from "./order-status.ts"'), 'gateway must use unit-tested provider status normalization');
check(fs.existsSync('supabase/functions/smm-gateway/order-status.ts'), 'provider status normalization module must exist');
check(tests.includes('provider terminal states cannot regress'), 'terminal-state regression tests must exist');

if(fail.length){console.error('P0 SMM deferral gate: FAIL');for(const item of fail)console.error(' - '+item);process.exit(1)}
console.log('P0 SMM deferral gate: PASS');
console.log('Static storefront, desktop/mobile navigation, internal workspace, and default-deny API gate are covered.');
