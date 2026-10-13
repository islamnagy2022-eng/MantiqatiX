import fs from "node:fs";
import assert from "node:assert/strict";

const edgePath = "supabase/functions/smm-gateway/index.ts";
const gatePath = "supabase/functions/smm-gateway/launch-gate.ts";
const testsPath = "supabase/functions/smm-gateway/launch-gate.test.ts";
const edge = fs.readFileSync(edgePath, "utf8");
const gate = fs.readFileSync(gatePath, "utf8");
const tests = fs.readFileSync(testsPath, "utf8");

// These assertions intentionally fail closed if the helper exists but the gateway
// does not actually enforce it. A helper-only unit test is not launch-gate evidence.
assert.match(edge, /getSmmLaunchDecision/, "gateway must import and enforce launch-gate helper");
assert.match(edge, /SMM_INITIAL_LAUNCH_DEFERRED\s*=\s*true/, "initial SMM launch must remain deferred in source");
assert.match(edge, /SMM_DEFERRED/, "gateway must return the stable deferred error code");
assert.match(edge, /status:\s*503|json\([^;]*503/s, "deferred requests must receive HTTP 503");
assert.match(gate, /enabledFlag\s*===\s*"true"\s*&&\s*postLaunchApprovalFlag\s*===\s*"true"/, "launch must require both exact approval flags");
assert.match(gate, /status:\s*503,\s*error:\s*"SMM_DEFERRED"/, "gate must fail closed with 503 SMM_DEFERRED");
for (const id of ["S07_GATE_001", "S07_GATE_002", "S07_GATE_003", "S07_GATE_004", "S07_GATE_005"]) {
  assert.ok(tests.includes(id), `missing uniquely named launch-gate test ${id}`);
}

// Source-level high-risk mutation points: no provider credential may be returned
// from read actions, and user data reads must remain user-scoped.
const catalogStart = edge.indexOf('if(a==="catalog")');
const accountStart = edge.indexOf('if(a==="my_data")', catalogStart);
const configureStart = edge.indexOf('if(a==="configure_provider")', accountStart);
assert.ok(catalogStart >= 0, "catalog action anchor must exist");
assert.ok(accountStart > catalogStart, "my_data action anchor must follow catalog");
assert.ok(configureStart > accountStart, "configure_provider action anchor must follow my_data");
{
  const catalog = edge.slice(catalogStart, accountStart);
  const account = edge.slice(accountStart, configureStart);
  assert.doesNotMatch(catalog, /api_key|provider_secret|provider_cost|metadata/, "catalog must not expose provider secrets or internal cost metadata");
  assert.match(account, /\.eq\("user_id",user\.id\)/, "my_data must scope reads to the authenticated user");
}

console.log("S07 SMM gateway static contract: PASS");
