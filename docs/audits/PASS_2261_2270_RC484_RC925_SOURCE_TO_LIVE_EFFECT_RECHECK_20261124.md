# PASS 2261–2270 — RC484–RC925 source-to-live effect recheck

**Date:** 2026-11-24
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`
**Source baseline:** `main @ e7e0db29943ef843e43e25cc4ef31180f5a1817c`
**Method:** source review of the 19 later migration files plus read-only PostgreSQL catalog, function metadata, policy, index, trigger and column queries. No application, customer, payment, wallet, directory-contact or secret values were selected. No Production mutation occurred.

## 1. Policy inventory

The expected policy inventory for the later migration set contains 30 target policy rows:
- 29 expected restrictive policies are absent.
- One existing policy, `public.agreements.agreements_participant_read`, is present but incorrect: it is PERMISSIVE and its live predicate correlates `ap.agreement_id = ap.id` instead of `ap.agreement_id = agreements.id`; it also uses a COALESCE false default rather than a restrictive missing-claim denial.
- RC495's five named Storage policies exist, but all retain legacy membership-SUPER_ADMIN authorization and old filename predicates rather than the registry-backed source contract.

Expected restrictive policy groups absent:
- RC479 forward repair: 1 provider-profile SELECT guard.
- RC488: 3 Storage write guards.
- RC489: 15 private financial/payment read guards.
- RC490: 1 medical appointment read guard.
- RC491: 1 support-ticket read guard.
- RC492: 4 InDrive request/bid guards.
- RC493: 3 CRM/project/notification read guards.
- RC924: restrictive agreement confirmed-Auth SELECT guard.

## 2. Function and authorization inventory

### Platform root / catalog
- `private.platform_admins` exists with RLS enabled, but FORCE RLS is off.
- `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public` and legacy membership-derived logic.
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp` and legacy unscoped helper behavior.
- All seven catalog RPC signatures exist, but all seven remain `search_path=public`; none references `private.platform_admins`.
- Four catalog RPCs retain a COALESCE-based anonymous check; three have no anonymous claim check. None requires `is_anonymous IS DISTINCT FROM 'false'`. RC925 is source-only and not applied to Production.

### SMM, Storage and settlement
- RC487: `auth.users.trg_smm_bootstrap_admin` and `public.smm_bootstrap_first_admin()` both remain present.
- RC494: `settlement_transactions.business_id` and `settlement_transactions_business_id_idx` are absent. The live settlement writer exists but retains `search_path=pg_catalog, public`.
- RC495: all five named Storage policies exist but retain old membership-based platform branding checks and legacy regex expressions.

### MantiGO and medical
- RC496: `mantigo_bids_one_accepted_per_ride_idx` is absent; accept/create/fare-lock functions exist but remain `search_path=public`.
- RC921/RC922: `update_medical_appointment_status_backend(uuid,text,text)` exists but remains `search_path=public, pg_temp`; live body lacks the assigned-provider and forward-only transition guards from current source.

## 3. RC924 agreement privacy defect

The expected restrictive policy `agreements_confirmed_auth_select` is absent. The existing `agreements_participant_read` is PERMISSIVE and currently contains the parent-correlation error `ap.agreement_id = ap.id` rather than `ap.agreement_id = agreements.id`. The same predicate uses COALESCE to treat a missing `is_anonymous` claim as false. This existing policy is not a semantic pass; the agreement read surface remains blocked until the coordinated RC924 repair is applied and tested.

## 4. RC925 source-comment consistency

The RC925 migration's executable predicates require `(auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false'` in all seven functions, correctly denying explicit anonymous tokens and missing/NULL claims. Its leading comment incorrectly described the old COALESCE fail-open predicate. The source comment and static validator are corrected in the accompanying PR; no SQL behavior changes. Exact-head 82-version replay is required again because the migration source file changes.

## 5. Crosswalk and limitations

- `docs/release/REQUIRED_82_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261124.md` lists all 82 ordered source files.
- The earlier 63-source object map is retained as historical input; its old statuses are not represented as fresh live verification.
- The 19 later migrations have current source-to-live evidence in the new crosswalk.
- The curated 76-object read-back remains a separate sample (35 present / 41 absent), not a full map of all migration effects.
- Production ledger remains 310 rows through `20261110150618`; 0/82 exact version IDs. This is an identity mismatch, not proof all effects are absent.

**Disposition:** keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`. No Production DDL/DML, migration, ACL, RLS, Auth, Storage, Edge, payment, settlement or customer-data mutation occurred.