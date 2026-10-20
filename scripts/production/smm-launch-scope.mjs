export function evaluateSmmLaunchScope(reconciliation) {
  const scope = reconciliation?.smm_initial_launch_scope;
  const decision = scope?.decision ?? "ACTIVE_OR_UNSPECIFIED";
  const deferred = decision === "DEFERRED_NOT_IN_INITIAL_LAUNCH";
  const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
  if (deferred) {
    const required = [
      ["live_edge_function", scope.live_edge_function === "DISABLED_AND_VERIFIED"],
      ["gateway_customer_access", scope.gateway_customer_access === "DENIED"],
      ["negative_test", scope.negative_test === "PASS"],
      ["live_function_version", nonEmpty(scope.live_function_version)],
      ["live_function_hash", nonEmpty(scope.live_function_hash)],
      ["disable_evidence_ref", nonEmpty(scope.disable_evidence_ref)]
    ];
    const missing = required.filter(([, ok]) => !ok).map(([name]) => name);
    return { decision, deferred: true, verified: missing.length === 0, missing };
  }
  const required = [
    ["smm_gateway_parity", reconciliation?.smm_gateway_parity === "PASS"],
    ["smm_acl_boundary", reconciliation?.smm_acl_boundary === "PASS"],
    ["smm_order_refund_safety", reconciliation?.smm_order_refund_safety === "PASS"],
    ["smm_provider_timeout_safety", reconciliation?.smm_provider_timeout_safety === "PASS"]
  ];
  const missing = required.filter(([, ok]) => !ok).map(([name]) => name);
  return { decision, deferred: false, verified: missing.length === 0, missing };
}
