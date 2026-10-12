import { getSmmLaunchDecision } from "./launch-gate.ts";

Deno.test("SMM launch gate is closed unless the exact explicit flag is true", () => {
  for (const flag of [undefined, "", "false", "TRUE", "1", "yes"]) {
    const decision = getSmmLaunchDecision(flag);
    if (decision.enabled !== false || decision.status !== 503 || decision.error !== "SMM_LAUNCH_GATES_PENDING") {
      throw new Error("SMM gate did not fail closed for flag: " + String(flag));
    }
  }
  const enabled = getSmmLaunchDecision("true");
  if (enabled.enabled !== true || enabled.status !== 200 || enabled.error !== null) {
    throw new Error("SMM gate did not allow the exact explicit true flag");
  }
});
