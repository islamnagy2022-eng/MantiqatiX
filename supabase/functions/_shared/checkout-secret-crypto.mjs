const encodeBase64 = (bytes) => btoa(Array.from(bytes, value => String.fromCharCode(value)).join(""));
const decodeBase64 = (value) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

const associatedData = (intentId, businessId) =>
  new TextEncoder().encode("MantiqatiX:subscription-payment-intent:" + intentId + ":" + businessId);

export function checkoutSecretKeyEnvName(version) {
  const normalized = String(version ?? "").trim().toLowerCase();
  if (!/^v[1-9][0-9]*$/.test(normalized)) {
    throw new Error("CHECKOUT_ENCRYPTION_KEY_VERSION_INVALID");
  }
  return "PAYMOB_CHECKOUT_ENCRYPTION_KEY_" + normalized.toUpperCase();
}

export function getActiveCheckoutSecretVersion(getEnv) {
  if (typeof getEnv !== "function") throw new Error("CHECKOUT_ENCRYPTION_ENV_READER_REQUIRED");
  const configured = getEnv("PAYMOB_CHECKOUT_ENCRYPTION_ACTIVE_VERSION");
  const version = String(configured ?? "v1").trim().toLowerCase();
  checkoutSecretKeyEnvName(version);
  return version;
}

export function readCheckoutSecretKey(version, getEnv) {
  if (typeof getEnv !== "function") throw new Error("CHECKOUT_ENCRYPTION_ENV_READER_REQUIRED");
  const secret = getEnv(checkoutSecretKeyEnvName(version));
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("CHECKOUT_ENCRYPTION_KEY_MISSING");
  }
  return secret.trim();
}

export async function encryptCheckoutSecret(secret, { key, version, intentId, businessId }) {
  if (typeof secret !== "string" || !secret) throw new Error("CHECKOUT_SECRET_INVALID");
  if (!key || !version || !intentId || !businessId) throw new Error("CHECKOUT_ENCRYPTION_CONTEXT_INVALID");
  checkoutSecretKeyEnvName(version);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: associatedData(intentId, businessId) },
    key,
    new TextEncoder().encode(secret),
  );
  return {
    client_secret_ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    client_secret_iv: encodeBase64(iv),
    client_secret_key_version: version,
  };
}

export async function decryptCheckoutSecret(intent, { key }) {
  const version = String(intent?.client_secret_key_version ?? "");
  const ciphertext = String(intent?.client_secret_ciphertext ?? "");
  const iv = String(intent?.client_secret_iv ?? "");
  const intentId = String(intent?.id ?? "");
  const businessId = String(intent?.business_id ?? "");
  if (!version || !ciphertext || !iv || !intentId || !businessId || !key) {
    throw new Error("CHECKOUT_SECRET_NOT_STORED");
  }
  checkoutSecretKeyEnvName(version);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(iv), additionalData: associatedData(intentId, businessId) },
    key,
    decodeBase64(ciphertext),
  );
  return new TextDecoder().decode(clear);
}
