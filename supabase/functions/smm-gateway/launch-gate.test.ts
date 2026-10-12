import { getSmmLaunchDecision } from "./launch-gate.ts";

Deno.test("SMM launch gate stays closed unless both independent flags are exactly true", () => {
  for (const [enabled, approval] of [
    [undefined, undefined], ["true", undefined], [undefined, "true"],
    ["false", "true"], ["true", "false"], ["TRUE", "true"],
    ["true", "TRUE"], ["1", "true"], ["yes", "true"],
  ] as const) {
    const decision = getSmmLaunchDecision(enabled, approval);
    if (decision.enabled || decision.status !== 503 || decision.error !== "SMM_DEFERRED") {
      throw new Error("SMM launch gate opened without both exact approvals");
    }
  }
  const approved = getSmmLaunchDecision("true", "true");
  if (!approved.enabled || approved.status !== 200) throw new Error("explicit dual approval was rejected");
});
