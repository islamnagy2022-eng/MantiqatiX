import { assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertSafeProviderEndpoint, normalizeProviderBalance, readProviderJson } from "./provider-transport.ts";

Deno.test("S07_PROVIDER_001A: allowlisted HTTPS hostname is accepted", () => {
  const endpoint = assertSafeProviderEndpoint("https://api.provider.com/v2", "api.provider.com");
  assertEquals(endpoint.hostname, "api.provider.com");
});

Deno.test("S07_PROVIDER_001B: unlisted hostname is rejected", () => {
  assertThrows(() => assertSafeProviderEndpoint("https://evil.example/api", "api.provider.com"));
});

Deno.test("S07_PROVIDER_001C: non-HTTPS provider endpoint is rejected", () => {
  assertThrows(() => assertSafeProviderEndpoint("http://api.provider.com", "api.provider.com"));
});

Deno.test("S07_PROVIDER_001D: credentials in provider URL are rejected", () => {
  assertThrows(() => assertSafeProviderEndpoint("https://user:pass@api.provider.com", "api.provider.com"));
});

Deno.test("S07_PROVIDER_001E: non-standard provider port is rejected", () => {
  assertThrows(() => assertSafeProviderEndpoint("https://api.provider.com:8443", "api.provider.com"));
});

Deno.test("S07_PROVIDER_002: private, local, and IP literal hosts are rejected", () => {
  for (const endpoint of [
    "https://localhost",
    "https://host.local",
    "https://host.internal",
    "https://127.0.0.1",
    "https://192.168.1.1",
    "https://[::1]",
  ]) {
    assertThrows(() => assertSafeProviderEndpoint(endpoint, new URL(endpoint).hostname));
  }
});

Deno.test("S07_PROVIDER_003: empty allowlist fails closed", () => {
  assertThrows(() => assertSafeProviderEndpoint("https://api.provider.com", undefined));
  assertThrows(() => assertSafeProviderEndpoint("https://api.provider.com", " , "));
});

Deno.test("S07_PROVIDER_004: provider response requires JSON content type and successful status", async () => {
  await assertRejects(() => readProviderJson(new Response("no", { status: 502, headers: { "content-type": "application/json" } })));
  await assertRejects(() => readProviderJson(new Response("{}", { headers: { "content-type": "text/plain" } })));
  assertEquals(await readProviderJson(new Response('{"ok":true}', { headers: { "content-type": "application/json" } })), { ok: true });
});

Deno.test("S07_PROVIDER_005: invalid JSON and oversized response are rejected", async () => {
  await assertRejects(() => readProviderJson(new Response("{", { headers: { "content-type": "application/json" } })));
  await assertRejects(() => readProviderJson(new Response('{"long":"123456"}', { headers: { "content-type": "application/json" } }), 8));
});

Deno.test("S07_PROVIDER_006: provider balance must be finite and non-negative", () => {
  assertEquals(normalizeProviderBalance({ balance: "12.345", currency: "usd" }), { balance: 12.35, currency: "USD" });
  assertEquals(normalizeProviderBalance({ balance: "NaN" }), null);
  assertEquals(normalizeProviderBalance({ balance: -1 }), null);
  assertEquals(normalizeProviderBalance(null), null);
});


Deno.test("S07_PROVIDER_007: empty bodies and invalid UTF-8 are rejected", async () => {
  await assertRejects(() => readProviderJson(new Response(null, {
    headers: { "content-type": "application/json" },
  })));
  const invalidUtf8 = new Response(new Uint8Array([0xff, 0xfe]), {
    headers: { "content-type": "application/json" },
  });
  await assertRejects(() => readProviderJson(invalidUtf8));
});

Deno.test("S07_PROVIDER_008: structured JSON media types are accepted", async () => {
  assertEquals(await readProviderJson(new Response('{"ok":true}', {
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  })), { ok: true });
});
