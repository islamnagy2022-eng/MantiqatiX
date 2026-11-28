import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20261128112119_demo_admin_control_center_compatibility.sql',
  'utf8',
).toLowerCase();

const postgresTest = readFileSync(
  'supabase/tests/demo_admin_control_center_compatibility.sql',
  'utf8',
).toLowerCase();

const platformAdminEdge = readFileSync(
  'supabase/functions/catalog-platform-admin/index.ts',
  'utf8',
).toLowerCase();

const permissionRepairSource = readFileSync(
  'supabase/migrations/20261128112119_demo_admin_control_center_compatibility.sql',
  'utf8',
);
const permissionHelperPathMigration = readFileSync(
  'supabase/migrations/20261128112653_demo_mnty_permission_helper_empty_search_path.sql',
  'utf8',
).toLowerCase();
const permissionHelperAclMigration = readFileSync(
  'supabase/migrations/20261128112652_demo_permission_helper_execute_acl.sql',
  'utf8',
).toLowerCase();
const demoPlatformRootMigration = readFileSync(
  'supabase/migrations/20261128112058_demo_platform_root_authority_convergence.sql',
  'utf8',
).toLowerCase();

const externalRpcSignatures = [
  'mnty_platform_admin_list_custom_roles()',
  'mnty_platform_admin_upsert_custom_role(text,text,text,text,jsonb,uuid,boolean)',
  'mnty_platform_admin_assign_custom_role(uuid,uuid,varchar,uuid,varchar,boolean,uuid)',
  'mnty_business_employee_position_upsert(varchar,uuid,text,text,text,text,jsonb,boolean,boolean,varchar,uuid)',
  'mnty_business_employee_upsert(varchar,uuid,uuid,text,text,text,uuid,text,jsonb,varchar,uuid)',
  'mnty_platform_has_permission(text,varchar,uuid,varchar)',
  'mnty_platform_admin_list_people(text)',
  'mnty_platform_admin_list_role_assignments()',
  'mnty_business_employee_list(varchar,uuid)',
  'mnty_business_employee_list_scoped(varchar,uuid,varchar)',
  'mnty_platform_admin_list_audit(text)',
  'mnty_platform_admin_list_businesses(text)',
  'mnty_platform_admin_manage_business(uuid,text,jsonb,text)',
  'mnty_platform_admin_manage_membership(uuid,text,text)',
];

const serviceOnlyRpcSignature = 'mnty_platform_admin_delete_business';
assert.ok(permissionHelperPathMigration.includes('alter function public.mnty_active_membership(character varying,uuid,character varying)') && permissionHelperPathMigration.includes('alter function public.mnty_can(text,character varying,uuid,character varying)'), 'Legacy membership helpers must be hardened.');
assert.ok(permissionHelperPathMigration.includes('set search_path = \'\';'), 'Legacy membership helper search paths must be empty.');
assert.ok(permissionHelperAclMigration.includes('revoke all on function public.mnty_active_membership(character varying,uuid,character varying) from public, anon;'), 'Clean replay must deny anonymous membership-helper execution.');
assert.ok(permissionHelperAclMigration.includes('grant execute on function public.mnty_active_membership(character varying,uuid,character varying) to authenticated;'), 'Clean replay must grant authenticated membership-helper execution.');
assert.ok(permissionHelperAclMigration.includes('revoke all on function public.mnty_can(text,character varying,uuid,character varying) from public, anon;'), 'Clean replay must deny anonymous mnty_can execution.');
assert.ok(permissionHelperAclMigration.includes('grant execute on function public.mnty_can(text,character varying,uuid,character varying) to authenticated;'), 'Clean replay must grant authenticated mnty_can execution.');
assert.ok('20261128112652_demo_permission_helper_execute_acl.sql' < '20261128112653_demo_mnty_permission_helper_empty_search_path.sql', 'ACL preflight must run before the helper search_path contract.');

const catalogRpcSignatures = [
  'adjust_catalog_stock_backend(character varying,uuid,character varying,character varying,uuid,numeric,numeric,character varying,text)',
  'create_catalog_warehouse_backend(character varying,uuid,character varying,character varying,character varying)',
  'upsert_catalog_item_backend(character varying,uuid,character varying,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid)',
  'upsert_catalog_price_backend(character varying,uuid,uuid,character varying,character varying,numeric,timestamp with time zone,timestamp with time zone)',
  'upsert_catalog_settings_backend(character varying,uuid,character varying,numeric,boolean,boolean)',
  'update_catalog_item_status_backend(character varying,uuid,uuid,character varying,character varying)',
  'upsert_catalog_business_profile_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean)',
];
for (const signature of catalogRpcSignatures) {
  assert.ok(
    demoPlatformRootMigration.includes('revoke all on function public.' + signature.toLowerCase() + ' from public, anon;'),
    'Catalog RPC must keep PUBLIC/anon EXECUTE revoked: ' + signature,
  );
  assert.ok(
    demoPlatformRootMigration.includes('grant execute on function public.' + signature.toLowerCase() + ' to authenticated;'),
    'Catalog RPC authenticated EXECUTE grant missing: ' + signature,
  );
}
assert.ok(demoPlatformRootMigration.includes("is distinct from 'false'"),
  'RC925 missing-claim guard must remain fail-closed.');
