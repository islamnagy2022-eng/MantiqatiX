# Pass 2011–2020 — RC921 live parity and tenant-wide membership compatibility — 2026-11-23

## Live/source evidence
- [x] 2011 — Live `update_medical_appointment_status_backend(uuid,text,text)` remains the pre-RC921 SECURITY DEFINER body with `search_path=public,pg_temp`; it binds `p_user_id=auth.uid()`, locks the appointment, but does not bind a SERVICE_PROVIDER to the assigned `doctor_id` profile owner.
- [x] 2012 — Live function allows status values from a simple allowlist but does not enforce a forward-only transition matrix; no non-internal triggers exist on `medical_appointments`.
- [x] 2013 — Main RC921 source adds assigned-provider ownership, exact tenant/business membership, patient self-cancellation, forward-only status transitions, empty search_path, and authenticated-only EXECUTE.
- [x] 2014 — PR #1008 exact-head PostgreSQL 17 behavior/concurrency workflow 45144730674 passed. Migration immutability 45144730536, version uniqueness 45144730782, collision guard 45144730731, backend boundary 45144730778 and module validation 45144730500 also passed.
- [x] 2015 — Pages validation run 45144730519 succeeded; public-only validation and deploy jobs were skipped. No website deployment is claimed.
- [x] 2016 — Live aggregate-only membership check: one active tenant-wide SERVICE_PROVIDER user has `business_id IS NULL` and owns three active provider profiles. No IDs or profile contents were selected.
- [x] 2017 — Live aggregate-only check also found one unique tenant-wide ADMIN/MANAGER/OWNER user with `business_id IS NULL`.
- [x] 2018 — Live `medical_appointments` count is currently zero; this is a future workflow compatibility issue, not a claim of existing appointment damage.
- [x] 2019 — RC921 is not in the old 76-version Production release gate. PR #1013 adds it as required version 77 and adds the exact RPC signature to required core objects; the PR is still under CI and is not merged.
- [x] 2020 — Compatibility gap: RC921 currently requires `um.business_id = v_appointment.business_id` before checking assigned-provider ownership. It therefore rejects the active tenant-wide provider membership and prevents that user from updating appointments for their three owned profiles. It also excludes tenant-wide admin/manager/owner membership.

## Required forward repair
- Do not edit the already-merged RC921 migration. Migration history is immutable.
- Generate a forward-only RC922 migration through the Supabase CLI; allow either exact business membership or a null-business tenant-wide membership for the allowed staff roles, while retaining exact tenant match.
- For SERVICE_PROVIDER, keep the strict `marketing_provider_profiles.owner_user_id=auth.uid()`, profile ID equals appointment doctor ID, same business and same tenant checks. This prevents a tenant-wide provider from changing another provider's appointments.
- Extend the disposable PostgreSQL 17 fixture with a tenant-wide provider whose `business_id IS NULL`, a matching owned profile, a tenant-wide manager case, cross-business manager denial, cross-tenant denial, and provider-A/provider-B ownership denial.
- Add RC922 to the 77+ migration release contract and run the full exact-head replay before considering RC921/RC922 for a Production batch.

**Disposition:** RC921 source fix is valuable and its isolated tests pass, but this compatibility gap must be repaired before Production application. Live RC921 remains unapplied. Full Production remains **BLOCKED / NOT CERTIFIED**.
