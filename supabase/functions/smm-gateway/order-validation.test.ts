import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeSmmMoney, validateSmmOrderInput, validateSmmOrderPricing } from "./order-validation.ts";

Deno.test("S07_ORDER_001: valid order input requires a stable idempotency key", () => {
  assertEquals(validateSmmOrderInput({
    service_id: "service-1",
    target_url: "https://example.com/profile",
    quantity: 100,
    idempotency_key: "order_key_12345678",
  }), {
    ok: true,
    serviceId: "service-1",
    targetUrl: "https://example.com/profile",
    quantity: 100,
    idempotencyKey: "order_key_12345678",
  });
  assertEquals(validateSmmOrderInput({ service_id: "service-1", target_url: "https://example.com", quantity: 1 }).ok, false);
});

Deno.test("S07_ORDER_002: unsafe targets and malformed quantities are rejected", () => {
  for (const target_url of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://localhost",
    "https://127.0.0.1",
    "javascript:alert(1)",
  ]) {
    assertEquals(validateSmmOrderInput({ service_id: "s1", target_url, quantity: 1, idempotency_key: "order_key_12345678" }).ok, false);
  }
  for (const quantity of [0, -1, 1.2, Infinity, "NaN", "1e9"]) {
    assertEquals(validateSmmOrderInput({ service_id: "s1", target_url: "https://example.com", quantity, idempotency_key: "order_key_12345678" }).ok, false);
  }
});

Deno.test("S07_ORDER_003: pricing rejects non-positive margin and invalid amounts", () => {
  assertEquals(validateSmmOrderPricing({ sellingPrice: 2, providerCost: 2, quantity: 1000 }), { ok: false, code: "NON_POSITIVE_MARGIN" });
  assertEquals(validateSmmOrderPricing({ sellingPrice: 1, providerCost: 2, quantity: 1000 }).ok, false);
  assertEquals(validateSmmOrderPricing({ sellingPrice: Infinity, providerCost: 0.1, quantity: 1000 }).ok, false);
  assertEquals(validateSmmOrderPricing({ sellingPrice: 10, providerCost: 2, quantity: 1000 }), { ok: true, charged: 10, cost: 2, profit: 8 });
});

Deno.test("S07_ORDER_004: money normalization enforces bounds and cents precision", () => {
  assertEquals(normalizeSmmMoney("12.34", false), 12.34);
  assertEquals(normalizeSmmMoney("0", true), 0);
  for (const amount of ["-1", "01", "1.234", "1e4", "1000000001", NaN, Infinity]) {
    assertEquals(normalizeSmmMoney(amount, true), null);
  }
});


Deno.test("S07_ORDER_005: malformed idempotency keys and oversized identifiers are rejected", () => {
  for (const idempotency_key of ["", "short", "contains spaces 123", "key.with.dots.123", "x".repeat(129)]) {
    assertEquals(validateSmmOrderInput({
      service_id: "service-1",
      target_url: "https://example.com/profile",
      quantity: 10,
      idempotency_key,
    }).ok, false);
  }
  assertEquals(validateSmmOrderInput({
    service_id: "s".repeat(129),
    target_url: "https://example.com/profile",
    quantity: 10,
    idempotency_key: "order_key_12345678",
  }).ok, false);
});

Deno.test("S07_ORDER_006: pricing rejects rounded zero charge and overflow outcomes", () => {
  assertEquals(validateSmmOrderPricing({
    sellingPrice: 0.001, providerCost: 0, quantity: 1,
  }).ok, false);
  assertEquals(validateSmmOrderPricing({
    sellingPrice: Number.MAX_VALUE, providerCost: 0, quantity: Number.MAX_SAFE_INTEGER,
  }).ok, false);
});

Deno.test("S07_ORDER_007: local, reserved, IPv6, and oversized target URLs are rejected", () => {
  const invalidTargets = [
    "https://host.local",
    "https://host.internal",
    "https://host.localhost",
    "https://host.example",
    "https://[::1]/profile",
    "https://example.com/" + "x".repeat(2049),
  ];
  for (const target_url of invalidTargets) {
    assertEquals(validateSmmOrderInput({
      service_id: "service-1",
      target_url,
      quantity: 1,
      idempotency_key: "order_key_12345678",
    }).ok, false);
  }
});

Deno.test("S07_ORDER_008: quantities beyond safe integer range and malformed service IDs fail closed", () => {
  for (const input of [
    { service_id: "", quantity: 1 },
    { service_id: "x".repeat(129), quantity: 1 },
    { service_id: "service-1", quantity: Number.MAX_SAFE_INTEGER + 1 },
    { service_id: "service-1", quantity: "999999999999999" },
  ]) {
    assertEquals(validateSmmOrderInput({
      ...input,
      target_url: "https://example.com/profile",
      idempotency_key: "order_key_12345678",
    }).ok, false);
  }
});
