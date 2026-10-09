import fs from "node:fs";

const edge=fs.readFileSync("supabase/functions/subscription-payment-intent/index.ts","utf8");
const migration=fs.readFileSync("supabase/migrations/20261010010000_rc439_encrypted_checkout_recovery.sql","utf8");
const cryptoHelper=fs.readFileSync("supabase/functions/_shared/checkout-secret-crypto.mjs","utf8");
const cryptoTest=fs.readFileSync("scripts/test-checkout-secret-crypto.mjs","utf8");
const checks=[];
function check(name,ok){checks.push({name,ok:Boolean(ok)});if(!ok)console.error("FAIL "+name);}
check("checkout secret uses AES-GCM with random 96-bit IV",edge.includes('name: "AES-GCM"')&&edge.includes("crypto.getRandomValues(new Uint8Array(12))"));
check("checkout ciphertext is authenticated to intent and business IDs",cryptoHelper.includes("MantiqatiX:subscription-payment-intent:")&&cryptoHelper.includes("additionalData"));
check("encryption key is a server-side versioned secret and 256-bit",edge.includes("PAYMOB_CHECKOUT_ENCRYPTION_KEY_")&&edge.includes("raw.byteLength !== 32")&&edge.includes("client_secret_key_version"));
check("plaintext client secret is not written to the database",cryptoHelper.includes("client_secret_ciphertext: encodeBase64")&&edge.includes("...encryptedSecret")&&!/update\(\{[^}]*client_secret\s*:/s.test(edge));
check("safe intent responses omit ciphertext, IV, key version and internal fields",edge.includes("client_secret_ciphertext: _ciphertext")&&edge.includes("client_secret_iv: _iv")&&edge.includes("client_secret_key_version: _version"));
check("existing checkout is recovered instead of creating another Paymob intention",edge.includes("recoverExistingCheckout(intent")&&edge.includes("if (intent.status === \"PENDING\" && intent.provider_order_id && intent.provider_intent_id)")&&edge.includes("CHECKOUT_RECOVERY_UNAVAILABLE"));
check("ambiguous provider outcomes are preserved for reconciliation",edge.includes("persistUnknownProviderCorrelation")&&edge.includes("PAYMENT_PROVIDER_OUTCOME_UNKNOWN")&&edge.includes("RECONCILIATION_REQUIRED"));
check("database requires ciphertext, IV and key version to be all-null or all-present",migration.includes("client_secret_ciphertext is null and client_secret_iv is null and client_secret_key_version is null")&&migration.includes("client_secret_ciphertext is not null and client_secret_iv is not null and client_secret_key_version is not null"));
check("crypto behavior test covers round-trip, fresh IV, context binding and tampering",cryptoTest.includes("fresh IV")&&cryptoTest.includes("wrongContextRejected")&&cryptoTest.includes("tamperRejected"));
const failed=checks.filter(x=>!x.ok);if(failed.length)process.exit(1);
console.log("RC439 encrypted checkout recovery contract PASS: "+checks.length+"/"+checks.length+" checks.");
