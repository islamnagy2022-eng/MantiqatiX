const encodeBase64 = (bytes) => btoa(Array.from(bytes, value => String.fromCharCode(value)).join(""));
const decodeBase64 = (value) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

export async function encryptCheckoutSecret(secret, context) {
  const { key, version, intentId, businessId } = context ?? {};
  if (!key || !version || !intentId || !businessId) throw new Error("CHECKOUT_ENCRYPTION_CONTEXT_REQUIRED");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode("MantiqatiX:subscription-payment-intent:" + intentId + ":" + businessId);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    new TextEncoder().encode(String(secret))
  );
  return {
    client_secret_ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    client_secret_iv: encodeBase64(iv),
    client_secret_key_version: version,
  };
}

export async function decryptCheckoutSecret(intent, context) {
  const { key } = context ?? {};
  const version = String(intent?.client_secret_key_version ?? "");
  const ciphertext = String(intent?.client_secret_ciphertext ?? "");
  const iv = String(intent?.client_secret_iv ?? "");
  const intentId = String(intent?.id ?? "");
  const businessId = String(intent?.business_id ?? "");
  if (!key || !version || !ciphertext || !iv || !intentId || !businessId) throw new Error("CHECKOUT_SECRET_CONTEXT_MISSING");
  const additionalData = new TextEncoder().encode("MantiqatiX:subscription-payment-intent:" + intentId + ":" + businessId);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(iv), additionalData },
    key,
    decodeBase64(ciphertext)
  );
  return new TextDecoder().decode(clear);
}
