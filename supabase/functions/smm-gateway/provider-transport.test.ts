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


import { normalizeProviderService } from "./catalog-normalization.ts";

Deno.test("new provider catalog items require manual price review and stay inactive", () => {
  const row = normalizeProviderService({ id: "svc-1", rate: "3.5", min: "1", max: "500", name: "New service", extra: "not allowed" }, "provider-1");
  if (!row) throw new Error("valid provider service was rejected");
  if (row.selling_price !== 0 || row.active !== false) throw new Error("new provider service was activated or priced automatically");
  if (row.provider_cost !== 3.5) throw new Error("provider cost was not normalized");
  if (JSON.stringify(row.metadata).includes("not allowed")) throw new Error("arbitrary provider metadata was persisted");
});

Deno.test("provider catalog refresh preserves reviewed customer pricing and activation", () => {
  const row = normalizeProviderService({ id: "svc-2", rate: 4, min: 1, max: 100 }, "provider-1", { selling_price: "7.25", active: true });
  if (!row) throw new Error("valid provider service was rejected");
  if (row.selling_price !== 7.25 || row.active !== true) throw new Error("refresh overwrote reviewed price or activation");
  const noMargin = normalizeProviderService({ id: "svc-3", rate: 7.25, min: 1, max: 100 }, "provider-1", { selling_price: 7.25, active: true });
  if (!noMargin || noMargin.selling_price !== 7.25 || noMargin.active !== false) throw new Error("service without positive margin remained active");
});

Deno.test("provider catalog normalization rejects invalid costs and quantity bounds", () => {
  if (normalizeProviderService({ id: "svc", rate: -1, min: 1, max: 10 }, "provider-1")) throw new Error("negative provider cost accepted");
  if (normalizeProviderService({ id: "svc", rate: null, min: 1, max: 10 }, "provider-1")) throw new Error("missing provider cost accepted");
  if (normalizeProviderService({ id: "svc", rate: 1, min: 10, max: 1 }, "provider-1")) throw new Error("inverted quantity bounds accepted");
  const row = normalizeProviderService({ id: "svc", rate: 1, min: 1, max: 10, name: "bad" + String.fromCharCode(0) + "name" }, "provider-1");
  if (!row || String(row.name).includes(String.fromCharCode(0))) throw new Error("control character was not removed");
});
