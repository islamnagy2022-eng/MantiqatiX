export type SmmLaunchDecision =
  | { enabled: true; status: 200; error: null }
  | { enabled: false; status: 503; error: "SMM_POST_LAUNCH_DEFERRED" };

export function getSmmLaunchDecision(flag: string | undefined): SmmLaunchDecision {
  if (flag === "true") return { enabled: true, status: 200, error: null };
  return { enabled: false, status: 503, error: "SMM_POST_LAUNCH_DEFERRED" };
}
