#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=process.cwd(), results=[];
const add=(id,category,status,evidence,severity="P1")=>results.push({id,category,status,severity,evidence});
const exists=p=>fs.existsSync(path.join(root,p));
const read=p=>fs.readFileSync(path.isAbsolute(p)?p:path.join(root,p),"utf8");
const walk=d=>{const o=[];if(!fs.existsSync(d))return o;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()&&!["node_modules",".git"].includes(e.name))o.push(...walk(p));else if(e.isFile())o.push(p)}return o};
for(const p of [".github/workflows/pages.yml","web/app.js","web/rbac.js","supabase/functions/payment-intent/index.ts","supabase/functions/paymob-webhook/index.ts","supabase/migrations","scripts/validate-production-gate-contract.mjs","scripts/validate-finance-boundaries.mjs","scripts/validate-digital-pages-boundaries.mjs"])add("SRC-"+p.replace(/[^a-z0-9]+/gi,"_"),"SOURCE",exists(p)?"PASS":"FAIL",exists(p)?`exists: ${p}`:`missing: ${p}`,exists(p)?"P1":"P0");
const files=walk(path.join(root,"supabase","functions")).filter(p=>p.endsWith(".ts")), joined=files.map(read).join("\n");
add("SEC-FAKE-BILLING","SECURITY",!/customer@example\.com|\+201000000000/.test(joined)?"PASS":"FAIL","Scanned supabase/functions for known fake billing fallbacks.","P0");
const app=exists("web/app.js")?read("web/app.js"):"";
add("SEC-FRONTEND-SENSITIVE-WRITES","SECURITY",!(/from\(['"](?:orders|payment_intents|user_memberships|notifications|marketing_projects|advertisements)['"]\)[\s\S]{0,180}\.(?:insert|update|delete)\s*\(/.test(app))?"PASS":"FAIL","Scanned web/app.js for direct mutations on critical tables.","P0");
const payment=exists("supabase/functions/payment-intent/index.ts")?read("supabase/functions/payment-intent/index.ts"):"";
for(const [id,re,label] of [["PAY-AUTH","admin\\.auth\\.getUser","authenticated user lookup"],["PAY-RPC","create_payment_intent_backend","backend payment authority"],["PAY-IDEMP","idempotencyKey","idempotency input"],["PAY-CONTACT","CUSTOMER_BILLING_CONTACT_REQUIRED","real billing contact guard"]])add(id,"FINANCE",new RegExp(re).test(payment)?"PASS":"FAIL",label,"P0");
const digital=exists("supabase/functions/digital-page-payment-intent/index.ts")?read("supabase/functions/digital-page-payment-intent/index.ts"):"";
if(digital)for(const [id,re,label] of [["DIG-CLAIM","claim_digital_page_payment_intent_backend","race-safe claim"],["DIG-FINALIZE","finalize_digital_page_payment_intent_backend","provider finalize"],["DIG-RELEASE","release_digital_page_payment_intent_claim_backend","failure release"],["DIG-RACE","PAYMENT_INTENT_IN_PROGRESS","concurrency response"]])add(id,"FINANCE",new RegExp(re).test(digital)?"PASS":"FAIL",label,"P0");else add("DIGITAL-PAYMENT-SOURCE","FINANCE","NOT VERIFIED","digital-page-payment-intent source was not present in the checked tree.","P0");
const md=path.join(root,"supabase","migrations");
const mf=exists("supabase/migrations")?fs.readdirSync(md).filter(x=>/^\d{14}_.+\.sql$/.test(x)).sort():[];
const byMigrationVersion=new Map();
for(const file of mf){
  const version=file.slice(0,14);
  if(!byMigrationVersion.has(version))byMigrationVersion.set(version,[]);
  byMigrationVersion.get(version).push(file);
}
const knownLegacyMigrationCollisions=new Map([
  ["20260928020000",["20260928020000_rc101_g6_rls_permissive_policy_hardening.sql","20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql"]],
  ["20260928060000",["20260928060000_rc109_harden_order_support_tenant_boundaries.sql","20260928060000_restore_registration_request_dml_grants.sql"]],
  ["20260928190000",["20260928190000_rc162_mantigo_trip_state_machine.sql","20260928190000_rc200_cross_tenant_customer_payment_authorization.sql"]],
  ["20260928200000",["20260928200000_rc164_mantigo_direct_delete_lockdown.sql","20260928200000_rc164_retire_legacy_mantigo_mutator.sql","20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql"]],
  ["20260928210000",["20260928210000_rc172_restore_medical_booking_contract.sql","20260928210000_rc207_official_global_mnty_cover_ads.sql"]]
]);
const migrationVersionFailures=[];
for(const [version,names] of byMigrationVersion){
  if(names.length<2)continue;
  const actual=[...names].sort();
  const allowed=knownLegacyMigrationCollisions.get(version);
  if(!allowed||JSON.stringify(actual)!==JSON.stringify([...allowed].sort())){
    migrationVersionFailures.push({version,files:actual,reason:allowed?"known collision changed":"new migration-version collision"});
  }
}
const migrationVersionEvidence=migrationVersionFailures.length
  ?JSON.stringify(migrationVersionFailures)
  :`checked ${mf.length} migration files; only exact, pre-existing legacy version collisions allowed`;
add("DB-MIGRATION-UNIQUE","DATABASE",migrationVersionFailures.length?"FAIL":"PASS",migrationVersionEvidence,migrationVersionFailures.length?"P0":"P1");
const paymobWebhook=exists("supabase/functions/paymob-webhook/index.ts")?read("supabase/functions/paymob-webhook/index.ts"):"";
const mantigoStart=paymobWebhook.indexOf("if(mantigo){");
const mantigoEnd=paymobWebhook.indexOf("const {data:intentByRef}",mantigoStart);
const mantigoBlock=mantigoStart>=0&&mantigoEnd>=0?paymobWebhook.slice(mantigoStart,mantigoEnd):"";
const mantigoPaymentMigration="supabase/migrations/20261009120000_rc425_atomic_mantigo_paymob_payment.sql";
add("PAYMOB-MANTIGO-ATOMIC-RPC","FINANCE",mantigoBlock.includes('admin.rpc("process_verified_mantigo_payment_backend"')?"PASS":"FAIL","MantiGo Paymob event/ledger/notification writes must be delegated to one atomic backend RPC.","P0");
add("PAYMOB-MANTIGO-NO-DIRECT-WRITES","FINANCE",mantigoBlock.length>0&&!mantigoBlock.includes('admin.from("payment_provider_events").insert(')&&!mantigoBlock.includes('admin.from("mantigo_financial_ledger").update(')&&!mantigoBlock.includes('admin.from("notifications").insert(')?"PASS":"FAIL","MantiGo webhook must not split payment writes across service-role requests.","P0");
add("PAYMOB-MANTIGO-MIGRATION","DATABASE",exists(mantigoPaymentMigration)?"PASS":"FAIL",exists(mantigoPaymentMigration)?`exists: ${mantigoPaymentMigration}`:`missing: ${mantigoPaymentMigration}`,"P0");
add("PAYMOB-MANTIGO-MIGRATION-APPLIED","PRODUCTION","NOT VERIFIED","RC425 is source-only until reviewed and applied to the target Supabase project; verify function existence and grants after rollout.","P0");
const paymobWebhookBinding=exists("supabase/functions/paymob-webhook/index.ts")?read("supabase/functions/paymob-webhook/index.ts"):"";
const paymobIntentBinding=exists("supabase/functions/payment-intent/index.ts")?read("supabase/functions/payment-intent/index.ts"):"";
const digitalIntentBinding=exists("supabase/functions/digital-page-payment-intent/index.ts")?read("supabase/functions/digital-page-payment-intent/index.ts"):"";
add("PAYMOB-ORDER-BINDING-NORMAL","FINANCE",paymobWebhookBinding.includes("PAYMENT_PROVIDER_ORDER_MISMATCH")&&paymobIntentBinding.includes("provider_order_id: providerOrderId")?"PASS":"FAIL","Normal payment intent must persist and validate Paymob signed order ID.","P0");
add("PAYMOB-ORDER-BINDING-DIGITAL","FINANCE",paymobWebhookBinding.includes("DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH")&&exists("supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql")&&exists("supabase/migrations/20261009130000_rc426_digital_page_provider_order_binding.sql")&&digitalIntentBinding.includes("p_provider_order_id:providerOrderId")?"PASS":"FAIL","Digital page checkout and webhook must bind the signed Paymob order ID.","P0");
add("PAYMOB-ORDER-BINDING-SUBSCRIPTION","FINANCE",paymobWebhookBinding.includes("SUBSCRIPTION_PROVIDER_ORDER_MISMATCH")?"PASS":"FAIL","Subscription callbacks must match the stored Paymob order ID.","P0");
const activeIntentMigration="supabase/migrations/20261009140000_rc427_one_active_payment_intent_per_order.sql";
add("PAYMENT-INTENT-ORDER-UNIQUENESS","FINANCE",exists(activeIntentMigration)&&paymobIntentBinding.includes("PAYMENT_INTENT_ALREADY_INITIALIZED")?"PASS":"FAIL","Prevent a second active Paymob intention from overwriting the order-to-provider correlation.","P0");
const wf=exists(".github/workflows/pages.yml")?read(".github/workflows/pages.yml"):"";for(const v of ["validate-production-gate-contract.mjs","validate-finance-boundaries.mjs","validate-digital-pages-boundaries.mjs","validate-security-definer-contract.mjs"])add("CI-"+v,"CI/CD",wf.includes(v)?"PASS":"FAIL",wf.includes(v)?`workflow invokes ${v}`:`workflow missing ${v}`,"P1");
const report={generated_at:new Date().toISOString(),mode:"source_contract",note:"Runtime/Production claims require live evidence and are never inferred from source presence.",results,summary:Object.fromEntries(["PASS","FAIL","PARTIAL","BLOCKED","NOT VERIFIED"].map(s=>[s,results.filter(r=>r.status===s).length])),production_gate:results.some(r=>r.status==="FAIL"&&r.severity==="P0")?"BLOCKED":"NOT VERIFIED"};
const out=path.join(root,"artifacts","production-verification");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"production-verification.json"),JSON.stringify(report,null,2)+"\n");for(const r of results)console.log(`[${r.status}] [${r.category}] ${r.id} — ${r.evidence}`);console.log(`PRODUCTION_GATE=${report.production_gate}`);console.log("REPORT=artifacts/production-verification/production-verification.json");if(results.some(r=>r.status==="FAIL"&&r.severity==="P0"))process.exitCode=1;
