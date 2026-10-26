import { createApiHandler } from "./index.ts";

type Row = Record<string, unknown>;
type QueryState = {
  table: string;
  filters: Array<{ op: string; column: string; value: unknown }>;
  payload?: unknown;
};

class FakeQuery {
  state: QueryState;
  db: FakeDatabase;
  constructor(table: string, db: FakeDatabase) {
    this.state = { table, filters: [] };
    this.db = db;
  }
  select(_columns?: string) { return this; }
  eq(column: string, value: unknown) { this.state.filters.push({ op: "eq", column, value }); return this; }
  is(column: string, value: unknown) { this.state.filters.push({ op: "is", column, value }); return this; }
  in(column: string, value: unknown) { this.state.filters.push({ op: "in", column, value }); return this; }
  lte(column: string, value: unknown) { this.state.filters.push({ op: "lte", column, value }); return this; }
  or(value: string) { this.state.filters.push({ op: "or", column: "", value }); return this; }
  order(_column: string, _options?: unknown) { return this; }
  limit(_count: number) { return this; }
  insert(payload: unknown) { this.state.payload = payload; return this; }
  single() { return Promise.resolve(this.db.resolve(this.state, "single")); }
  maybeSingle() { return Promise.resolve(this.db.resolve(this.state, "single")); }
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.db.resolve(this.state, "many")).then(resolve, reject);
  }
}

class FakeDatabase {
  mode: "catalog" | "payments" | "orders";
  existingIntent: Row | null;
  raceOnInsert: Row | null;
  queryLog: QueryState[] = [];
  orderReadMembership: Row = {
    id: "membership-a",
    user_id: "user-a",
    tenant_id: "tenant-a",
    status: "ACTIVE",
    role: "OWNER",
    permissions: [],
    business_id: "business-a",
    branch_id: "branch-a",
  };
  constructor(mode: "catalog" | "payments" | "orders", existingIntent: Row | null = null, raceOnInsert: Row | null = null) {
    this.mode = mode;
    this.existingIntent = existingIntent;
    this.raceOnInsert = raceOnInsert;
  }
  from(table: string) { return new FakeQuery(table, this); }
  async rpc(_name: string, _args: unknown) { return { data: {}, error: null }; }
  auth = { getUser: async (_token: string) => ({ data: { user: { id: "user-a", is_anonymous: false } }, error: null }) };

  resolve(state: QueryState, cardinality: "single" | "many") {
    this.queryLog.push({ ...state, filters: [...state.filters] });
    if (state.table === "payment_intents" && state.payload !== undefined) {
      if (this.raceOnInsert) {
        const raced = this.raceOnInsert;
        this.raceOnInsert = null;
        this.existingIntent = raced;
        return { data: null, error: { code: "23505" } };
      }
      const inserted = state.payload as Row;
      this.existingIntent = inserted;
      return { data: inserted, error: null };
    }
    const value = (column: string) => state.filters.find((f) => f.op === "eq" && f.column === column)?.value;
    const isNull = (column: string) => state.filters.some((f) => f.op === "is" && f.column === column && f.value === null);
    let rows: Row[] = [];
    if (state.table === "businesses") {
      rows = [{ id: "business-a", tenant_id: "tenant-a", status: "ACTIVE" }];
    } else if (state.table === "user_memberships") {
      rows = this.mode === "orders"
        ? [this.orderReadMembership]
        : [{ id: "membership-a", user_id: "user-a", tenant_id: "tenant-a", status: "ACTIVE", role: "CUSTOMER", permissions: [], business_id: null }];
    } else if (state.table === "marketing_provider_profiles") {
      rows = [{ id: "provider-a", business_id: "business-a", status: "ACTIVE" }];
    } else if (state.table === "branches") {
      rows = [{ id: "branch-a", business_id: "business-a", name: "Branch A", code: "A", status: "ACTIVE", address: "", phone: "" }];
      if (value("id") === "branch-b") rows = [];
    } else if (state.table === "catalog_items") {
      if (isNull("branch_id")) rows = [{ id: "item-shared", tenant_id: "tenant-a", business_id: "business-a", branch_id: null, name_ar: "مشترك", status: "ACTIVE" }];
      else if (value("branch_id") === "branch-a") rows = [{ id: "item-a", tenant_id: "tenant-a", business_id: "business-a", branch_id: "branch-a", name_ar: "فرع أ", status: "ACTIVE" }];
      else rows = [];
    } else if (state.table === "catalog_item_prices") {
      if (isNull("branch_id")) rows = [{ id: "price-shared", tenant_id: "tenant-a", catalog_item_id: "item-shared", branch_id: null, currency: "EGP", unit_price: 10, version: 1, status: "ACTIVE" }];
      else if (value("branch_id") === "branch-a") rows = [{ id: "price-a", tenant_id: "tenant-a", catalog_item_id: "item-a", branch_id: "branch-a", currency: "EGP", unit_price: 12, version: 1, status: "ACTIVE" }];
      else if (value("branch_id") === "branch-b") rows = [{ id: "price-b", tenant_id: "tenant-a", catalog_item_id: "item-a", branch_id: "branch-b", currency: "EGP", unit_price: 99, version: 1, status: "ACTIVE" }];
    } else if (state.table === "catalog_item_options") {
      rows = [];
    } else if (state.table === "orders" && this.mode === "orders") {
      const orderFixtures: Row[] = [
        { id: "order-a", tenant_id: "tenant-a", business_id: "business-a", branch_id: "branch-a", total: 125.5, currency: "EGP", customer_id: "customer-other" },
        { id: "order-b", tenant_id: "tenant-a", business_id: "business-b", branch_id: "branch-b", total: 82, currency: "EGP", customer_id: "customer-other" },
        { id: "order-c", tenant_id: "tenant-a", business_id: "business-a", branch_id: "branch-b", total: 47, currency: "EGP", customer_id: "customer-other" },
      ];
      rows = orderFixtures.filter((row) => String(row.id) === String(value("id")));
    } else if (state.table === "orders" && this.mode === "payments") {
      rows = [{ id: "order-a", tenant_id: "tenant-a", total: 125.5, currency: "EGP", customer_id: "user-a" }];
    } else if (state.table === "tenant_payment_methods") {
      rows = [{ id: "method-a", tenant_id: "tenant-a", payment_method: "CASH_ON_DELIVERY", provider: "CASH_ON_DELIVERY", is_enabled: true }];
    } else if (state.table === "payment_intents") {
      rows = this.existingIntent ? [this.existingIntent] : [];
    }
    const selected = rows.filter((row) => state.filters.every((filter) => {
      if (filter.op === "eq") return String(row[filter.column] ?? "") === String(filter.value ?? "");
      if (filter.op === "is") return filter.value === null ? row[filter.column] == null : row[filter.column] === filter.value;
      if (filter.op === "in") return Array.isArray(filter.value) && filter.value.some((v) => String(v) === String(row[filter.column]));
      if (filter.op === "lte") return String(row[filter.column] ?? "") <= String(filter.value);
      return true;
    }));
    if (cardinality === "single") return { data: selected[0] ?? null, error: null };
    return { data: selected, error: null };
  }
}

