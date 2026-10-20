import assert from "node:assert/strict";
import { evaluateSmmLaunchScope } from "./smm-launch-scope.mjs";

const activePass = {
  smm_gateway_parity: "PASS",
  smm_acl_boundary: "PASS",
  smm_order_refund_safety: "PASS",
  smm_provider_timeout_safety: "PASS"
};
assert.equal(evaluateSmmLaunchScope(activePass).verified, true, "active SMM requires all four runtime gates");
assert.equal(evaluateSmmLaunchScope({ ...activePass, smm_provider_timeout_safety: "NOT VERIFIED" }).verified, false, "active SMM fails closed if a runtime gate is incomplete");

const deferredPass = {
  smm_gateway_parity: "NOT VERIFIED",
  smm_acl_boundary: "NOT VERIFIED",
  smm_order_refund_safety: "NOT VERIFIED",
  smm_provider_timeout_safety: "NOT VERIFIED",
  smm_initial_launch_scope: {
    decision: "DEFERRED_NOT_IN_INITIAL_LAUNCH",
    live_edge_function: "DISABLED_AND_VERIFIED",
    gateway_customer_access: "DENIED",
    negative_test: "PASS",
    live_function_version: "v13",
    live_function_hash: "sha256:test-only-hash",
    disable_evidence_ref: "evidence://test-only-fixture"
  }
};
assert.equal(evaluateSmmLaunchScope(deferredPass).verified, true, "deferred SMM passes scope gate only with complete denial evidence");

for (const patch of [
  { live_edge_function: "ACTIVE" },
  { gateway_customer_access: "ALLOWED" },
  { negative_test: "FAIL" },
  { live_function_version: "" },
  { live_function_hash: "" },
  { disable_evidence_ref: "" }
]) {
  const result = evaluateSmmLaunchScope({ ...deferredPass, smm_initial_launch_scope: { ...deferredPass.smm_initial_launch_scope, ...patch } });
  assert.equal(result.verified, false, "deferred SMM fails closed for " + Object.keys(patch)[0]);
}
assert.equal(evaluateSmmLaunchScope({ smm_initial_launch_scope: { decision: "DEFERRED_NOT_IN_INITIAL_LAUNCH" } }).verified, false, "missing evidence cannot imply disabled");
console.log("SMM deferral-aware production gate: PASS (10 assertions)");
