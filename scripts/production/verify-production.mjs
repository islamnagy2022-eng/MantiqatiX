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
const md=path.join(root,"supabase","migrations"), mf=exists("supabase/migrations")?fs.readdirSync(md).filter(x=>x.endsWith(".sql")):[];
const dup=[...new Set(mf.filter((f,i,a)=>a.indexOf(f)!==i))];
add("DB-MIGRATION-UNIQUE","DATABASE",dup.length?"FAIL":"PASS",dup.length?JSON.stringify(dup):`checked ${mf.length} migration filenames`,dup.length?"P0":"P1");
const requiredReleaseMigrations=[
  "20261009120000_rc425_atomic_mantigo_paymob_payment.sql",
  "20261009130000_rc426_digital_page_provider_order_binding.sql",
  "20261009140000_rc427_one_active_payment_intent_per_order.sql",
  "20261009150000_rc428_atomic_provider_failure_webhook.sql",
  "20261009160000_rc429_atomic_subscription_failure_webhook.sql",
  "20261009170000_rc430_atomic_subscription_success_webhook.sql",
  "20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql",
  "20261009190000_rc432_smm_wallet_transaction_idempotency.sql",
  "20261009200000_rc434_atomic_erp_purchase_receiving.sql",
  "20261009210000_rc435_subscription_provider_intent_claim.sql",
  "20261009220000_rc436_atomic_financial_journal.sql",
  "20261009230000_rc437_purchase_order_lines_receiving_limits.sql",
  "20261009240000_rc438_purchase_order_creation_with_lines.sql",
  "20261010010000_rc439_encrypted_checkout_recovery.sql",
  "20261010020000_rc440_exposed_security_definer_search_path.sql",
  "20261010030000_rc441_platform_admin_scope_hardening.sql",
  "20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql",
  "20261010120000_rc442_approval_action_audit_atomicity.sql",
  "20261010140000_rc444_crm_business_scope_rls.sql",
  "20261010150000_rc447_matrimony_profile_privacy_boundary.sql",
  "20261010161000_rc448_matrimony_request_lifecycle_authority.sql",
  "20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql",
  "20261010175000_rc449a_financial_journal_schema_prerequisites.sql",
  "20261010180000_rc450_financial_journal_service_role_boundary.sql",
  "20261010200000_rc451_targeted_ads_empty_search_path.sql",
  "20261010210000_rc452_marketing_crm_tenant_scope.sql",
  "20261010220000_rc453_marketing_campaign_backend.sql",
  "20261011010000_rc456_smm_service_role_access_boundary.sql",
  "20261011020000_rc457_financial_journal_idempotency_rpc_convergence.sql",
  "20261011030000_rc458_erp_branch_organization_scope.sql"
];
const missingReleaseMigrations=requiredReleaseMigrations.filter(name=>!mf.includes(name));
const presentReleaseMigrations=requiredReleaseMigrations.filter(name=>mf.includes(name));
const migrationTimestampOrderViolations=[];
for(let i=1;i<presentReleaseMigrations.length;i++){
  const previous=presentReleaseMigrations[i-1].slice(0,14), current=presentReleaseMigrations[i].slice(0,14);
  if(current<previous)migrationTimestampOrderViolations.push(`${presentReleaseMigrations[i-1]} -> ${presentReleaseMigrations[i]}`);
}
const reconciliationPath="docs/release/production-migration-reconciliation.json";
let reconciliation=null, reconciliationParseError=null;
try { reconciliation=JSON.parse(read(reconciliationPath)); } catch (error) { reconciliationParseError=String(error); }
const liveReconciliationVerified=Boolean(
  reconciliation &&
  reconciliation.status==="VERIFIED" &&
  reconciliation.verified===true &&
  reconciliation.source_ledger_identity_reconciled===true &&
  reconciliation.rc424_reconciliation?.exact_statement_match===true &&
  reconciliation.rc424_reconciliation?.ledger_version==="20261008222845" &&
  reconciliation.rc424_reconciliation?.source_filename_version==="20261009010000" &&
  reconciliation.rc424_reconciliation?.history_rewritten===false &&
  reconciliation.required_release_migrations_applied===true &&
  reconciliation.chronological_replay==="PASS" &&
  reconciliation.tenant_isolation_tests==="PASS" &&
  reconciliation.payment_finance_e2e==="PASS" &&
  reconciliation.backup_restore_rehearsal==="PASS" &&
  reconciliation.edge_function_contracts==="PASS" &&
  reconciliation.smm_gateway_parity==="PASS" &&
  reconciliation.auth_security_settings==="PASS" &&
  reconciliation.security_definer_acl_review==="PASS" &&
  reconciliation.rls_policy_audit==="PASS" &&
  reconciliation.targeted_ads_search_path==="PASS" &&
  reconciliation.leaked_password_protection==="PASS" &&
  typeof reconciliation.evidence_ref==="string" && reconciliation.evidence_ref.trim().length>0 &&
  typeof reconciliation.checked_at==="string" && reconciliation.checked_at.trim().length>0
);
const migrationChainBlocked=missingReleaseMigrations.length>0||migrationTimestampOrderViolations.length>0||!liveReconciliationVerified;
add("DB-RELEASE-MIGRATION-CHAIN","DATABASE",migrationChainBlocked?"BLOCKED":"PASS",
  migrationChainBlocked
    ? `Production rollout cannot be certified. Missing sources: ${missingReleaseMigrations.length?missingReleaseMigrations.join(", "):"none"}. Migration timestamp/order conflicts: ${migrationTimestampOrderViolations.length?migrationTimestampOrderViolations.join("; "):"none"}. Live reconciliation: ${reconciliationParseError||(!reconciliation?"manifest missing":JSON.stringify({status:reconciliation.status,verified:reconciliation.verified,source_ledger_identity_reconciled:reconciliation.source_ledger_identity_reconciled,rc424_reconciliation:reconciliation.rc424_reconciliation,required_release_migrations_applied:reconciliation.required_release_migrations_applied,chronological_replay:reconciliation.chronological_replay,tenant_isolation_tests:reconciliation.tenant_isolation_tests,payment_finance_e2e:reconciliation.payment_finance_e2e,backup_restore_rehearsal:reconciliation.backup_restore_rehearsal,edge_function_contracts:reconciliation.edge_function_contracts,smm_gateway_parity:reconciliation.smm_gateway_parity,auth_security_settings:reconciliation.auth_security_settings,security_definer_acl_review:reconciliation.security_definer_acl_review,rls_policy_audit:reconciliation.rls_policy_audit,targeted_ads_search_path:reconciliation.targeted_ads_search_path,leaked_password_protection:reconciliation.leaked_password_protection,evidence_ref:reconciliation.evidence_ref}))}. A source-only check cannot certify the live database.`
    : `All ${requiredReleaseMigrations.length} required source migrations are present and timestamp-ordered, and the live reconciliation manifest records completed ordered replay plus required runtime/security evidence at ${reconciliation.evidence_ref}.`,
  "P0");
