# Pass 1410–1419 — Platform-admin and employee scope review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only full function-definition, schema constraints/triggers, ACL and helper review; source/test inspection. No application rows selected, no RPC invoked, no Production mutation.

## 1. Functions 31–40 of 59 direct-auth SECURITY DEFINER functions

- `mnty_business_employee_position_upsert(...)`: rejects anonymous sessions; checks active OWNER/BUSINESS_OWNER/ADMIN or scoped HR permission; validates tenant/business and branch/business; permission ceiling prevents employee permissions beyond caller's scope; on role reduction it clears stale employee overrides before syncing membership permissions/status. Empty search_path.
- `mnty_business_employee_upsert(...)`: rejects anonymous sessions; checks active OWNER/BUSINESS_OWNER/ADMIN or scoped HR permission; validates business/tenant, active position, branch/business, email-to-confirmed-auth-user binding, status, permission override subset; revokes old linked membership on identity change and synchronizes the EMPLOYEE membership. Empty search_path.
  - **P2 scope consistency gap (#917):** position lookup uses `(p_branch_id IS NULL OR p.branch_id=p_branch_id)`; when a business-wide manager passes NULL, a branch-specific position can be selected, while the employee and linked membership are written with NULL branch (business-wide). Update path can similarly clear a branch-specific employee's branch. No table constraint or trigger enforces employee/position branch equality. The actor must already have business-wide authority, so this is not demonstrated privilege escalation beyond the actor's authority; it is a least-privilege and data-consistency issue. The existing professional-dashboard integration test covers branch-only manager denial and permission ceilings, but not branch-specific position assigned to a NULL-branch employee.
- `mnty_commission_rule_drafts(...)`: live function still derives platform admin from a generic SUPER_ADMIN membership with PLATFORM/full_control flags and permits tenant OWNER/BUSINESS_OWNER/ADMIN/MANAGER for commission rule operations. RC467 source changes commission draft management to registry-backed platform admin only; live Production migration remains absent. P1 #884 tracks this.
- `mnty_platform_admin_assign_custom_role(...)`: requires non-anonymous actor present in `private.platform_admins`; validates role scope (TENANT/BUSINESS/BRANCH/PROVIDER), active tenant, business/tenant and branch/business; inserts/updates assignment and audits.
- `mnty_platform_admin_list_audit(...)`: registry-only; returns bounded latest 200 audit entries including actor email and old/new values.
- `mnty_platform_admin_list_businesses(...)`: registry-only; returns bounded latest 300 businesses with nested memberships and user identity fields.
- `mnty_platform_admin_list_custom_roles()`: registry-only; lists platform custom roles.
- `mnty_platform_admin_list_people(...)`: registry-only; returns bounded latest 200 auth users, email, phone, profile names and memberships.
- `mnty_platform_admin_list_role_assignments()`: registry-only; lists assignments with linked user/role identities and scope.
- `mnty_platform_admin_manage_business(...)`: registry-only; row-locks business, validates UPDATE/DEACTIVATE/RESTORE, changes business state/settings and writes audit log.

## 2. Platform-admin RPC aggregate

A fresh catalog aggregate found **9** public SECURITY DEFINER functions whose names start `mnty_platform_admin`; all 9 reference `private.platform_admins`, all 9 use empty search_path, and all 9 are executable by authenticated. This confirms these dedicated control-center RPCs use the registry; it does not cure the separate `mnty_can_platform_admin()` helper used by global MantiGO RPCs (P0 #867).

## 3. Employee branch-position mismatch

The live employee-upsert body allows NULL branch input to select a branch-specific position, then writes NULL branch into both employee and linked membership. `mnty_active_membership` treats NULL branch membership as business-wide. Catalog inspection found no non-internal triggers on `business_employees` or `business_job_positions`, and no constraint enforces equality of tenant/business/branch between employee and its referenced position. The existing disposable professional-dashboard integration test verifies branch-owner cannot create whole-business positions, but does not test assignment of a branch-specific position to a branchless employee.

P2 Issue **#917** records the exact mismatch and required tests. Do not treat it as a proven cross-tenant breach; the authorized actor must already have business-wide employee-management capability.

## 4. Commission source/Production gap

RC467 `20261115010000_rc467_commission_scope_hardening.sql` is the existing source repair for `mnty_commission_rule_drafts` and the related preview RPCs. Its validator and integration test passed within the isolated ordered replay run **44239964551**. Live Production still has the old membership-derived commission gate; RC467 is absent from the live ledger. P1 #884 remains open until coordinated release and post-deploy verification.

## 5. Disposition

- Seven dedicated platform-admin RPCs in this slice were inspected; the aggregate confirms all nine `mnty_platform_admin_*` SECURITY DEFINER functions are registry-backed with empty search_path.
- Employee permission ceilings, identity binding and membership synchronization are present; one branch-position consistency gap remains tracked as P2 #917.
- Commission rule authorization remains live-drifted; RC467 source repair is ready but unapplied (#884).
- Continue full-body review of remaining **19** direct-auth SECURITY DEFINER functions.
- Production remains **BLOCKED / NOT CERTIFIED** pending coordinated migration/Edge, backup/restore, rollback, payment/privacy E2E and post-deployment verification.

No employee, membership, business, branch, audit, commission or role-assignment rows were selected. No function was invoked. No Production DDL/DML, grant, RLS, Auth, Storage, Edge, payment, wallet, settlement or deployment mutation occurred.
