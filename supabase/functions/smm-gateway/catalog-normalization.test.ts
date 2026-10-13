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