const wf=exists(".github/workflows/pages.yml")?read(".github/workflows/pages.yml"):"";for(const v of ["validate-production-gate-contract.mjs","validate-finance-boundaries.mjs","validate-digital-pages-boundaries.mjs","validate-security-definer-contract.mjs"])add("CI-"+v,"CI/CD",wf.includes(v)?"PASS":"FAIL",wf.includes(v)?`workflow invokes ${v}`:`workflow missing ${v}`,"P1");
const report={generated_at:new Date().toISOString(),mode:"source_contract",note:"Runtime/Production claims require live evidence and are never inferred from source presence.",results,summary:Object.fromEntries(["PASS","FAIL","PARTIAL","BLOCKED","NOT VERIFIED"].map(s=>[s,results.filter(r=>r.status===s).length])),production_gate:results.some(r=>(r.status==="FAIL"||r.status==="BLOCKED")&&r.severity==="P0")?"BLOCKED":"NOT VERIFIED"};
const out=path.join(root,"artifacts","production-verification");fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"production-verification.json"),JSON.stringify(report,null,2)+"\n");for(const r of results)console.log(`[${r.status}] [${r.category}] ${r.id} — ${r.evidence}`);console.log(`PRODUCTION_GATE=${report.production_gate}`);console.log("REPORT=artifacts/production-verification/production-verification.json");const nonProductionValidation=process.env.GITHUB_EVENT_NAME==="pull_request"||(process.env.GITHUB_EVENT_NAME==="push"&&process.env.GITHUB_REF!=="refs/heads/main");if(results.some(r=>(r.status==="FAIL"||r.status==="BLOCKED")&&r.severity==="P0")&&!nonProductionValidation)process.exitCode=1;
