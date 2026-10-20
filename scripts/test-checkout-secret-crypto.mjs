import { webcrypto } from "node:crypto";
import { encryptCheckoutSecret, decryptCheckoutSecret } from "../supabase/functions/_shared/checkout-secret-crypto.mjs";


const rawKey = webcrypto.getRandomValues(new Uint8Array(32));
const key = await webcrypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
const context = { key, version: "v1", intentId: "intent-123", businessId: "business-456" };
const secret = "egy_csk_test_example_secret_do_not_log";
const one = await encryptCheckoutSecret(secret, context);
const two = await encryptCheckoutSecret(secret, context);
if (one.client_secret_ciphertext.includes(secret) || one.client_secret_iv === two.client_secret_iv) {
  throw new Error("Ciphertext must not contain plaintext and each encryption must use a fresh IV.");
}
const restored = await decryptCheckoutSecret({ id: context.intentId, business_id: context.businessId, ...one }, { key });
if (restored !== secret) throw new Error("Encrypted checkout secret failed round-trip.");

let wrongContextRejected = false;
try {
  await decryptCheckoutSecret({ id: context.intentId, business_id: "different-business", ...one }, { key });
} catch { wrongContextRejected = true; }
if (!wrongContextRejected) throw new Error("Checkout secret must be bound to its business and intent.");

let tamperRejected = false;
const bytes = Uint8Array.from(atob(one.client_secret_ciphertext), ch => ch.charCodeAt(0));
bytes[0] ^= 1;
try {
  await decryptCheckoutSecret({ id: context.intentId, business_id: context.businessId, ...one,
    client_secret_ciphertext: btoa(Array.from(bytes, ch => String.fromCharCode(ch)).join("")) }, { key });
} catch { tamperRejected = true; }
if (!tamperRejected) throw new Error("Tampered checkout ciphertext must be rejected.");

console.log("Checkout secret crypto tests PASS: round-trip, unique IV, context binding, tamper rejection.");