assert.ok(demoPlatformRootMigration.includes('pg_catalog.pg_advisory_xact_lock'),
  'RC486 price version serialization must be replayed after RC485.');
assert.equal((demoPlatformRootMigration.match(/^\s*begin;\s*$/gim) || []).length, 1,
  'Root convergence migration must contain exactly one BEGIN.');
assert.equal((demoPlatformRootMigration.match(/^\s*commit;\s*$/gim) || []).length, 1,
  'Root convergence migration must contain exactly one COMMIT.');
assert.ok(demoPlatformRootMigration.includes('pg_catalog.pg_advisory_xact_lock'), 'RC486 catalog price serialization must be preserved after RC485.');
assert.ok(demoPlatformRootMigration.includes('is_anonymous'), 'RC923/RC925 anonymous-session and missing-claim guards must be preserved.');
assert.ok(demoPlatformRootMigration.includes("is distinct from 'false'"), 'RC925 must reject a missing is_anonymous claim.');
assert.equal((demoPlatformRootMigration.match(/^\s*begin;\s*$/gim) || []).length, 1, 'Root convergence migration must be one atomic BEGIN.');
assert.equal((demoPlatformRootMigration.match(/^\s*commit;\s*$/gim) || []).length, 1, 'Root convergence migration must be one atomic COMMIT.');
assert.ok(demoPlatformRootMigration.includes('alter table private.platform_admins force row level security;'), 'DEMO root migration must force RLS on the private registry.');
assert.ok(demoPlatformRootMigration.includes('f307f246e905c9dc1a3964184718b570'), 'DEMO policy inventory fingerprint must match the reviewed baseline.');
assert.ok(demoPlatformRootMigration.includes('ux_user_memberships_user_business_branch_nullsafe'), 'DEMO root migration must include the null-safe membership index.');
for (const marker of ['rc464','rc469','rc471','rc472','rc484','rc485','rc486','rc923','rc925']) assert.ok(demoPlatformRootMigration.includes(marker), 'Missing coordinated root dependency: ' + marker.toUpperCase());

const internalHelperSignatures = [
  'mnty_business_employee_permission_ceiling_allows(jsonb,varchar,uuid,varchar)',
  'mnty_business_employee_permissions_subset(jsonb,jsonb)',
];

for (const signature of externalRpcSignatures) {
  assert.ok(
    migration.includes(
      'revoke all on function public.' + signature + ' from public, anon;',
    ),
    'Missing PUBLIC/anon revoke for ' + signature,
  );
  assert.ok(
    migration.includes(
      'grant execute on function public.' + signature + ' to authenticated;',
    ),
    'Missing authenticated grant for ' + signature,
  );
}

for (const signature of internalHelperSignatures) {
  assert.ok(
    migration.includes(
      'revoke all on function public.' + signature +
        ' from public, anon, authenticated;',
    ),
    'Internal helper is still executable by a client role: ' + signature,
  );
  assert.ok(
    !migration.includes(
      'grant execute on function public.' + signature,
    ),
    'Internal helper must not be granted to a client role: ' + signature,
  );
}

for (const table of [
  'platform_custom_roles',
  'platform_role_assignments',
  'business_job_positions',
  'business_employees',
]) {
  assert.ok(
    migration.includes(
      'alter table public.' + table + ' enable row level security;',
    ),
    'RLS enablement missing for ' + table,
  );
  assert.ok(
    migration.includes(
      'alter table public.' + table + ' force row level security;',
    ),
    'FORCE RLS missing for ' + table,
  );
  assert.ok(
    migration.includes(
      'revoke all on public.' + table + ' from anon, authenticated;',
    ),
    'Direct client table access revoke missing for ' + table,
  );
}

