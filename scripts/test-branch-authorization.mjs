import test from "node:test";
import assert from "node:assert/strict";
import { isBranchCreationAuthorized } from "../supabase/functions/_shared/branch-authorization.mjs";

const target = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

test("business managers are authorized only for their exact business", () => {
  for (const role of ["OWNER", "ADMIN", "BUSINESS_OWNER", "MANAGER", "manager"]) {
    assert.equal(isBranchCreationAuthorized([{ role, business_id: target }], target), true, role);
    assert.equal(isBranchCreationAuthorized([{ role, business_id: other }], target), false, role);
    assert.equal(isBranchCreationAuthorized([{ role, business_id: null }], target), false, role);
  }
});

test("platform super-admin requires both explicit platform scope and full control", () => {
  assert.equal(isBranchCreationAuthorized([{
    role: "SUPER_ADMIN", business_id: null,
    permissions: { scope: "PLATFORM", full_control: true },
  }], target), true);
  assert.equal(isBranchCreationAuthorized([{
    role: "SUPER_ADMIN", business_id: null,
    permissions: { scope: "TENANT", full_control: true },
  }], target), false);
  assert.equal(isBranchCreationAuthorized([{
    role: "SUPER_ADMIN", business_id: null,
    permissions: { scope: "PLATFORM", full_control: false },
  }], target), false);
  assert.equal(isBranchCreationAuthorized([{ role: "SUPER_ADMIN", business_id: null }], target), false);
});

test("tenant-wide or unrelated roles cannot create a business branch", () => {
  for (const membership of [
    { role: "ADMIN", business_id: null },
    { role: "STAFF", business_id: target },
    { role: "CUSTOMER", business_id: target },
    { role: "OWNER", business_id: other },
    null,
    {},
  ]) {
    assert.equal(isBranchCreationAuthorized([membership], target), false);
  }
});

test("invalid membership collections and target IDs fail closed", () => {
  assert.equal(isBranchCreationAuthorized(null, target), false);
  assert.equal(isBranchCreationAuthorized({}, target), false);
  assert.equal(isBranchCreationAuthorized([{ role: "OWNER", business_id: target }], ""), false);
  assert.equal(isBranchCreationAuthorized([{ role: "OWNER", business_id: target }], null), false);
});
