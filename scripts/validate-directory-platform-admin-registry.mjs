import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const directoryEdge = readFileSync("supabase/functions/directory-listings/index.ts", "utf8");
const catalogPlatformAdmin = readFileSync("supabase/functions/catalog-platform-admin/index.ts", "utf8");
const aiGeminiProxy = readFileSync("supabase/functions/ai-gemini-proxy/index.ts", "utf8");
const helper = readFileSync("supabase/functions/directory-listings/platform-admin-registry.mjs", "utf8");
const helperTests = readFileSync("supabase/functions/directory-listings/platform-admin-registry.test.mjs", "utf8");
const registryMigration = readFileSync("supabase/migrations/20261113214500_rc464_platform_admin_live_registry_hardening.sql", "utf8");

// Directory listings: verify caller first, then use its JWT to query the canonical registry.
const verifiedUser = directoryEdge.indexOf("if (userError || !user || user.is_anonymous)");
const userClient = directoryEdge.indexOf("const userClient = createClient(supabaseUrl, serviceKey");
const registryCall = directoryEdge.indexOf('userClient.rpc("mnty_can_platform_admin")');
const registryGate = directoryEdge.indexOf("if (!resolveDirectoryPlatformAdmin(registryResult, registryError))");
const importAction = directoryEdge.indexOf('if (action === "IMPORT_DOCTOR_BATCH")');
assert.ok(verifiedUser >= 0 && userClient > verifiedUser,
  "directory caller must be verified before creating the JWT-bound registry client");
assert.ok(userClient < registryCall && registryCall < registryGate && registryGate < importAction,
  "directory admin authorization must run before platform-admin actions");
assert.match(directoryEdge, /global:\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`/,
  "directory registry RPC must receive the verified caller JWT");
assert.match(directoryEdge, /PLATFORM_ADMIN_CHECK_UNAVAILABLE/);
assert.match(directoryEdge, /PLATFORM_ADMIN_REQUIRED/);
assert.doesNotMatch(directoryEdge, /some\(platformAdmin\)/,
  "directory root access must not be inferred from tenant memberships");

// Catalog platform-admin console: the private registry, not membership metadata, grants root.
assert.match(catalogPlatformAdmin, /userClient\.rpc\("mnty_can_platform_admin"\)/);
assert.match(catalogPlatformAdmin, /registryResult !== true/);
assert.match(catalogPlatformAdmin, /PLATFORM_ADMIN_CHECK_UNAVAILABLE/);
assert.doesNotMatch(catalogPlatformAdmin, /platformMemberships/,
  "platform-wide tenant enumeration must not depend on synthetic platform membership rows");
assert.doesNotMatch(catalogPlatformAdmin, /\.in\("id", tenantIds\)/,
  "registered platform root must enumerate active production tenants from the registry authority");

// AI catalog image path: service-role writes require a confirmed user and registry-backed root
// or a normal business-scoped catalog membership.
assert.match(aiGeminiProxy, /supabase\.rpc\("mnty_can_platform_admin"\)/);
assert.match(aiGeminiProxy, /const hasPlatformScope = registryResult === true/);
assert.match(aiGeminiProxy, /platform_admin_check_unavailable/);
assert.match(aiGeminiProxy, /action === "generate_catalog_image" && user\.is_anonymous/);
assert.doesNotMatch(aiGeminiProxy, /isPlatformAdminMembership|some\(isPlatformAdminMembership\)/);

// Shared helper accepts only exact boolean true and fails closed on errors or malformed values.
assert.match(helper, /!registryError && registryResult === true/);
assert.match(helperTests, /resolveDirectoryPlatformAdmin\(true, null\)/);
assert.match(helperTests, /registry unavailable/);

// RC464 is the canonical platform-root helper used by all three Edge Functions.
assert.match(registryMigration, /function public\.mnty_can_platform_admin\(\)/i);
assert.match(registryMigration, /security definer/i);
assert.match(registryMigration, /set search_path = ''/i);
assert.match(registryMigration, /private\.platform_admins/i);
assert.match(registryMigration, /grant execute on function public\.mnty_can_platform_admin\(\) to authenticated/i);

console.log("EDGE_PLATFORM_ADMIN_REGISTRY_BOUNDARY=PASS");
