import {
  isPlatformAdminMembershipCandidate,
  resolveDirectoryPlatformAdmin,
} from "./platform-admin-registry.mjs";

const registeredCandidate = {
  status: "ACTIVE",
  role: "SUPER_ADMIN",
  business_id: null,
  branch_id: null,
  permissions: { scope: "PLATFORM", full_control: true },
};
const tenantAdmin = {
  status: "ACTIVE",
  role: "SUPER_ADMIN",
  business_id: "tenant-business",
  branch_id: null,
  permissions: { scope: "PLATFORM", full_control: true },
};

Deno.test("registry-backed directory admin accepts only a candidate confirmed by the registry", () => {
  if (!isPlatformAdminMembershipCandidate(registeredCandidate)) throw new Error("candidate rejected");
  if (!resolveDirectoryPlatformAdmin([registeredCandidate], true, null)) throw new Error("registry-confirmed admin rejected");
});

Deno.test("legacy tenant SUPER_ADMIN membership cannot grant platform-root authority", () => {
  if (isPlatformAdminMembershipCandidate(tenantAdmin)) throw new Error("tenant admin treated as platform candidate");
  if (resolveDirectoryPlatformAdmin([tenantAdmin], true, null)) throw new Error("tenant admin granted platform access");
});

Deno.test("registry false, RPC errors, malformed values, and inactive membership fail closed", () => {
  if (resolveDirectoryPlatformAdmin([registeredCandidate], false, null)) throw new Error("unregistered candidate accepted");
  if (resolveDirectoryPlatformAdmin([registeredCandidate], true, { code: "RPC_FAILED" })) throw new Error("RPC error did not fail closed");
  if (resolveDirectoryPlatformAdmin([registeredCandidate], "true", null)) throw new Error("non-boolean registry result accepted");
  if (resolveDirectoryPlatformAdmin([{ ...registeredCandidate, status: "INACTIVE" }], true, null)) throw new Error("inactive membership accepted");
  if (resolveDirectoryPlatformAdmin([], true, null)) throw new Error("registry without required platform membership accepted");
});
