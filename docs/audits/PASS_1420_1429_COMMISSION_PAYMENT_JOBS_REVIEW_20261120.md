# Pass 1420–1429 — Commission, payment-claim, settlement and job-application review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only full function-definition, schema/index and ACL inspection; source migration/test review. No application rows selected, no RPC invoked, no Production mutation.

## 1. Functions 41–50 of 59 direct-auth SECURITY DEFINER functions

- `mnty_platform_admin_manage_membership(...)`: registry-only platform admin; row-locks target membership; protects SUPER_ADMIN/PLATFORM_ADMIN and registered platform admins; disallows assigning reserved platform roles; audits suspend/restore/role changes.
- `mnty_platform_admin_upsert_custom_role(...)`: registry-only; validates role key format, supported scope and JSON object; rejects reserved root role keys; protects system roles; audits changes.
- `mnty_platform_has_permission(...)`: rejects missing/anonymous actor and malformed permission key; platform root comes only from `private.platform_admins`; otherwise checks scoped EMPLOYEE/STAFF module permissions or active custom role assignments with exact TENANT/BUSINESS/BRANCH/PROVIDER scope.
- `preview_commission_rule_draft(...)`: validates actor, tenant/rule, numeric inputs and draft state, but live authorization still derives platform admin from SUPER_ADMIN membership flags and permits tenant OWNER/BUSINESS_OWNER/ADMIN/MANAGER. RC467 source changes this to registry-backed platform admin only. P1 #884.
- `preview_commission_rule_resolution(...)`: same live membership-derived gate; validates scope/event/business and deterministic candidate ranking; delegates selected preview to the draft preview RPC. RC467 source repairs both. P1 #884.
- `release_digital_page_payment_intent_claim_backend(...)`: binds user to `auth.uid()`, order owner and exact claim token; only releases when provider intent is still null.
- `review_mantigo_captain_application(...)`: binds supplied admin ID to `auth.uid()`, validates decision and service-area JSON, but platform authorization relies on weak live `mnty_can_platform_admin()`. RC464/RC471 source repair exists; P0 #867.
- `set_mantigo_financial_config_backend(...)`: binds actor, validates commission rate 0–100 and writes audited global config; platform authorization relies on weak live helper. RC464/RC471 source repair exists; P0 #867.
- `settle_mantigo_captain_backend(...)`: binds supplied admin ID to actor and validates completed ride, confirmed payment, locked commission, row-locks ledger and uses idempotent settlement/journal RPC. However, live authorization accepts any ACTIVE membership in a broad role list (ADMIN/SUPER_ADMIN/OWNER/BUSINESS_OWNER/ACCOUNTANT/FINANCE_MANAGER/FINANCE), without registry or tenant/business scope, while settling a platform-wide ride. RC471 source hardens to registry-backed platform admin; issues #92/#94.
- `submit_job_application_backend(...)`: binds applicant to `auth.uid()`, validates required fields, returns ALREADY_APPLIED for duplicates and has a unique (job_id, applicant_user_id) index protecting concurrent duplicates. **P2 state gap (#919):** checks only that job row exists, not `jobs.is_active=true`, so a user can apply after the employer deactivates the job.

## 2. Supporting schema checks

- Live `jobs.is_active` exists as NOT NULL boolean default true.
- `job_applications_job_id_applicant_user_id_key` is a unique index, so duplicate concurrent applications are prevented at the database level.
- No job rows or application records were read.

## 3. Source repair and release state

- RC467 `20261115010000_rc467_commission_scope_hardening.sql` replaces membership-derived commission draft/preview gates with registry-backed platform authorization and scoped business finance access for the operational preview. Static validator and integration test passed in isolated replay run **44239964551**. Live Production still has the old body; migration absent. P1 #884.
- RC464/RC471 replace weak global MantiGO helper/caller and settlement authorization with registry-backed platform root. Source and CI are merged/green; live Production remains on old definitions. P0 #867; P1 #92/#94.
- No source repair for the inactive-job application check was found in the reviewed live body; P2 #919 opened for forward-only correction and behavioral tests.

## 4. Disposition and next work

- Dedicated platform-admin membership and custom-role RPCs use the protected registry and empty search_path.
- Permission resolver correctly distinguishes registry root from scoped staff/custom-role grants.
- Commission previews, captain review/config and settlement remain live Production authorization drift until RC467/RC464/RC471 are deployed together.
- Job application submission must reject inactive jobs while preserving unique-index idempotency.
- Continue full-body review of remaining **9** direct-auth SECURITY DEFINER functions.
- Production remains **BLOCKED / NOT CERTIFIED** pending coordinated migration/Edge, backup/restore, rollback, payment/privacy E2E and post-deployment verification.

No application, membership, commission, financial, settlement, job or job-application rows were selected. No function was invoked. No Production DDL/DML, grants, RLS, Auth, Storage, Edge, payment, wallet, settlement or deployment mutation occurred.
