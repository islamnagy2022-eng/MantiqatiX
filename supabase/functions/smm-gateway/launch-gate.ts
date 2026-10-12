export type SmmLaunchDecision =
  | { enabled: true; status: 200; error: null }
  | { enabled: false; status: 503; error: "SMM_LAUNCH_GATES_PENDING" };

export function getSmmLaunchDecision(flag: string | undefined): SmmLaunchDecision {
  if (flag === "true") return { enabled: true, status: 200, error: null };
  return { enabled: false, status: 503, error: "SMM_LAUNCH_GATES_PENDING" };
}
