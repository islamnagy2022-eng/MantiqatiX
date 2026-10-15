import { getSmmLaunchDecision } from "./launch-gate.ts";
import { readBoundedJson } from "./request-validation.ts";
import { validateSmmOrderInput, validateSmmOrderPricing, normalizeSmmMoney } from "./order-validation.ts";
import { assertSafeProviderEndpoint, readProviderJson, normalizeProviderBalance } from "./provider-transport.ts";
import { normalizeProviderOrderStatus } from "./order-status.ts";
import { normalizeProviderService } from "./catalog-normalization.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
async function rejects(action: () => unknown | Promise<unknown>, message: string) {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  assert(rejected, message);
}

Deno.test("SMM launch gate is closed unless both independent flags are true", () => {
  equal(getSmmLaunchDecision(undefined, undefined), { enabled: false, status: 503, error: "SMM_DEFERRED" }, "default must fail closed");
  equal(getSmmLaunchDecision("true", undefined), { enabled: false, status: 503, error: "SMM_DEFERRED" }, "enable flag alone must not open gate");
  equal(getSmmLaunchDecision(undefined, "true"), { enabled: false, status: 503, error: "SMM_DEFERRED" }, "approval flag alone must not open gate");
  equal(getSmmLaunchDecision("TRUE", "true"), { enabled: false, status: 503, error: "SMM_DEFERRED" }, "flags must match explicit lowercase contract");
  equal(getSmmLaunchDecision("true", "true"), { enabled: true, status: 200, error: null }, "both explicit flags may open the gate");
});

Deno.test("bounded request JSON rejects unsupported, malformed, scalar and oversized bodies", async () => {
  equal(await readBoundedJson(new Request("https://example.com", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })),
    { ok: false, code: "UNSUPPORTED_MEDIA_TYPE", status: 415 }, "content type");
  equal(await readBoundedJson(new Request("https://example.com", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })),
    { ok: false, code: "INVALID_JSON", status: 400 }, "malformed JSON");
  equal(await readBoundedJson(new Request("https://example.com", { method: "POST", headers: { "content-type": "application/json" }, body: "[]" })),
    { ok: false, code: "INVALID_REQUEST", status: 400 }, "array root");
  equal(await readBoundedJson(new Request("https://example.com", { method: "POST", headers: { "content-type": "application/json", "content-length": "10" }, body: "{}" }), 4),
    { ok: false, code: "REQUEST_TOO_LARGE", status: 413 }, "declared oversized body");
  equal(await readBoundedJson(new Request("https://example.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "longer than limit" }) }), 4),
    { ok: false, code: "REQUEST_TOO_LARGE", status: 413 }, "streamed oversized body");
  const valid = await readBoundedJson(new Request("https://example.com", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: '{"action":"status"}' }));
  assert(valid.ok && valid.value.action === "status", "valid JSON object should parse");
});

Deno.test("SMM order input validates idempotency, positive quantity, and public HTTPS target", () => {
  const good = { service_id: "svc_1", target_url: "https://example.org/path", quantity: "100", idempotency_key: "request_key_123456" };
  const result = validateSmmOrderInput(good);
  assert(result.ok && result.quantity === 100 && result.targetUrl === "https://example.org/path", "valid order should normalize");
  equal(validateSmmOrderInput({ ...good, idempotency_key: "short" }), { ok: false, code: "IDEMPOTENCY_KEY_REQUIRED" }, "idempotency key required");
  equal(validateSmmOrderInput({ ...good, quantity: "0" }), { ok: false, code: "INVALID_ORDER" }, "zero quantity rejected");
  for (const target_url of ["http://example.org", "https://user:pass@example.org", "https://localhost", "https://127.0.0.1", "https://example.local", "https://example.test"]) {
    const invalid = validateSmmOrderInput({ ...good, target_url });
    assert(!invalid.ok && invalid.code === "INVALID_TARGET_URL", `unsafe target must reject: ${target_url}`);
  }
});

