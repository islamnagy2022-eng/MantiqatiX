import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20261128090000_demo_admin_control_center_compatibility.sql',
  'utf8',
).toLowerCase();

const postgresTest = readFileSync(
  'supabase/tests/demo_admin_control_center_compatibility.sql',
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
