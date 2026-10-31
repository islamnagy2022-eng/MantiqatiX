import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261031145200_rc463_platform_admin_bootstrap_recovery.sql", "utf8");
const edge = fs.readFileSync("supabase/functions/platform-admin-lifecycle/index.ts", "utf8");
const integration = fs.readFileSync("supabase/tests/rc463_platform_admin_lifecycle_integration.sql", "utf8");

const checks = [
  ["canonical bootstrap tenant ID", /p_tenant_id varchar default 'MNTY-PLATFORM'/i.test(migration)],
  ["canonical bootstrap tenant code", /p_tenant_code varchar default 'MNTY'/i.test(migration)],
  ["legacy tenant default removed", !/p_tenant_id varchar default 'MNTY_PLATFORM'/i.test(migration)],
  ["legacy tenant code default removed", !/p_tenant_code varchar default 'MNTY-PLATFORM'/i.test(migration)],
  ["bootstrap refuses non-canonical tenant", migration.includes("PLATFORM_BOOTSTRAP_CANONICAL_TENANT_REQUIRED")],
  ["bootstrap validates tenant ID/code conflicts", migration.includes("PLATFORM_BOOTSTRAP_TENANT_ID_CODE_CONFLICT")],
  ["bootstrap reuses canonical tenant", migration.includes("select t.status into v_tenant_status")],
  ["bootstrap and lifecycle serialize mutations", (migration.match(/pg_advisory_xact_lock/g) || []).length === 3],
  ["private lifecycle audit table is RLS + FORCE RLS", /alter table private\.platform_admin_lifecycle_events enable row level security;\s*alter table private\.platform_admin_lifecycle_events force row level security;/i.test(migration)],
  ["private lifecycle audit table denies client roles", /as restrictive\s*for all to anon, authenticated\s*using \(false\)\s*with check \(false\)/i.test(migration)],
  ["grant routine requires existing registry actor", /function private\.grant_platform_admin[\s\S]*?from private\.platform_admins pa where pa\.user_id = p_actor_user_id/i.test(migration)],
  ["revoke routine requires existing registry actor", /function private\.revoke_platform_admin[\s\S]*?from private\.platform_admins pa where pa\.user_id = p_actor_user_id/i.test(migration)],
  ["revoke prevents self-removal", migration.includes("PLATFORM_ADMIN_SELF_REVOCATION_NOT_ALLOWED")],
  ["revoke prevents removing last registry row", migration.includes("PLATFORM_ADMIN_LAST_ROOT_CANNOT_BE_REVOKED")],
  ["revoke deactivates legacy platform membership", /set status = 'INACTIVE'[\s\S]*?tenant_id = 'MNTY-PLATFORM'[\s\S]*?upper\(role\) = 'SUPER_ADMIN'/i.test(migration)],
  ["all lifecycle routines are service-role-only", (migration.match(/grant execute on function private\.(?:bootstrap_platform_admin|grant_platform_admin|revoke_platform_admin)[^;]+to service_role/gi) || []).length === 3],
  ["Edge Function validates the user JWT", edge.includes("service.auth.getUser(token)")],
  ["Edge Function verifies actor is in the root registry", edge.includes('.schema("private")') && edge.includes('.from("platform_admins")') && edge.includes('.eq("user_id", actor.id)')],
  ["Edge Function exposes only grant/revoke actions", edge.includes('action !== "grant" && action !== "revoke"') && !edge.includes('action === "bootstrap"')],
  ["Edge Function never returns registry rows", !/return json\(\{[^}]*rootRecord/i.test(edge)],
  ["integration covers default bootstrap and tenant reuse", integration.includes("private.bootstrap_platform_admin(root_one)") && integration.includes("RC463_BOOTSTRAP_CREATED_PARALLEL_OR_WRONG_TENANT")],
  ["integration covers tenant-owner denial and unconfirmed target", integration.includes("RC463_TENANT_OWNER_GRANTED_PLATFORM_ADMIN") && integration.includes("RC463_UNCONFIRMED_USER_GRANTED_PLATFORM_ADMIN")],
  ["integration covers grant idempotency and revocation", integration.includes("RC463_DUPLICATE_GRANT_NOT_IDEMPOTENT") && integration.includes("RC463_REVOKED_MEMBERSHIP_STILL_PASSES_LEGACY_GUARD")],
];

for (const [label, passed] of checks) {
  assert.equal(passed, true, `PLATFORM_ADMIN_LIFECYCLE_CONTRACT_FAILED: ${label}`);
}
console.log(`PLATFORM_ADMIN_LIFECYCLE_CONTRACT=PASS (${checks.length} checks)`);
