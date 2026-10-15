import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeProviderService } from "./catalog-normalization.ts";

Deno.test("S07_CATALOG_001: new provider services remain inactive and zero-priced", () => {
  const row = normalizeProviderService({ service: 123, rate: "2.5", min: "10", max: "1000", name: "Example" }, "provider-1");
  assertEquals(row?.selling_price, 0);
  assertEquals(row?.active, false);
  assertEquals(row?.external_service_id, "123");
});

Deno.test("S07_CATALOG_002: existing reviewed price and activation are retained only with margin", () => {
  const safe = normalizeProviderService({ service: "svc", rate: 2, min: 1, max: 100 }, "p1", { selling_price: 5, active: true });
  assertEquals(safe?.selling_price, 5);
  assertEquals(safe?.active, true);
  const unsafe = normalizeProviderService({ service: "svc", rate: 6, min: 1, max: 100 }, "p1", { selling_price: 5, active: true });
  assertEquals(unsafe?.active, false);
});

Deno.test("S07_CATALOG_003: malformed services are rejected and arbitrary metadata is not persisted", () => {
  assertEquals(normalizeProviderService({ service: "svc", rate: "NaN", min: 1, max: 10 }, "p1"), null);
  const row = normalizeProviderService({ service: "svc", rate: 1, min: 1, max: 10, metadata: { secret: "never store" } }, "p1");
  assertEquals(row?.metadata, { provider_service_id: "svc", provider_rate: 1 });
});


Deno.test("S07_CATALOG_004: invalid quantity bounds and negative provider costs are rejected", () => {
  for (const raw of [
    { service: "svc", rate: -1, min: 1, max: 10 },
    { service: "svc", rate: 1, min: 0, max: 10 },
    { service: "svc", rate: 1, min: 10, max: 9 },
    { service: "svc", rate: 1, min: 1.5, max: 10 },
    { service: "svc", rate: 1, min: 1, max: 1_000_000_001 },
  ]) {
    assertEquals(normalizeProviderService(raw, "p1"), null);
  }
});

Deno.test("S07_CATALOG_005: service text is bounded and control characters are removed", () => {
  const row = normalizeProviderService({
    service: "svc",
    rate: 1,
    min: 1,
    max: 10,
    name: "  Safe\u0000 name\n  ",
    description: "x".repeat(1500),
  }, "p1");
  assertEquals(row?.name, "Safe name");
  assertEquals(String(row?.description).length, 1000);
});

Deno.test("S07_CATALOG_006: blank or unsupported provider identifiers are rejected", () => {
  for (const raw of [
    { service: "   ", rate: 1, min: 1, max: 10 },
    { service: {}, rate: 1, min: 1, max: 10 },
    { rate: 1, min: 1, max: 10 },
    { service: "svc", rate: "   ", min: 1, max: 10 },
  ]) {
    assertEquals(normalizeProviderService(raw, "p1"), null);
  }
});

Deno.test("S07_CATALOG_007: zero, equal-cost, negative, and non-finite existing prices never stay active", () => {
  const cases = [
    { selling_price: 0, active: true },
    { selling_price: 2, active: true },
    { selling_price: -1, active: true },
    { selling_price: Number.POSITIVE_INFINITY, active: true },
    { selling_price: "not-a-price", active: true },
  ];
  for (const existing of cases) {
    const row = normalizeProviderService(
      { service: "svc", rate: 2, min: 1, max: 10 },
      "p1",
      existing,
    );
    assertEquals(row?.active, false);
    if (existing.selling_price === -1 || existing.selling_price === Number.POSITIVE_INFINITY || existing.selling_price === "not-a-price") {
      assertEquals(row?.selling_price, 0);
    }
  }
});

Deno.test("S07_CATALOG_008: normalized output contains no unapproved provider fields", () => {
  const row = normalizeProviderService({
    service: "svc",
    rate: 1,
    min: 1,
    max: 10,
    api_key: "secret",
    token: "secret",
    raw_payload: { nested: "secret" },
    extra_field: "not allowlisted",
  }, "p1");
  assertEquals(Object.keys(row ?? {}).sort(), [
    "active", "cancel", "category", "description", "dripfeed",
    "external_service_id", "max_quantity", "metadata", "min_quantity",
    "name", "platform", "provider_cost", "provider_id", "refill",
    "selling_price",
  ].sort());
  assertEquals(JSON.stringify(row).includes("secret"), false);
  assertEquals(JSON.stringify(row).includes("not allowlisted"), false);
});
