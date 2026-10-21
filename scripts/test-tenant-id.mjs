import test from "node:test";
import assert from "node:assert/strict";
import { isValidTenantId } from "../supabase/functions/_shared/tenant-id.mjs";

test("accepts varchar tenant identifiers including platform and UUID-like keys", () => {
  for (const value of [
    "MNTY-PLATFORM", "tenant-a", "tenant_2026",
    "10000000-0000-4000-8000-000000000001",
    "  MNTY-PLATFORM  ",
  ]) assert.equal(isValidTenantId(value), true, value);
});

test("rejects empty, oversized, non-string, and filter-syntax tenant identifiers", () => {
  for (const value of [
    "", "   ", "tenant.a", "tenant,a", "tenant/a", "tenant\\n",
    "tenant a", "-tenant", "_tenant", "a".repeat(129), null, undefined, 42, {},
  ]) assert.equal(isValidTenantId(value), false, String(value));
});
