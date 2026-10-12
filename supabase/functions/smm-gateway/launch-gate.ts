export type SmmLaunchDecision =
  | { enabled: true; status: 200; error: null }
  | { enabled: false; status: 503; error: "SMM_DEFERRED" };

export function getSmmLaunchDecision(
  enabledFlag: string | undefined,
  postLaunchApprovalFlag: string | undefined,
): SmmLaunchDecision {
  if (enabledFlag === "true" && postLaunchApprovalFlag === "true") {
    return { enabled: true, status: 200, error: null };
  }
  return { enabled: false, status: 503, error: "SMM_DEFERRED" };
}
