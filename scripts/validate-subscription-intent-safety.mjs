import fs from "node:fs";

const edge=fs.readFileSync("supabase/functions/subscription-payment-intent/index.ts","utf8");
const migration=fs.readFileSync("supabase/migrations/20261009210000_rc435_subscription_provider_intent_claim.sql","utf8");
const recoveryMigration=fs.readFileSync("supabase/migrations/20261010010000_rc439_encrypted_checkout_recovery.sql","utf8");
const integration=fs.readFileSync("supabase/tests/rc435_subscription_intent_integration.sql","utf8");
const cryptoModule=fs.readFileSync("supabase/functions/_shared/checkout-secret-crypto.mjs","utf8");
const cryptoTest=fs.readFileSync("scripts/test-checkout-secret-crypto.mjs","utf8");
const checks=[];
function check(name,ok){checks.push({name,ok:Boolean(ok)});if(!ok)console.error("FAIL "+name);}
check("subscription provider claim occurs before Paymob network call",edge.indexOf('admin.rpc("claim_subscription_provider_intent_creation_backend"')>=0&&edge.indexOf('admin.rpc("claim_subscription_provider_intent_creation_backend"')<edge.indexOf('fetch("https://accept.paymob.com/v1/intention/"'));
check("provider request has bounded timeout",edge.includes("AbortSignal.timeout(15000)"));
check("uncorrelated PENDING intent fails closed",edge.includes('intent.status === "PENDING" && (!intent.provider_order_id || !intent.provider_intent_id)')&&edge.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN"));
check("provider correlation persistence is conditional",edge.includes('.eq("status", "PENDING").eq("provider_creation_state", "CLAIMED").is("provider_intent_id", null).is("provider_order_id", null)'));
check("checkout client secret is encrypted with AES-GCM before persistence",cryptoModule.includes("crypto.subtle.encrypt")&&edge.includes("encryptCheckoutSecretPayload")&&edge.includes("client_secret_ciphertext")&&edge.includes("client_secret_iv")&&recoveryMigration.includes("client_secret_ciphertext text")&&!edge.includes("client_secret: clientSecret"));
check("AES-GCM ciphertext is bound to intent and business identity",cryptoModule.includes("additionalData")&&cryptoModule.includes("MantiqatiX:subscription-payment-intent:"));
check("retry recovers checkout from encrypted secret instead of creating a second intention",edge.includes("recoverExistingCheckout")&&edge.includes("CHECKOUT_RECOVERY_UNAVAILABLE")&&edge.includes("safePaymentIntent(intent)"));
check("encrypted secret fields are all-or-none and key versioned",recoveryMigration.includes("client_secret_key_version")&&recoveryMigration.includes("client_secret_ciphertext is not null and client_secret_iv is not null and client_secret_key_version is not null"));
check("behavioral crypto test covers round-trip, IV uniqueness, context binding and tamper rejection",cryptoTest.includes("unique IV")&&cryptoTest.includes("wrongContextRejected")&&cryptoTest.includes("tamperRejected"));
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