Deno.test("SMM pricing uses positive margin and stable two-decimal amounts", () => {
  equal(validateSmmOrderPricing({ sellingPrice: 25, providerCost: 10, quantity: 1000 }),
    { ok: true, charged: 25, cost: 10, profit: 15 }, "pricing calculation");
  equal(validateSmmOrderPricing({ sellingPrice: 10, providerCost: 10, quantity: 1000 }),
    { ok: false, code: "NON_POSITIVE_MARGIN" }, "zero margin rejected");
  equal(validateSmmOrderPricing({ sellingPrice: 0, providerCost: 10, quantity: 1000 }),
    { ok: false, code: "INVALID_SERVICE_PRICING" }, "invalid selling price rejected");
  equal(normalizeSmmMoney("12.34", false), 12.34, "money string normalization");
  equal(normalizeSmmMoney("12.345", false), null, "fractional precision rejected");
  equal(normalizeSmmMoney(-1, true), null, "negative money rejected");
});

Deno.test("provider transport enforces HTTPS hostname allowlist and response bounds", async () => {
  equal(assertSafeProviderEndpoint("https://api.provider.example.org/v1", "api.provider.example.org").toString(),
    "https://api.provider.example.org/v1", "allowlisted provider URL");
  for (const endpoint of ["http://api.provider.example.org", "https://evil.example.org", "https://user:pass@api.provider.example.org", "https://127.0.0.1"]) {
    await rejects(() => assertSafeProviderEndpoint(endpoint, "api.provider.example.org"), `provider endpoint must reject: ${endpoint}`);
  }
  equal(await readProviderJson(new Response('{"balance":"12.5","currency":"usd"}', { headers: { "content-type": "application/json" } })),
    { balance: "12.5", currency: "usd" }, "provider JSON response");
  await rejects(() => readProviderJson(new Response("<html/>", { headers: { "content-type": "text/html" } })), "non-JSON provider response rejected");
  await rejects(() => readProviderJson(new Response('{"large":"123456"}', { headers: { "content-type": "application/json" } }), 4), "oversized provider response rejected");
  equal(normalizeProviderBalance({ balance: "12.345", currency: "usd" }), { balance: 12.35, currency: "USD" }, "provider balance normalization");
  equal(normalizeProviderBalance({ balance: "-1", currency: "USD" }), null, "negative provider balance rejected");
});

Deno.test("provider status cannot overwrite a terminal platform state", () => {
  equal(normalizeProviderOrderStatus("COMPLETED", "failed"), "COMPLETED", "completed state is terminal");
  equal(normalizeProviderOrderStatus("FAILED", "processing"), "FAILED", "failed state is terminal");
  equal(normalizeProviderOrderStatus("PENDING", "in progress"), "PROCESSING", "provider processing state maps");
  equal(normalizeProviderOrderStatus("PENDING", "unknown"), "PENDING", "unknown provider state preserves current state");
});

Deno.test("provider catalog normalization never activates unreviewed or unpriced services", () => {
  const raw = { service: 44, rate: "3.5", min: "10", max: "1000", name: "Test service", description: "safe" };
  const fresh = normalizeProviderService(raw, "provider-1");
  assert(fresh !== null && fresh.selling_price === 0 && fresh.active === false, "new service must be inactive and zero-priced");
  const reviewed = normalizeProviderService(raw, "provider-1", { selling_price: 5, active: true });
  assert(reviewed !== null && reviewed.selling_price === 5 && reviewed.active === true, "reviewed positive margin can preserve activation");
  const noMargin = normalizeProviderService(raw, "provider-1", { selling_price: 3.5, active: true });
  assert(noMargin !== null && noMargin.active === false, "non-positive margin must deactivate service");
  equal(normalizeProviderService({ service: "bad", rate: "not-a-number" }, "provider-1"), null, "malformed provider service rejected");
});
