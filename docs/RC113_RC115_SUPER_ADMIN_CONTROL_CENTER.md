# MantiqatiX — RC113–RC115 Control Center Integration

## Delivered in the development branch

- RC113 defines custom scoped roles and role assignments using the existing `private.platform_admins` registry as the only root authority.
- RC114 adds activity-owned positions and employee records with audit entries.
- RC115 adds guarded platform people/assignment/audit listing RPCs, a scoped permission resolver, employee list RPC, and employee-to-`user_memberships` synchronization.
- The new Super Admin Control Center UI includes custom-role editing, permission matrix, scoped assignment/revocation, activity employee management, and an audit-log viewer.
- Business owners can open the “الموظفون والتوظيف” tab from their own activity dashboard. Platform administration can select an activity from the central control panel.
- Activating an employee requires an existing Supabase identity with the same email. The employee membership uses role `EMPLOYEE`; it is never mapped to `OWNER`, `ADMIN`, or `SUPER_ADMIN`.
- Direct browser access to administrative and employee tables remains revoked. Administrative data is read or changed through SECURITY DEFINER RPCs that validate the actor and scope.

## Permission enforcement boundary

The central function `mnty_platform_has_permission(permission_key, tenant_id, business_id, branch_id)` evaluates the current user's active membership permission document and active scoped custom-role assignments.

**An existing API/RPC must explicitly call this function to enforce custom permissions.** RC115 uses it in the employee list, position writer and employee writer. Other modules (catalog, orders, finance, subscriptions, settings, and module access) still require module-by-module integration and direct API/RLS negative tests. Merely saving a role definition does not grant unintegrated APIs access.

The current admin screen is a real UI wired to the guarded RPCs, but this PR must remain a draft until:
1. The forward migration replay and frontend build/type check succeed.
2. RPC behavior tests prove non-owner rejection, tenant/business/branch isolation, permission revocation, and employee suspension.
3. Every sensitive module explicitly invokes the permission resolver or has an equivalent enforced policy.
4. The sign-in/role-switch and duplicate-subscription regressions are tested end to end.

## Safety

- This branch does not apply migrations to the production database.
- No historical migration was edited.
- No service-role secret is added to frontend code.
- Role creation and role assignment remain exclusive to users present in `private.platform_admins`; delegated managers cannot create other platform managers or grant platform-owner authority.
- Financial records are not hard-deleted by this work.
