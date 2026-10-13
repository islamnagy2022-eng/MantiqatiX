import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeProviderOrderStatus } from "./order-status.ts";

Deno.test("S07_STATUS_001: terminal states cannot be overwritten", () => {
  for (const terminal of ["COMPLETED", "CANCELLED", "FAILED", "PARTIAL"]) {
    assertEquals(normalizeProviderOrderStatus(terminal, "processing"), terminal);
  }
});

Deno.test("S07_STATUS_002: known provider states normalize consistently", () => {
  assertEquals(normalizeProviderOrderStatus("SUBMITTING", "complete"), "COMPLETED");
  assertEquals(normalizeProviderOrderStatus("PROCESSING", "partial"), "PARTIAL");
  assertEquals(normalizeProviderOrderStatus("PROCESSING", "canceled"), "CANCELLED");
  assertEquals(normalizeProviderOrderStatus("PROCESSING", "error"), "FAILED");
  assertEquals(normalizeProviderOrderStatus("SUBMITTING", "in progress"), "PROCESSING");
});

Deno.test("S07_STATUS_003: unknown provider status preserves current state", () => {
  assertEquals(normalizeProviderOrderStatus("PROCESSING", "unexpected-state"), "PROCESSING");
  assertEquals(normalizeProviderOrderStatus("SUBMITTING", null), "SUBMITTING");
});
