import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createApiHandler } from "./index.ts";

type DbResult = { data: any; error: { message?: string } | null };

function requireOk(label: string, result: DbResult) {
  if (result.error) throw new Error(`${label}: ${result.error.message ?? "unknown database error"}`);
  return result.data;
}

Deno.test("API catalog and payment idempotency against disposable Supabase", async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceRoleKey || !anonKey) throw new Error("Disposable Supabase credentials are missing");

  const parsedUrl = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname)) {
    throw new Error(`refusing to seed non-local Supabase host: ${parsedUrl.hostname}`);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const suffix = crypto.randomUUID();
  const email = `api-integration-${suffix}@example.test`;
  const password = `MantiqatiX-${crypto.randomUUID()}-A9!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`create disposable auth user failed: ${created.error?.message ?? "missing user"}`);
  const userId = created.data.user.id;
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session?.access_token) {
    throw new Error(`sign in disposable auth user failed: ${signedIn.error?.message ?? "missing access token"}`);
  }
  const token = signedIn.data.session.access_token;

  // Reuse the official, already-active disposable-chain showcase businesses.
  // This avoids bypassing the legal business-activation gate in test setup.
  const tenantId = "MNTY-PLATFORM";
  const businessAResult = await admin.from("businesses").select("id,tenant_id,code,status").eq("code", "MNTY-FOOD").single();
  const businessBResult = await admin.from("businesses").select("id,tenant_id,code,status").eq("code", "MNTY-HEALTH").single();
  const businessA = requireOk("read existing active showcase business A", businessAResult);
  const businessB = requireOk("read existing active showcase business B", businessBResult);
  if (!businessA || !businessB || businessA.status !== "ACTIVE" || businessB.status !== "ACTIVE") {
    throw new Error("required active showcase businesses are missing from disposable migration replay");
  }
  if (businessA.tenant_id !== tenantId || businessB.tenant_id !== tenantId) {
    throw new Error("showcase business tenant differs from expected platform tenant");
  }

  const branchA = `api-branch-a-${suffix}`;
  const branchB = `api-branch-b-${suffix}`;
  const crossBusinessBranch = `api-cross-${suffix}`;
  const sharedItemId = crypto.randomUUID();
  const branchItemId = crypto.randomUUID();
  const orderA = crypto.randomUUID();
  const orderB = crypto.randomUUID();

  requireOk("insert test customer membership", await admin.from("user_memberships").insert({
    id: `api-it-member-${suffix}`, user_id: userId, tenant_id: tenantId, role: "CUSTOMER", permissions: [], status: "ACTIVE",
  }));
  requireOk("insert disposable catalog branches", await admin.from("branches").insert([
    { id: branchA, tenant_id: tenantId, business_id: businessA.id, name: "API Test Branch A", code: `API-A-${suffix}`, status: "ACTIVE" },
    { id: branchB, tenant_id: tenantId, business_id: businessA.id, name: "API Test Branch B", code: `API-B-${suffix}`, status: "ACTIVE" },
    { id: crossBusinessBranch, tenant_id: tenantId, business_id: businessB.id, name: "API Cross Business Branch", code: `API-X-${suffix}`, status: "ACTIVE" },
  ]));
  requireOk("insert disposable catalog items", await admin.from("catalog_items").insert([
    { id: sharedItemId, tenant_id: tenantId, business_id: businessA.id, branch_id: null, name_ar: `API shared ${suffix}`, status: "ACTIVE" },
    { id: branchItemId, tenant_id: tenantId, business_id: businessA.id, branch_id: branchA, name_ar: `API branch ${suffix}`, status: "ACTIVE" },
  ]));
  requireOk("insert disposable catalog prices", await admin.from("catalog_item_prices").insert([
    { id: crypto.randomUUID(), tenant_id: tenantId, catalog_item_id: sharedItemId, branch_id: null, currency: "EGP", unit_price: 10, version: 1, status: "ACTIVE" },
    { id: crypto.randomUUID(), tenant_id: tenantId, catalog_item_id: branchItemId, branch_id: branchA, currency: "EGP", unit_price: 12, version: 1, status: "ACTIVE" },
    { id: crypto.randomUUID(), tenant_id: tenantId, catalog_item_id: branchItemId, branch_id: branchB, currency: "EGP", unit_price: 99, version: 1, status: "ACTIVE" },
  ]));

  const configuredMethod = await admin.from("tenant_payment_methods").select("id")
    .eq("tenant_id", tenantId).eq("provider", "CASH_ON_DELIVERY")
    .eq("payment_method", "CASH_ON_DELIVERY").eq("is_enabled", true).limit(1).maybeSingle();
  if (!configuredMethod.data) {
    requireOk("enable disposable COD payment method", await admin.from("tenant_payment_methods").insert({
      tenant_id: tenantId, provider: "CASH_ON_DELIVERY", payment_method: "CASH_ON_DELIVERY", is_enabled: true,
    }));
  }
  requireOk("insert disposable orders", await admin.from("orders").insert([
    { id: orderA, tenant_id: tenantId, business_id: businessA.id, branch_id: branchA, customer_id: userId, total_amount: 125.5, currency: "EGP", status: "NEW" },
    { id: orderB, tenant_id: tenantId, business_id: businessB.id, branch_id: crossBusinessBranch, customer_id: userId, total_amount: 125.5, currency: "EGP", status: "NEW" },
  ]));

  const handler = createApiHandler();
  const send = (path: string, method = "GET", body?: unknown) => handler(new Request(`${url.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Origin: "https://islamnagy2022-eng.github.io",
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));

  const catalogResponse = await send(`/api/v1/catalog?businessId=${businessA.id}&branchId=${encodeURIComponent(branchA)}`);
  const catalogBody = await catalogResponse.json();
  if (catalogResponse.status !== 200) throw new Error(`catalog request failed: ${catalogResponse.status} ${JSON.stringify(catalogBody)}`);
  const priceIds = (catalogBody.prices ?? []).map((price: { id: string }) => price.id);
  const allPrices = requireOk("read fixture prices", await admin.from("catalog_item_prices").select("id,branch_id,catalog_item_id").eq("tenant_id", tenantId).in("catalog_item_id", [sharedItemId, branchItemId]));
  const branchBPriceId = allPrices.find((row: { id: string; branch_id: string | null }) => row.branch_id === branchB)?.id;
  if (!priceIds.some((id: string) => allPrices.some((row: { id: string; catalog_item_id: string }) => row.id === id && row.catalog_item_id === sharedItemId))) {
    throw new Error("catalog response omitted shared branch-independent price");
  }
  if (priceIds.length !== 2 || priceIds.includes(branchBPriceId)) {
    throw new Error(`catalog response leaked or omitted branch prices: ${priceIds.join(",")}`);
  }

  const crossBusinessResponse = await send(`/api/v1/catalog?businessId=${businessA.id}&branchId=${encodeURIComponent(crossBusinessBranch)}`);
  if (crossBusinessResponse.status !== 404) throw new Error(`cross-business branch must be rejected, got ${crossBusinessResponse.status}`);

  const concurrentSameKey = `same-${suffix}`;
  const sameKeyResponses = await Promise.all([
    send("/api/v1/payments/intents", "POST", { orderId: orderA, provider: "CASH_ON_DELIVERY", idempotencyKey: concurrentSameKey }),
    send("/api/v1/payments/intents", "POST", { orderId: orderA, provider: "CASH_ON_DELIVERY", idempotencyKey: concurrentSameKey }),
  ]);
  const sameStatuses = sameKeyResponses.map((r) => r.status).sort((a, b) => a - b);
  if (sameStatuses[0] !== 200 || sameStatuses[1] !== 201) {
    throw new Error(`same-order concurrent idempotency should yield one 201 and one 200, got ${sameStatuses.join(",")}`);
  }
  const sameKeyRows = requireOk("read same-key intents", await admin.from("payment_intents").select("id,order_id").eq("tenant_id", tenantId).eq("idempotency_key", concurrentSameKey));
  if (sameKeyRows.length !== 1 || sameKeyRows[0].order_id !== orderA) throw new Error("same-order concurrent requests did not persist exactly one matching intent");

  const crossOrderKey = `cross-${suffix}`;
  const crossOrderResponses = await Promise.all([
    send("/api/v1/payments/intents", "POST", { orderId: orderA, provider: "CASH_ON_DELIVERY", idempotencyKey: crossOrderKey }),
    send("/api/v1/payments/intents", "POST", { orderId: orderB, provider: "CASH_ON_DELIVERY", idempotencyKey: crossOrderKey }),
  ]);
  const crossStatuses = crossOrderResponses.map((r) => r.status).sort((a, b) => a - b);
  if (crossStatuses[0] !== 201 || crossStatuses[1] !== 409) {
    throw new Error(`cross-order concurrent key reuse should yield one 201 and one 409, got ${crossStatuses.join(",")}`);
  }
  const crossKeyRows = requireOk("read cross-order intents", await admin.from("payment_intents").select("id,order_id").eq("tenant_id", tenantId).eq("idempotency_key", crossOrderKey));
  if (crossKeyRows.length !== 1) throw new Error(`unique idempotency constraint persisted ${crossKeyRows.length} rows instead of one`);
});
