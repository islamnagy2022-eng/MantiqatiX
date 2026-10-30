import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  encryptCheckoutSecret,
  decryptCheckoutSecret,
  getActiveCheckoutSecretVersion,
  readCheckoutSecretKey,
} from "../supabase/functions/_shared/checkout-secret-crypto.mjs";

const toBase64 = bytes => btoa(Array.from(bytes, value => String.fromCharCode(value)).join(""));
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const env = {
  PAYMOB_CHECKOUT_ENCRYPTION_KEY_V1: toBase64(webcrypto.getRandomValues(new Uint8Array(32))),
  PAYMOB_CHECKOUT_ENCRYPTION_KEY_V2: toBase64(webcrypto.getRandomValues(new Uint8Array(32))),
};
const getEnv = name => env[name] ?? "";
const importVersionedKey = async version => {
  const raw = fromBase64(readCheckoutSecretKey(version, getEnv));
  if (raw.length !== 32) throw new Error("CHECKOUT_ENCRYPTION_KEY_INVALID");
  return webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

const context = { intentId: "intent-123", businessId: "business-456" };
const secret = "egy_csk_test_example_secret_do_not_log";
const activeV1 = getActiveCheckoutSecretVersion(getEnv);
const keyV1 = await importVersionedKey(activeV1);
const one = await encryptCheckoutSecret(secret, { key: keyV1, version: activeV1, ...context });
const two = await encryptCheckoutSecret(secret, { key: keyV1, version: activeV1, ...context });
if (one.client_secret_ciphertext.includes(secret) || one.client_secret_iv === two.client_secret_iv) {
  throw new Error("Ciphertext must not contain plaintext and each encryption must use a fresh IV.");
}
const restored = await decryptCheckoutSecret({ id: context.intentId, business_id: context.businessId, ...one }, { key: keyV1 });
if (restored !== secret) throw new Error("Encrypted checkout secret failed round-trip.");

let wrongContextRejected = false;
try {
  await decryptCheckoutSecret({ id: context.intentId, business_id: "different-business", ...one }, { key: keyV1 });
} catch { wrongContextRejected = true; }
if (!wrongContextRejected) throw new Error("Checkout secret must be bound to its business and intent.");

let tamperRejected = false;
const bytes = fromBase64(one.client_secret_ciphertext);
bytes[0] ^= 1;
try {
  await decryptCheckoutSecret({ id: context.intentId, business_id: context.businessId, ...one,
    client_secret_ciphertext: toBase64(bytes) }, { key: keyV1 });
} catch { tamperRejected = true; }
if (!tamperRejected) throw new Error("Tampered checkout ciphertext must be rejected.");

// Rotate writes to V2 while preserving the ability to decrypt existing V1 records.
env.PAYMOB_CHECKOUT_ENCRYPTION_ACTIVE_VERSION = "v2";
const activeV2 = getActiveCheckoutSecretVersion(getEnv);
if (activeV2 !== "v2") throw new Error("Active checkout key version did not switch to V2.");
const oldStoredKey = await importVersionedKey(one.client_secret_key_version);
const oldRecordAfterRotation = await decryptCheckoutSecret(
  { id: context.intentId, business_id: context.businessId, ...one },
  { key: oldStoredKey },
);
if (oldRecordAfterRotation !== secret) throw new Error("Existing V1 checkout secret failed after active key rotation.");
const keyV2 = await importVersionedKey(activeV2);
const rotated = await encryptCheckoutSecret(secret, { key: keyV2, version: activeV2, ...context });
if (rotated.client_secret_key_version !== "v2") throw new Error("New checkout secret was not written with V2.");
const restoredV2 = await decryptCheckoutSecret(
  { id: context.intentId, business_id: context.businessId, ...rotated },
  { key: keyV2 },
);
if (restoredV2 !== secret) throw new Error("V2 checkout secret failed round-trip.");
let wrongVersionRejected = false;
try { await importVersionedKey("v3"); } catch { wrongVersionRejected = true; }
if (!wrongVersionRejected) throw new Error("Missing V3 key must fail closed.");
let malformedVersionRejected = false;
try { readCheckoutSecretKey("latest", getEnv); } catch { malformedVersionRejected = true; }
if (!malformedVersionRejected) throw new Error("Malformed checkout key version must fail closed.");

console.log("Checkout secret crypto tests PASS: round-trip, unique IV, context binding, tamper rejection, V1→V2 rotation, and fail-closed key lookup.");