function makeHandler(db: FakeDatabase) {
  return createApiHandler({
    createClientFn: () => db,
    env: { get: (name: string) => name === "SUPABASE_URL" ? "https://example.supabase.co" : "test-service-role" },
  });
}

function request(path: string, method = "GET", body?: unknown) {
  return new Request(`https://api.test${path}`, {
    method,
    headers: {
      Origin: "https://islamnagy2022-eng.github.io",
      Authorization: "Bearer test-token",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

Deno.test("catalog route returns shared and selected-branch prices only", async () => {
  const db = new FakeDatabase("catalog");
  const response = await makeHandler(db)(request("/api/v1/catalog?businessId=business-a&branchId=branch-a"));
  const body = await response.json();
  if (response.status !== 200) throw new Error(`expected 200, got ${response.status}: ${JSON.stringify(body)}`);
  const priceIds = body.prices.map((price: Row) => price.id).sort();
  if (priceIds.join(",") !== "price-a,price-shared") throw new Error(`unexpected price IDs: ${priceIds.join(",")}`);
  if (priceIds.includes("price-b")) throw new Error("cross-branch price override leaked into catalog response");
  const branchFilters = db.queryLog.filter((q) => q.table === "catalog_item_prices").flatMap((q) => q.filters);
  if (!branchFilters.some((f) => f.op === "is" && f.column === "branch_id" && f.value === null)) throw new Error("shared-price query did not use IS NULL");
  if (!branchFilters.some((f) => f.op === "eq" && f.column === "branch_id" && f.value === "branch-a")) throw new Error("branch-price query did not use exact selected-branch equality");
});

Deno.test("catalog route rejects a branch not owned by the selected business", async () => {
  const db = new FakeDatabase("catalog");
  const response = await makeHandler(db)(request("/api/v1/catalog?businessId=business-a&branchId=branch-b"));
  if (response.status !== 404) throw new Error(`expected 404 for cross-business branch, got ${response.status}`);
});

Deno.test("order reads require matching business and branch scope", async () => {
  const db = new FakeDatabase("orders");
  const ownScope = await makeHandler(db)(request("/api/v1/orders/order-a"));
  if (ownScope.status !== 200) throw new Error(`same-business/same-branch read should pass, got ${ownScope.status}`);

  const otherBusiness = await makeHandler(db)(request("/api/v1/orders/order-b"));
  if (otherBusiness.status !== 403) throw new Error(`cross-business read should be denied, got ${otherBusiness.status}`);

  const otherBranch = await makeHandler(db)(request("/api/v1/orders/order-c"));
  if (otherBranch.status !== 403) throw new Error(`cross-branch read should be denied, got ${otherBranch.status}`);
});

Deno.test("business-wide membership can read all branches of its own business but not another business", async () => {
  const db = new FakeDatabase("orders");
  db.orderReadMembership = { ...db.orderReadMembership, branch_id: null };
  const sameBusinessOtherBranch = await makeHandler(db)(request("/api/v1/orders/order-c"));
  if (sameBusinessOtherBranch.status !== 200) {
    throw new Error(`business-wide membership should read same-business branch orders, got ${sameBusinessOtherBranch.status}`);
  }

  const otherBusiness = await makeHandler(db)(request("/api/v1/orders/order-b"));
  if (otherBusiness.status !== 403) {
    throw new Error(`business-wide membership must not read another business, got ${otherBusiness.status}`);
  }
});


Deno.test("payment-intent route replays the same identity but rejects a key bound to another order", async () => {
  const intent: Row = {
    id: "intent-a", tenant_id: "tenant-a", order_id: "order-a", amount: 125.5, currency: "EGP",
    status: "CREATED", provider: "CASH_ON_DELIVERY", payment_method: "CASH_ON_DELIVERY", idempotency_key: "key-a",
  };
  const replayDb = new FakeDatabase("payments", intent);
  const replay = await makeHandler(replayDb)(request("/api/v1/payments/intents", "POST", {
    orderId: "order-a", provider: "CASH_ON_DELIVERY", idempotencyKey: "key-a",
  }));
  const replayBody = await replay.json();
  if (replay.status !== 200 || replayBody.idempotent !== true) throw new Error("same-identity idempotent replay was not returned");

  const conflictDb = new FakeDatabase("payments", { ...intent, order_id: "another-order" });
  const conflict = await makeHandler(conflictDb)(request("/api/v1/payments/intents", "POST", {
    orderId: "order-a", provider: "CASH_ON_DELIVERY", idempotencyKey: "key-a",
  }));
  const conflictBody = await conflict.json();
  if (conflict.status !== 409 || conflictBody.error !== "IDEMPOTENCY_CONFLICT") throw new Error("reusing a key for another order must return 409");
});


Deno.test("payment-intent route safely rereads a concurrent idempotency-key winner", async () => {
  const winner: Row = {
    id: "intent-winner", tenant_id: "tenant-a", order_id: "order-a", amount: 125.5, currency: "EGP",
    status: "CREATED", provider: "CASH_ON_DELIVERY", payment_method: "CASH_ON_DELIVERY", idempotency_key: "key-race",
  };
  const db = new FakeDatabase("payments", null, winner);
  const response = await makeHandler(db)(request("/api/v1/payments/intents", "POST", {
    orderId: "order-a", provider: "CASH_ON_DELIVERY", idempotencyKey: "key-race",
  }));
  const body = await response.json();
  if (response.status !== 200 || body.id !== "intent-winner" || body.idempotent !== true) {
    throw new Error("concurrent unique-key winner was not reread and returned safely");
  }

  const conflictingDb = new FakeDatabase("payments", null, { ...winner, order_id: "other-order" });
  const conflictingResponse = await makeHandler(conflictingDb)(request("/api/v1/payments/intents", "POST", {
    orderId: "order-a", provider: "CASH_ON_DELIVERY", idempotencyKey: "key-race",
  }));
  const conflictingBody = await conflictingResponse.json();
  if (conflictingResponse.status !== 409 || conflictingBody.error !== "IDEMPOTENCY_CONFLICT") {
    throw new Error("concurrent key winner with a different order must be rejected");
  }
});


Deno.test("order and payment routes reject idempotency keys longer than database varchar(128)", async () => {
  const db = new FakeDatabase("payments");
  const tooLong = "k".repeat(129);
  const paymentResponse = await makeHandler(db)(request("/api/v1/payments/intents", "POST", {
    orderId: "order-a", provider: "CASH_ON_DELIVERY", idempotencyKey: tooLong,
  }));
  if (paymentResponse.status !== 400) throw new Error(`payment key >128 should return 400, got ${paymentResponse.status}`);

  const orderResponse = await makeHandler(db)(request("/api/v1/orders", "POST", {
    orderId: "00000000-0000-4000-8000-000000000001",
    tenantId: "tenant-a",
    businessId: "00000000-0000-4000-8000-000000000002",
    branchId: "branch-a",
    clientIdempotencyKey: tooLong,
    items: [{ catalogItemId: "item-a", quantity: 1 }],
  }));
  if (orderResponse.status !== 400) throw new Error(`order key >128 should return 400, got ${orderResponse.status}`);
  if (db.queryLog.length !== 0) throw new Error("oversized idempotency keys must be rejected before database queries");

  const blankKeyResponse = await makeHandler(db)(request("/api/v1/orders", "POST", {
    orderId: "00000000-0000-4000-8000-000000000001",
    tenantId: "tenant-a",
    businessId: "00000000-0000-4000-8000-000000000002",
    branchId: "branch-a",
    clientIdempotencyKey: "   ",
    items: [{ catalogItemId: "item-a", quantity: 1 }],
  }));
  if (blankKeyResponse.status !== 400) throw new Error(`blank order key should return 400, got ${blankKeyResponse.status}`);
  if (db.queryLog.length !== 0) throw new Error("blank idempotency keys must be rejected before database queries");
});
