import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const secretKey = Deno.env.get("PAYMOB_SECRET_KEY") ?? "";
const publicKey = Deno.env.get("PAYMOB_PUBLIC_KEY") ?? "";
const integrationId = Deno.env.get("PAYMOB_INTEGRATION_ID") ?? "";
const checkoutKeyVersion = Deno.env.get("PAYMOB_CHECKOUT_ENCRYPTION_KEY_VERSION") ?? "v1";
const checkoutKeyEnvName = (version: string) => "PAYMOB_CHECKOUT_ENCRYPTION_KEY_" + version.toUpperCase();
const encodeBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, value => String.fromCharCode(value)).join(""));
const decodeBase64 = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function importCheckoutKey(version: string): Promise<CryptoKey> {
  if (!/^v[1-9][0-9]{0,2}$/.test(version)) throw new Error("CHECKOUT_KEY_VERSION_INVALID");
  const encoded = Deno.env.get(checkoutKeyEnvName(version)) ?? "";
  if (!encoded) throw new Error("CHECKOUT_KEY_MISSING");
  const raw = decodeBase64(encoded);
  if (raw.byteLength !== 32) throw new Error("CHECKOUT_KEY_LENGTH_INVALID");
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptCheckoutSecret(secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importCheckoutKey(checkoutKeyVersion);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));
  return {
    client_secret_ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    client_secret_iv: encodeBase64(iv),
    client_secret_key_version: checkoutKeyVersion,
  };
}

async function decryptCheckoutSecret(intent: Record<string, unknown>): Promise<string> {
  const version = String(intent.client_secret_key_version ?? "");
  const ciphertext = String(intent.client_secret_ciphertext ?? "");
  const iv = String(intent.client_secret_iv ?? "");
  if (!version || !ciphertext || !iv) throw new Error("CHECKOUT_SECRET_NOT_STORED");
  const key = await importCheckoutKey(version);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(iv) }, key, decodeBase64(ciphertext));
  return new TextDecoder().decode(clear);
}

function safePaymentIntent(intent: Record<string, unknown>) {
  const {
    client_secret_ciphertext: _ciphertext,
    client_secret_iv: _iv,
    client_secret_key_version: _version,
    pricing_hash: _pricingHash,
    idempotency_key: _idempotencyKey,
    created_by: _createdBy,
    ...safe
  } = intent;
  return safe;
}

