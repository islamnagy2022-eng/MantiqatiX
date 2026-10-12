import { assertSafeProviderEndpoint, readProviderJson } from "./provider-transport.ts";

Deno.test("provider endpoint requires an explicit exact hostname allowlist", () => {
  for (const [url, allowlist] of [
    ["https://provider.example/api", undefined],
    ["https://provider.example/api", ""],
    ["https://evil.example/api", "provider.example"],
    ["http://provider.example/api", "provider.example"],
    ["https://user:pass@provider.example/api", "provider.example"],
    ["https://provider.example:8443/api", "provider.example"],
    ["https://localhost/api", "localhost"],
    ["https://127.0.0.1/api", "127.0.0.1"],
    ["https://provider.example./api", "other.example"]
  ] as const) {
    let rejected = false;
    try { assertSafeProviderEndpoint(url, allowlist); } catch { rejected = true; }
    if (!rejected) throw new Error("Unsafe provider URL was accepted: " + url);
  }
});

Deno.test("provider endpoint accepts an explicitly allowed HTTPS hostname", () => {
  const url = assertSafeProviderEndpoint("https://provider.example/v2", "other.example, provider.example");
  if (url.hostname !== "provider.example" || url.protocol !== "https:") throw new Error("Allowed endpoint parsed incorrectly");
});

Deno.test("provider response parser accepts bounded JSON", async () => {
  const result = await readProviderJson(new Response('{"order":123}', { status: 200 }));
  if ((result as {order?: number}).order !== 123) throw new Error("Expected parsed provider JSON");
});

Deno.test("provider response parser rejects invalid JSON", async () => {
  let rejected = false;
  try { await readProviderJson(new Response("not-json", { status: 200 })); } catch { rejected = true; }
  if (!rejected) throw new Error("Invalid provider JSON was accepted");
});

Deno.test("provider response parser enforces response size limit", async () => {
  let rejected = false;
  try { await readProviderJson(new Response('{"long":"0123456789"}', { status: 200 }), 8); } catch { rejected = true; }
  if (!rejected) throw new Error("Oversized provider response was accepted");
});
