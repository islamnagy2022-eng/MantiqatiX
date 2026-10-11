#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateSmmLaunchScope } from "./production/smm-launch-scope.mjs";

const completeDeferred = {
  decision: "DEFERRED_NOT_IN_INITIAL_LAUNCH",
  live_edge_function: "DISABLED_AND_VERIFIED",
  gateway_customer_access: "DENIED",
  negative_test: "PASS",
  live_function_version: "verified-version-123",
  live_function_hash: "sha256:verified-hash",
  disable_evidence_ref: "release-evidence://smm-disable-negative-test",
};
const allRuntimeGatesPass = {
  smm_gateway_parity: "PASS",
  smm_acl_boundary: "PASS",
  smm_order_refund_safety: "PASS",
  smm_provider_timeout_safety: "PASS",
};

assert.equal(evaluateSmmLaunchScope(completeDeferred).status, "PASS",
  "deferred SMM may pass only with complete server-side denial evidence");

for (const [field, value] of [
  ["live_edge_function", "ACTIVE"],
  ["gateway_customer_access", "ALLOWED"],
  ["negative_test", "FAIL"],
  ["live_function_version", ""],
  ["live_function_hash", ""],
  ["disable_evidence_ref", ""],
]) {
  const candidate = { ...completeDeferred, [field]: value };
  assert.equal(evaluateSmmLaunchScope(candidate).status, "BLOCKED",
    "deferred SMM must fail closed when " + field + " is invalid");
}

assert.equal(evaluateSmmLaunchScope({
  ...completeDeferred,
  live_function_hash: null,
}).status, "BLOCKED", "missing hash must block deferred SMM");

assert.equal(evaluateSmmLaunchScope({
  decision: "IN_INITIAL_LAUNCH",
}, allRuntimeGatesPass).status, "PASS",
"SMM in launch scope requires every runtime gate to pass");

assert.equal(evaluateSmmLaunchScope({
  decision: "IN_INITIAL_LAUNCH",
}, { ...allRuntimeGatesPass, smm_provider_timeout_safety: "NOT VERIFIED" }).status,
"BLOCKED", "active SMM must not pass with an unverified safety gate");

assert.equal(evaluateSmmLaunchScope(null).status, "BLOCKED",
  "missing scope must fail closed");

console.log("SMM launch-scope gate contract: PASS (deferred denial evidence + active feature safety)");
