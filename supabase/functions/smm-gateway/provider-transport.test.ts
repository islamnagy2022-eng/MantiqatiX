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


import { normalizeProviderOrderStatus } from "./order-status.ts";

Deno.test("provider completed status is normalized", () => {
  if (normalizeProviderOrderStatus("PROCESSING", " completed ") !== "COMPLETED") throw new Error("completed status not normalized");
  if (normalizeProviderOrderStatus("PROCESSING", "complete") !== "COMPLETED") throw new Error("complete alias not normalized");
});

Deno.test("provider terminal states cannot regress", () => {
  for (const current of ["COMPLETED", "CANCELLED", "FAILED", "PARTIAL"]) {
    if (normalizeProviderOrderStatus(current, "processing") !== current) throw new Error("terminal state regressed: " + current);
    if (normalizeProviderOrderStatus(current, "completed") !== current) throw new Error("terminal state changed: " + current);
  }
});

Deno.test("provider status aliases map to known terminal and processing states", () => {
  const cases = [
    ["PROCESSING", "partial", "PARTIAL"],
    ["PROCESSING", "cancelled", "CANCELLED"],
    ["PROCESSING", "canceled", "CANCELLED"],
    ["PROCESSING", "failed", "FAILED"],
    ["PENDING", "in progress", "PROCESSING"],
    ["PENDING", "inprogress", "PROCESSING"],
    ["PENDING", "unknown-provider-state", "PENDING"]
  ] as const;
  for (const [current, incoming, expected] of cases) {
    if (normalizeProviderOrderStatus(current, incoming) !== expected) throw new Error(`unexpected mapping for ${incoming}`);
  }
});
