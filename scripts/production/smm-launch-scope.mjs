export function evaluateSmmLaunchScope(scope, runtimeGates = {}) {
  if (!scope || typeof scope !== "object") {
    return {
      status: "BLOCKED",
      mode: "UNKNOWN",
      evidence: "SMM launch scope is missing; fail closed.",
    };
  }

  if (scope.decision === "DEFERRED_NOT_IN_INITIAL_LAUNCH") {
    const required = [
      ["live_edge_function", scope.live_edge_function === "DISABLED_AND_VERIFIED"],
      ["gateway_customer_access", scope.gateway_customer_access === "DENIED"],
      ["negative_test", scope.negative_test === "PASS"],
      ["live_function_version", typeof scope.live_function_version === "string" && scope.live_function_version.trim().length > 0],
      ["live_function_hash", typeof scope.live_function_hash === "string" && scope.live_function_hash.trim().length > 0],
      ["disable_evidence_ref", typeof scope.disable_evidence_ref === "string" && scope.disable_evidence_ref.trim().length > 0],
    ];
    const missing = required.filter(([, valid]) => !valid).map(([field]) => field);
    return {
      status: missing.length === 0 ? "PASS" : "BLOCKED",
      mode: "DEFERRED",
      evidence: missing.length === 0
        ? "SMM is deferred; live gateway disablement, customer denial, negative test, version/hash, and evidence reference are all verified."
        : "SMM is deferred but launch containment evidence is incomplete: " + missing.join(", ") + ".",
      missing,
    };
  }

  const requiredRuntimeGates = [
    "smm_gateway_parity",
    "smm_acl_boundary",
    "smm_order_refund_safety",
    "smm_provider_timeout_safety",
  ];
  const missing = requiredRuntimeGates.filter((key) => runtimeGates[key] !== "PASS");
  return {
    status: missing.length === 0 ? "PASS" : "BLOCKED",
    mode: "ACTIVE",
    evidence: missing.length === 0
      ? "SMM is in launch scope and all SMM runtime safety gates passed."
      : "SMM is in launch scope; runtime gates not passed: " + missing.join(", ") + ".",
    missing,
  };
}