for (const functionName of [
  'mnty_business_employee_position_upsert',
  'mnty_business_employee_upsert',
]) {
  const matches = [...permissionRepairSource.matchAll(
    new RegExp('create\\s+or\\s+replace\\s+function\\s+public\\.' + functionName + '\\s*\\(', 'gi'),
  )];
  assert.ok(matches.length >= 1, 'Permission-aware final RPC definition missing: ' + functionName);
  const finalDefinition = permissionRepairSource.slice(matches[matches.length - 1].index);
  const end = finalDefinition.indexOf('$function$;');
  assert.ok(end >= 0, 'Final employee RPC definition is incomplete: ' + functionName);
  const body = finalDefinition.slice(0, end + 11);
  assert.ok(body.includes('mnty_business_employee_permissions_subset'), 'Employee permission override ceiling missing: ' + functionName);
  assert.ok(body.includes('EMPLOYEE_PERMISSION_ESCALATION'), 'Employee escalation denial missing: ' + functionName);
  if (functionName === 'mnty_business_employee_position_upsert') {
    assert.ok(body.includes('mnty_business_employee_permission_ceiling_allows'), 'Position authority ceiling missing.');
  }
}

assert.ok(
  migration.includes('from private.platform_admins'),
  'Admin RPCs must use the protected platform-admin registry.',
);
assert.ok(
  !/insert\s+into\s+private\.platform_admins/i.test(migration),
  'Migration must not silently create or bootstrap a platform administrator.',
);
assert.ok(
  !/service_role\s+key|supabase_service_role_key/i.test(migration),
  'A server-side service-role secret must not be embedded in the migration.',
);

assert.ok(migration.includes('create table if not exists public.bizcatalog_platform_settings'), 'BizCatalog settings dependency is missing.');
const settingsSaveStart = platformAdminEdge.indexOf('if (action === "save_settings")');
const activityWriteGuard = platformAdminEdge.indexOf('activity_module_settings_not_ready', settingsSaveStart);
const settingsUpsert = platformAdminEdge.indexOf('service.from("bizcatalog_platform_settings").upsert', settingsSaveStart);
assert.ok(settingsSaveStart >= 0 && activityWriteGuard > settingsSaveStart && settingsUpsert > activityWriteGuard,
  'Platform Edge handler must reject activity-module settings before touching the settings table.');
assert.ok(platformAdminEdge.includes('const activity_module_settings_write_enabled = false'),
  'Activity-module platform settings must remain server-side disabled until atomic audit is proven.');
assert.ok(migration.includes('revoke all on table public.bizcatalog_platform_settings from public, anon, authenticated;'), 'BizCatalog settings must remain closed to browser roles.');
assert.ok(migration.includes('revoke all on function public.' + serviceOnlyRpcSignature) && migration.includes('to service_role;'), 'Business delete RPC must be service-role-only.');
for (const marker of ['demo_admin_bizcatalog_settings_client_privilege_granted','demo_admin_delete_rpc_must_be_invoker','demo_admin_delete_rpc_acl_failed','demo_admin_delete_rpc_history_or_audit_guard_missing','demo_admin_delete_rpc_service_select_missing','demo_admin_delete_rpc_service_delete_missing','demo_admin_delete_rpc_service_lock_or_audit_privilege_missing','demo_admin_bizcatalog_and_delete_behavior','demo_platform_root_authorization_behavior','demo_mnty_active_membership_search_path_not_empty','demo_mnty_can_search_path_not_empty','demo_permission_helper_execute_acl_changed']) {
  assert.ok(postgresTest.includes(marker), 'PostgreSQL integration contract missing assertion marker: ' + marker);
}

for (const marker of [
  'demo_admin_requires_rc464_registry_backed_root',
  'demo_admin_requires_rc464_empty_search_path',
  'demo_admin_requires_rc464_registry_force_rls',
]) {
  assert.ok(migration.includes(marker), 'Migration fail-fast preflight missing marker: ' + marker);
}

for (const marker of [
  'demo_admin_definer_search_path_not_empty',
  'demo_admin_internal_definer_path_failed',
  'demo_admin_membership_scope_index_missing_or_invalid',
  'demo_admin_rc117_activity_name_sync_missing',
  'demo_admin_rc117_activity_list_truncated',
  'demo_admin_root_helper_not_registry_backed',
  'demo_admin_root_helper_anon_execute_granted',
  'demo_admin_root_helper_search_path_not_empty',
  'demo_admin_root_registry_rls_not_forced',
  'demo_admin_root_registry_direct_client_privilege_granted',
]) {
  assert.ok(postgresTest.includes(marker), 'PostgreSQL integration contract missing assertion marker: ' + marker);
}

console.log('DEMO_ADMIN_COMPATIBILITY_STATIC_CONTRACT=PASS');
console.log(
  'Verified ' + externalRpcSignatures.length +
  ' guarded RPC signatures, ' + internalHelperSignatures.length +
  ' private helper ACLs, and four forced-RLS tables.',
);
console.log(
  'Static source validation only. PostgreSQL replay and runtime authorization tests remain mandatory.',
);
