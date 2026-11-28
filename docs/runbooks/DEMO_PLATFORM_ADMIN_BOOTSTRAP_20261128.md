# MantiqatiX-DEMO — Platform Admin Bootstrap

**Status:** Explicit operator action required. No administrator identity is created or promoted by this runbook.

## Scope and safety

This procedure applies only to the isolated Supabase project **MantiqatiX-DEMO** (`lkijdgqanbqjudiducjt`). It must not be run against Production.

Never copy a Production user ID, email, session, service-role key, or database credential into DEMO. Create or verify a separate Auth account inside the DEMO project.

The root-convergence migration makes `private.platform_admins` the only source of platform-root authority. A tenant `OWNER`, `ADMIN`, or `SUPER_ADMIN` membership does not grant platform-root access. No administrator is seeded by the migration.

## Preconditions

1. PR #1216 has been reviewed and intentionally applied to the DEMO project only.
2. The DEMO migration ledger shows both:
   - `20261128085000_demo_platform_root_authority_convergence`
   - `20261128090000_demo_admin_control_center_compatibility`
3. An authorized project owner has approved the exact DEMO account that should receive platform-root authority.
4. The chosen user is an Auth account in this DEMO project with a confirmed email.
5. The operator has verified the Auth UUID from the DEMO Auth Users view. Do not identify a target from a display name alone.

## Bootstrap

Open the SQL Editor while connected to **MantiqatiX-DEMO** as an authorized database operator. Replace the all-zero UUID below with the exact UUID verified in the DEMO Auth Users view. Do not run the statement while the placeholder remains.

```sql
BEGIN;

DO $demo_platform_admin_bootstrap$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF v_user_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'REPLACE_WITH_VERIFIED_DEMO_AUTH_USER_UUID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = v_user_id
      AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'DEMO_AUTH_USER_MISSING_OR_EMAIL_UNCONFIRMED';
  END IF;

  INSERT INTO private.platform_admins(user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$demo_platform_admin_bootstrap$;

COMMIT;
```

The live DEMO registry currently has only the `user_id` and `created_at` columns. This script therefore does not invent `granted_by` or other audit fields. Record the approval and the operator action in the team's access/change log without publishing the user's email or UUID.

## Verify

After the insert, verify as the authorized operator that the exact approved UUID is present and its Auth account remains confirmed. Then sign in to the DEMO site using that account and verify the server-backed root guard through the application.

Run this read-back query in the DEMO SQL Editor, replacing the UUID with the same verified DEMO Auth UUID. It deliberately does not return the user's email address.

```sql
SELECT
  pa.user_id,
  (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
  c.relrowsecurity AS registry_rls_enabled,
  c.relforcerowsecurity AS registry_force_rls,
  pg_catalog.has_table_privilege('anon','private.platform_admins','SELECT')
    AS anon_can_read_registry,
  pg_catalog.has_table_privilege('authenticated','private.platform_admins','SELECT')
    AS authenticated_can_read_registry,
  pg_catalog.has_function_privilege('authenticated','public.mnty_can_platform_admin()','EXECUTE')
    AS authenticated_can_call_root_guard,
  pg_catalog.has_function_privilege('authenticated','public.is_platform_admin()','EXECUTE')
    AS authenticated_can_call_shared_guard
FROM private.platform_admins pa
JOIN auth.users u ON u.id=pa.user_id
JOIN pg_catalog.pg_class c ON c.oid='private.platform_admins'::regclass
WHERE pa.user_id='REPLACE_WITH_THE_EXACT_DEMO_AUTH_USER_UUID';
```

Expected: exactly one row, `email_confirmed`, `registry_rls_enabled`, `registry_force_rls`, and both authenticated guard-execute values are `true`; both direct registry-read values are `false`. If the query returns no row or any other values, stop and do not weaken the RLS or grants.

The automated PostgreSQL contract already checks that:
- a tenant-level `ADMIN` / `SUPER_ADMIN` cannot pass `mnty_can_platform_admin()` or `is_platform_admin()`;
- a user present in `private.platform_admins` can pass both guards;
- the registry is forced under RLS and has no direct `SELECT` privilege for `anon` or `authenticated`.

Do not grant direct registry access to browser roles as a troubleshooting shortcut.

## Revoke

When access must be removed, obtain the same explicit authorization and delete only the exact DEMO UUID:

```sql
DELETE FROM private.platform_admins
WHERE user_id = 'REPLACE_WITH_THE_EXACT_DEMO_AUTH_USER_UUID';
```

Do not disable RLS, widen grants, or add a tenant membership as a substitute for the protected registry.

## Current state

This runbook is documentation only. The coordinated migrations and their tests have passed in an isolated replay and a transactionally rolled-back rehearsal against DEMO's actual schema. The live DEMO project has **not** been migrated, no identity has been added to `private.platform_admins`, no admin Edge Function has been deployed, and Production has not been changed.
