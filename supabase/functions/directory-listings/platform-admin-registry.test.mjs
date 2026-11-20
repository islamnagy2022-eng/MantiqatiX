import test from "node:test";
import assert from "node:assert/strict";
import {
  isPlatformAdminMembershipCandidate,
  resolveDirectoryPlatformAdmin,
} from "./platform-admin-registry.mjs";

const registeredCandidate = {
  status: "ACTIVE",
  role: "SUPER_ADMIN",
  business_id: null,
  branch_id: null,
  permissions: { scope: "PLATFORM", full_control: true },
};
const tenantAdmin = {
  status: "ACTIVE",
  role: "SUPER_ADMIN",
  business_id: "tenant-business",
  branch_id: null,
  permissions: { scope: "PLATFORM", full_control: true },
};

test("registry-backed directory admin accepts only a candidate confirmed by the registry", () => {
  assert.equal(isPlatformAdminMembershipCandidate(registeredCandidate), true);
  assert.equal(resolveDirectoryPlatformAdmin([registeredCandidate], true, null), true);
});

test("legacy tenant SUPER_ADMIN membership cannot grant platform-root authority", () => {
  assert.equal(isPlatformAdminMembershipCandidate(tenantAdmin), false);
  assert.equal(resolveDirectoryPlatformAdmin([tenantAdmin], true, null), false);
});

test("registry false, RPC errors, malformed values, and inactive membership fail closed", () => {
  assert.equal(resolveDirectoryPlatformAdmin([registeredCandidate], false, null), false);
  assert.equal(resolveDirectoryPlatformAdmin([registeredCandidate], true, { code: "RPC_FAILED" }), false);
  assert.equal(resolveDirectoryPlatformAdmin([registeredCandidate], "true", null), false);
  assert.equal(resolveDirectoryPlatformAdmin([{ ...registeredCandidate, status: "INACTIVE" }], true, null), false);
  assert.equal(resolveDirectoryPlatformAdmin([], true, null), false);
});
