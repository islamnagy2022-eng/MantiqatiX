import assert from "node:assert/strict";
import test from "node:test";
import { hasSettlementAuthority } from "./authorization.mjs";

const businessOwner = (businessId, overrides = {}) => ({
  tenant_id: "TENANT-A",
  business_id: businessId,
  branch_id: null,
  role: "BUSINESS_OWNER",
  status: "ACTIVE",
  permissions: {},
  ...overrides,
});

const platformAdmin = (overrides = {}) => ({
  tenant_id: "MNTY-PLATFORM",
  business_id: null,
  branch_id: null,
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  permissions: { scope: "PLATFORM", full_control: true },
  ...overrides,
});

test("business owner can settle only the explicitly assigned business", () => {
  const memberships = [businessOwner("business-A")];
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: "business-A", memberships }), true);
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: "business-B", memberships }), false);
});

test("business-level membership cannot authorize tenant-wide settlement", () => {
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: null, memberships: [businessOwner("business-A")] }), false);
});

test("branch-scoped finance membership is rejected without a branch-aware settlement contract", () => {
  const membership = businessOwner("business-A", { role: "ACCOUNTANT", branch_id: "branch-1" });
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: "business-A", memberships: [membership] }), false);
});

test("inactive and cross-tenant memberships are rejected", () => {
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: "business-A", memberships: [businessOwner("business-A", { status: "INACTIVE" })] }), false);
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: "business-A", memberships: [businessOwner("business-A", { tenant_id: "TENANT-B" })] }), false);
});

test("tenant-wide finance role is limited to unscoped tenant membership", () => {
  const membership = { tenant_id: "TENANT-A", business_id: null, branch_id: null, role: "FINANCE_MANAGER", status: "ACTIVE", permissions: {} };
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", memberships: [membership] }), true);
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", memberships: [{ ...membership, business_id: "business-A" }] }), false);
});

test("MNTY-PLATFORM tenant-wide settlement requires the exact full-control platform Super Admin", () => {
  assert.equal(hasSettlementAuthority({ tenantId: "MNTY-PLATFORM", memberships: [platformAdmin()] }), true);
  assert.equal(hasSettlementAuthority({ tenantId: "MNTY-PLATFORM", memberships: [{ ...platformAdmin(), role: "ADMIN", permissions: {} }] }), false);
  assert.equal(hasSettlementAuthority({ tenantId: "MNTY-PLATFORM", memberships: [platformAdmin({ permissions: { scope: "PLATFORM", full_control: false } })] }), false);
  assert.equal(hasSettlementAuthority({ tenantId: "MNTY-PLATFORM", memberships: [businessOwner("business-A", { tenant_id: "MNTY-PLATFORM" })] }), false);
});

test("a platform Super Admin may perform a scoped settlement within the platform tenant", () => {
  assert.equal(hasSettlementAuthority({ tenantId: "MNTY-PLATFORM", businessId: "business-A", memberships: [platformAdmin()] }), true);
});

test("missing tenant and malformed membership collections fail closed", () => {
  assert.equal(hasSettlementAuthority({ tenantId: " ", businessId: "business-A", memberships: [businessOwner("business-A")] }), false);
  assert.equal(hasSettlementAuthority({ tenantId: "TENANT-A", businessId: "business-A", memberships: null }), false);
});

test("Edge Function performs verified-user scope authorization before the privileged RPC", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(source, /userClient\.auth\.getUser\(\)/);
  assert.match(source, /user\.is_anonymous/);
  assert.match(source, /\.from\("user_memberships"\)/);
  assert.match(source, /\.eq\("user_id", user\.id\)/);
  assert.match(source, /hasSettlementAuthority\(\{ tenantId, businessId, memberships:/);
  assert.match(source, /error: "SETTLEMENT_FORBIDDEN"/);
  assert.match(source, /beneficiaryType === "MERCHANT" && !businessId/);
  assert.match(source, /p_actor_user_id: user\.id/);
  assert.ok(source.indexOf("hasSettlementAuthority(") < source.indexOf('serviceClient.rpc("create_settlement_and_post_journal"'));
  assert.doesNotMatch(source, /error: e instanceof Error \? e\.message/);
});
