import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getSmmLaunchDecision } from "./launch-gate.ts";

Deno.test("S07_GATE_001: missing flags fail closed with SMM_DEFERRED", () => {
  assertEquals(getSmmLaunchDecision(undefined, undefined), {
    enabled: false, status: 503, error: "SMM_DEFERRED",
  });
});

Deno.test("S07_GATE_002: enabled flag alone cannot open launch", () => {
  assertEquals(getSmmLaunchDecision("true", undefined), {
    enabled: false, status: 503, error: "SMM_DEFERRED",
  });
});

Deno.test("S07_GATE_003: post-launch approval alone cannot open launch", () => {
  assertEquals(getSmmLaunchDecision(undefined, "true"), {
    enabled: false, status: 503, error: "SMM_DEFERRED",
  });
});

Deno.test("S07_GATE_004: explicit dual approval is the only enabled state", () => {
  assertEquals(getSmmLaunchDecision("true", "true"), {
    enabled: true, status: 200, error: null,
  });
});

Deno.test("S07_GATE_005: truthy-looking values do not enable launch", () => {
  for (const value of ["TRUE", "1", "yes", " true", "true "]) {
    assertEquals(getSmmLaunchDecision(value, "true").enabled, false);
    assertEquals(getSmmLaunchDecision("true", value).enabled, false);
  }
});

Deno.test("S07_GATE_006: false and empty values fail closed", () => {
  for (const value of ["", "false", "FALSE", "0", "no"]) {
    assertEquals(getSmmLaunchDecision(value, "true"), {
      enabled: false, status: 503, error: "SMM_DEFERRED",
    });
    assertEquals(getSmmLaunchDecision("true", value), {
      enabled: false, status: 503, error: "SMM_DEFERRED",
    });
  }
});

Deno.test("S07_GATE_007: all non-approved flag pairs fail closed", () => {
  const values = [undefined, "", "false", "TRUE", "1", "yes", " true", "true "];
  for (const enabledFlag of values) {
    for (const approvalFlag of values) {
      assertEquals(getSmmLaunchDecision(enabledFlag, approvalFlag), {
        enabled: false, status: 503, error: "SMM_DEFERRED",
      });
    }
  }
});