async function recoverExistingCheckout(intent: Record<string, unknown>, requestId: string): Promise<Response> {
  try {
    const clientSecret = await decryptCheckoutSecret(intent);
    const checkoutUrl = "https://accept.paymob.com/unifiedcheckout/?publicKey=" + encodeURIComponent(publicKey) + "&clientSecret=" + encodeURIComponent(clientSecret);
    return json({ paymentIntent: safePaymentIntent(intent), clientSecret, checkoutUrl, requestId }, 200, requestId);
  } catch {
    console.error(JSON.stringify({ requestId, stage: "checkout_secret_recovery_unavailable" }));
    return json({ error: "CHECKOUT_RECOVERY_UNAVAILABLE", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
  }
}

async function persistUnknownProviderCorrelation(intentId: string, providerIntentId: string, providerOrderId: string) {
  if (!admin || (!providerIntentId && !providerOrderId)) return;
  await admin.from("subscription_payment_intents").update({
    ...(providerIntentId ? { provider_intent_id: providerIntentId } : {}),
    ...(providerOrderId ? { provider_order_id: providerOrderId } : {}),
    provider_creation_state: "RECONCILIATION_REQUIRED",
    updated_at: new Date().toISOString(),
  }).eq("id", intentId).eq("status", "PENDING").eq("provider_creation_state", "CLAIMED")
    .is("provider_intent_id", null).is("provider_order_id", null);
}
const allowedOrigin = "https://islamnagy2022-eng.github.io";
const maxBodyBytes = 24000;
const admin = url && serviceRole ? createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200, requestId?: string) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", ...(requestId ? { "X-Request-Id": requestId } : {}) },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async req => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, requestId);
  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403, requestId);
  const contentLength = Number(req.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return json({ error: "PAYLOAD_TOO_LARGE" }, 413, requestId);

  if (!admin) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 503, requestId);
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401, requestId);
  try {
    const { data: { user }, error: userError } = await admin.auth.getUser(authorization.slice(7));
    if (userError || !user || user.is_anonymous) return json({ error: "AUTH_REQUIRED" }, 401, requestId);
    if (!secretKey || !publicKey || !integrationId || !Number.isSafeInteger(Number(integrationId)) || Number(integrationId) <= 0) {
      return json({ error: "PAYMENT_PROVIDER_NOT_CONFIGURED" }, 503, requestId);
    }
    try {
      await importCheckoutKey(checkoutKeyVersion);
    } catch {
      return json({ error: "PAYMENT_CHECKOUT_ENCRYPTION_NOT_CONFIGURED" }, 503, requestId);
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Array.isArray(body) || typeof body !== "object") return json({ error: "INVALID_JSON" }, 400, requestId);
    const businessId = String(body.businessId ?? "").trim();
    const tierCode = String(body.tierCode ?? "").trim().toUpperCase();
    const billingCycle = String(body.billingCycle ?? "").trim().toUpperCase();
    const sector = String(body.sector ?? "").trim();
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    if (!uuidPattern.test(businessId) || !tierCode || tierCode.length > 64 ||
        !["MONTHLY", "ANNUAL"].includes(billingCycle) ||
        idempotencyKey.length < 8 || idempotencyKey.length > 200 || sector.length > 128) {
      return json({ error: "INVALID_REQUEST" }, 400, requestId);
    }

    const { data: intent, error: intentError } = await admin.rpc("create_subscription_payment_intent_claimable_backend", {
      p_business_id: businessId,
      p_tier_code: tierCode,
      p_billing_cycle: billingCycle,
      p_sector: sector || null,
      p_idempotency_key: idempotencyKey,
      p_actor_user_id: user.id,
    });
    if (intentError || !intent) {
      const code = String(intentError?.message ?? "");
      const status = code.includes("SUBSCRIPTION_FORBIDDEN") ? 403
        : code.includes("SUBSCRIPTION_TIER_UNAVAILABLE") ? 409
        : code.includes("SUBSCRIPTION_INVALID") || code.includes("IDEMPOTENCY_MISMATCH") ? 400 : 400;
      console.error(JSON.stringify({ requestId, stage: "create_subscription_payment_intent_claimable_backend", code: intentError?.code }));
      return json({ error: code.includes("SUBSCRIPTION_FORBIDDEN") ? "SUBSCRIPTION_FORBIDDEN" : "SUBSCRIPTION_PAYMENT_INTENT_REJECTED", requestId }, status, requestId);
    }

    if (intent.status === "SUCCEEDED" || intent.status === "PAID_PENDING_LEGAL") {
      return json({ paymentIntent: safePaymentIntent(intent), requestId }, 200, requestId);
    }
    if (intent.status === "PENDING" && intent.provider_order_id && intent.provider_intent_id) {
      return await recoverExistingCheckout(intent as Record<string, unknown>, requestId);
    }
    if (intent.status === "PENDING" && (!intent.provider_order_id || !intent.provider_intent_id)) {
      return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
    }
    if (intent.status !== "CREATED") {
      return json({ error: "SUBSCRIPTION_INTENT_NOT_RETRYABLE", paymentIntentId: intent.id, status: intent.status, requestId }, 409, requestId);
    }

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const email = String(user.email ?? "").trim();
    const phone = String(user.phone ?? meta.phone ?? meta.phone_number ?? "").trim();
    const firstName = String(meta.first_name ?? meta.firstName ?? user.email?.split("@")[0] ?? "Customer").slice(0, 50);
    const lastName = String(meta.last_name ?? meta.lastName ?? "Customer").slice(0, 50);
    if (!email || !phone) return json({ error: "CUSTOMER_BILLING_CONTACT_REQUIRED", requestId }, 422, requestId);

    const amountMinor = Math.round(Number(intent.amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return json({ error: "SUBSCRIPTION_AMOUNT_INVALID", requestId }, 409, requestId);

    // Claim the only provider-creation attempt before network I/O. A retry that sees
    // PENDING without provider correlation must reconcile; it must not create a second intention.
    const { data: claim, error: claimError } = await admin.rpc("claim_subscription_provider_intent_creation_backend", {
      p_intent_id: intent.id,
      p_actor_user_id: user.id,
    });
    if (claimError || !claim || typeof claim !== "object") {
      console.error(JSON.stringify({ requestId, stage: "claim_subscription_provider_intent_creation_backend", code: claimError?.code }));
      return json({ error: "SUBSCRIPTION_PROVIDER_CLAIM_FAILED", requestId }, 409, requestId);
    }
    const claimData = claim as Record<string, unknown>;
    const claimedIntent = claimData.intent as Record<string, unknown> | undefined;
    if (claimData.claimed !== true) {
      if (claimData.outcome_unknown === true || (claimedIntent?.status === "PENDING" && (!claimedIntent.provider_order_id || !claimedIntent.provider_intent_id))) {
        return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
      }
      if (claimedIntent?.status === "SUCCEEDED" || claimedIntent?.status === "PAID_PENDING_LEGAL") {
        return json({ paymentIntent: safePaymentIntent(claimedIntent), requestId }, 200, requestId);
      }
      if (claimedIntent?.status === "PENDING" && claimedIntent?.provider_order_id && claimedIntent?.provider_intent_id) {
        return await recoverExistingCheckout(claimedIntent, requestId);
      }
      return json({ error: "SUBSCRIPTION_INTENT_NOT_RETRYABLE", paymentIntentId: intent.id, status: claimedIntent?.status ?? intent.status, requestId }, 409, requestId);
    }

    let paymobResp: Response;
    try {
      paymobResp = await fetch("https://accept.paymob.com/v1/intention/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Token ${secretKey}` },
        body: JSON.stringify({
          amount: amountMinor,
          currency: String(intent.currency),
          payment_methods: [Number(integrationId)],
          special_reference: `MANTIQATIX-SUB-${intent.id}`,
          items: [],
          billing_data: { first_name: firstName, last_name: lastName, email, phone_number: phone, country: "EGY", city: "NA", street: "NA", building: "NA", floor: "NA", apartment: "NA", postal_code: "NA", state: "NA" },
          extras: { mantiqatix_payment_intent_id: intent.id, business_id: businessId, tier_code: tierCode, billing_cycle: billingCycle },
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      console.error(JSON.stringify({ requestId, stage: "paymob_intention_network_outcome_unknown" }));
      return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
    }

    const paymob = await paymobResp.json().catch(() => null) as Record<string, unknown> | null;
    if (!paymobResp.ok || !paymob) {
      console.error(JSON.stringify({ requestId, stage: "paymob_intention_outcome_unknown", status: paymobResp.status }));
      return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
    }
    const providerIntentId = String(paymob.id ?? "");
    const providerOrderId = String(paymob.intention_order_id ?? paymob.order_id ?? "");
    const clientSecret = String(paymob.client_secret ?? "");
    if (!providerIntentId || !providerOrderId || !clientSecret) {
      await persistUnknownProviderCorrelation(String(intent.id), providerIntentId, providerOrderId);
      console.error(JSON.stringify({ requestId, stage: "paymob_intention_correlation_unknown" }));
      return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
    }

    let encryptedSecret: { client_secret_ciphertext: string; client_secret_iv: string; client_secret_key_version: string };
    try {
      encryptedSecret = await encryptCheckoutSecret(clientSecret);
    } catch {
      await persistUnknownProviderCorrelation(String(intent.id), providerIntentId, providerOrderId);
      console.error(JSON.stringify({ requestId, stage: "checkout_secret_encryption_failed" }));
      return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
    }

    const { data: updated, error: updateError } = await admin.from("subscription_payment_intents")
      .update({ status: "PENDING", provider_intent_id: providerIntentId, provider_order_id: providerOrderId, provider_creation_state: "CORRELATED", ...encryptedSecret, updated_at: new Date().toISOString() })
      .eq("id", intent.id).eq("status", "PENDING").eq("provider_creation_state", "CLAIMED").is("provider_intent_id", null).is("provider_order_id", null)
      .select().maybeSingle();
    if (updateError || !updated) {
      console.error(JSON.stringify({ requestId, stage: "subscription_intent_correlation_persistence_unknown", code: updateError?.code }));
      return json({ error: "PAYMENT_PROVIDER_OUTCOME_UNKNOWN", reconciliation_required: true, paymentIntentId: intent.id, requestId }, 503, requestId);
    }

    const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(clientSecret)}`;
    return json({ paymentIntent: safePaymentIntent(updated as Record<string, unknown>), clientSecret, checkoutUrl, requestId }, 200, requestId);
  } catch {
    console.error(JSON.stringify({ requestId, stage: "unhandled" }));
    return json({ error: "SUBSCRIPTION_PAYMENT_FAILED", requestId }, 500, requestId);
  }
});
