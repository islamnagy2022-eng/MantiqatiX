import assert from "node:assert/strict";
import test from "node:test";
import { deduplicateSubscriberMemberships } from "./subscriber-membership-dedupe.mjs";

const membership = (overrides = {}) => ({
  id: "membership-1",
  user_id: "user-1",
  tenant_id: "tenant-1",
  organization_id: "org-1",
  business_id: "business-1",
  branch_id: null,
  role: "OWNER",
  status: "ACTIVE",
  permissions: { catalog: "manage", orders: "view" },
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("removes exact-scope duplicates and prefers ACTIVE over a newer inactive row", () => {
  const inactive = membership({
    id: "inactive",
    status: "INACTIVE",
    created_at: "2026-05-01T00:00:00.000Z",
  });
  const active = membership({
    id: "active",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00.000Z",
  });

  const result = deduplicateSubscriberMemberships([inactive, active]);
  assert.deepEqual(result.rows, [active]);
  assert.equal(result.duplicatesRemoved, 1);
});

test("keeps the newest row when duplicate memberships have the same status", () => {
  const older = membership({ id: "older" });
  const newer = membership({
    id: "newer",
    created_at: "2026-02-01T00:00:00.000Z",
  });

  const result = deduplicateSubscriberMemberships([older, newer]);
  assert.deepEqual(result.rows, [newer]);
  assert.equal(result.duplicatesRemoved, 1);
});

test("preserves distinct branch memberships for the same business and role", () => {
  const mainBranch = membership({ id: "main", branch_id: "branch-main" });
  const secondBranch = membership({ id: "second", branch_id: "branch-second" });

  const result = deduplicateSubscriberMemberships([mainBranch, secondBranch]);
  assert.deepEqual(result.rows, [mainBranch, secondBranch]);
  assert.equal(result.duplicatesRemoved, 0);
});

test("preserves different tenants, organizations, businesses, roles, and permission scopes", () => {
  const base = membership();
  const variants = [
    membership({ id: "tenant", tenant_id: "tenant-2" }),
    membership({ id: "organization", organization_id: "org-2" }),
    membership({ id: "business", business_id: "business-2" }),
    membership({ id: "role", role: "MANAGER" }),
    membership({ id: "permissions", permissions: { catalog: "view", orders: "view" } }),
  ];

  const result = deduplicateSubscriberMemberships([base, ...variants]);
  assert.equal(result.rows.length, 6);
  assert.equal(result.duplicatesRemoved, 0);
});

test("does not mutate input rows and handles malformed collections safely", () => {
  const row = membership();
  const before = structuredClone(row);
  const result = deduplicateSubscriberMemberships([row, null, "invalid"]);
  assert.deepEqual(row, before);
  assert.deepEqual(result.rows, [row, null, "invalid"]);
  assert.equal(result.duplicatesRemoved, 0);
  assert.deepEqual(deduplicateSubscriberMemberships(null), {
    rows: [],
    duplicatesRemoved: 0,
  });
});
