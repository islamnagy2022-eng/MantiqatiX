# Pass 2031–2040 — RC922 tenant-wide provider membership scope

**Date:** 2026-11-23  
**Branch:** `fix/rc922-medical-tenant-wide-provider-membership-20261123`  
**Scope:** source migration, disposable PostgreSQL 17 tests, release contract and CI only.

## Finding

RC921 required `user_memberships.business_id = appointment.business_id` before checking the assigned provider profile. A tenant-wide active SERVICE_PROVIDER membership with `business_id IS NULL` could therefore not update appointments for the user's own provider profiles in that tenant. The correct fix is not a general NULL-business exception.

## RC922 behavior

- Permit a NULL-business membership only when `upper(role) = 'SERVICE_PROVIDER'` and the membership tenant equals the appointment tenant.
- Continue to require the appointment's doctor profile to be ACTIVE, owned by the authenticated user, attached to the exact appointment business, and within the exact tenant.
- Preserve RC921 patient self-cancellation, row-level `FOR UPDATE`, forward-only status matrix, empty `search_path`, and authenticated-only EXECUTE privileges.
- Do not grant the tenant-wide exception to MANAGER, ADMIN, OWNER, or BUSINESS_OWNER memberships.

## Test evidence

- Timestamp created by Supabase CLI v2.122.0 in CI: `20261123221950_rc922_medical_appointment_tenant_wide_provider_scope.sql`.
- Disposable PostgreSQL 17 workflow [45278540531](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/45278540531) passed CLI migration generation, source validator, RC921 fixture/migration/integration, RC922 fixture/migration/integration and row-lock concurrency regression.
- Positive case: tenant-wide SERVICE_PROVIDER updates an appointment only when its doctor profile is its own ACTIVE profile for the exact appointment business and tenant.
- Negative cases: same-tenant cross-business appointment tied to another user's profile is denied; tenant-wide MANAGER, ADMIN and OWNER do not receive the SERVICE_PROVIDER exception.
- Test concurrency runner now accepts `PGDATABASE`, preserving the prior default `rc921_test` while supporting a combined disposable suite.

## Release gate

- The current required migration set increased from 78 to 79 exact versions. RC922 is included in the live contract, verifier source list, migration gate, reconciliation manifest, backup runbook and release backlog.
- Standard forward replay now applies RC921 then RC922 on disposable PostgreSQL 17 and runs both behavioral suites plus concurrency.
- Exact-head CI and the combined 79-version chronological replay must pass before PR merge.

## Production safety

- The latest recorded read-only Production migration ledger remains 310 rows through `20261110150618`.
- RC922 has **not** been applied to Production. No Production DB, Auth, RLS, GRANT, Storage, Edge, payment, wallet, settlement or customer-data mutation occurred.
- Encrypted off-site DB/Storage backup, Auth recovery coverage, Vault recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO remain NOT VERIFIED.
- Website V1 is a separate deployed surface; full platform remains **BLOCKED / NOT CERTIFIED**.
