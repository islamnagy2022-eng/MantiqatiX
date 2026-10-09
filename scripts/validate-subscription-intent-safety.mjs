import fs from "node:fs";

const edge=fs.readFileSync("supabase/functions/subscription-payment-intent/index.ts","utf8");
const migration=fs.readFileSync("supabase/migrations/20261009210000_rc435_subscription_provider_intent_claim.sql","utf8");
const integration=fs.readFileSync("supabase/tests/rc435_subscription_intent_integration.sql","utf8");
const checks=[];
function check(name,ok){checks.push({name,ok:Boolean(ok)});if(!ok)console.error("FAIL "+name);}
check("subscription provider claim occurs before Paymob network call",edge.indexOf("claim_subscription_provider_intent_creation_backend")>=0&&edge.indexOf("claim_subscription_provider_intent_creation_backend")<edge.indexOf('fetch("https://accept.paymob.com/v1/intention/")'));
check("provider request has bounded timeout",edge.includes("AbortSignal.timeout(15000)"));
check("uncorrelated PENDING intent fails closed",edge.includes('intent.status === "PENDING" && (!intent.provider_order_id || !intent.provider_intent_id)')&&edge.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN"));
check("provider correlation persistence is conditional",edge.includes('.eq("status", "PENDING").is("provider_intent_id", null).is("provider_order_id", null)'));
check("unknown provider result is not retried automatically",edge.includes("reconciliation_required: true")&&migration.includes("must be reconciled, not retried"));
check("claim RPC serializes and locks the intent",migration.includes("for update")&&migration.includes("set status='PENDING'"));
check("new intent creation uses explicit READY state",edge.includes("create_subscription_payment_intent_claimable_backend")&&migration.includes("provider_creation_state"));
check("legacy intents are unreconciled and cannot be auto-claimed",migration.includes("LEGACY_UNRECONCILED")&&migration.includes("provider_creation_state='READY'")&&integration.includes("legacy unclaimed intent must not be automatically retried"));
check("claim RPC binds actor to intent creator",migration.includes("v_intent.created_by <> p_actor_user_id"));
check("claim RPC checks active business owner membership",migration.includes("m.user_id=p_actor_user_id")&&migration.includes("upper(m.role) in ('OWNER','BUSINESS_OWNER')"));
check("claim RPC is service-role-only",migration.includes("from public,anon,authenticated")&&migration.includes("to service_role"));
check("integration test covers replay, partial correlation and authorization",(integration.includes("second claim"))&&integration.includes("partial provider correlation must require reconciliation")&&integration.includes("cross-user intent claim was not rejected"));
const failed=checks.filter(x=>!x.ok);if(failed.length)process.exit(1);
console.log("Subscription intent safety contract PASS: "+checks.filter(x=>x.ok).length+"/"+checks.length+" checks.");
