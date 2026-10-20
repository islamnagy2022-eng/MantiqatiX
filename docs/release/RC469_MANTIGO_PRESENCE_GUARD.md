# RC469 — MantiGO captain presence guard

Date: 2026-10-21

## Implemented on the candidate branch
- The authoritative SECURITY DEFINER RPC rejects null or invalid availability status.
- A captain cannot become AVAILABLE unless the stored profile is ACTIVE and VERIFIED; NULL status values fail closed.
- AVAILABLE requires both latitude and longitude, and coordinate bounds are checked server-side.
- The profile row is locked while checking and updating presence; the RPC binds the supplied actor to auth.uid().
- Execute grants remain limited to authenticated callers.

## Regression coverage added
- `supabase/tests/rc462_mantigo_presence_guard_fixture.sql`
- `supabase/tests/rc462_mantigo_presence_guard_integration.sql`
- Dedicated PostgreSQL 16 job in `.github/workflows/module-professionalization.yml`
- Release validator and production migration verifier now include the uniquely numbered RC469 migration.

The PostgreSQL integration job is intended to test missing coordinates, verified success, unverified and NULL status rejection, missing profile, actor mismatch, and out-of-range coordinates.

## Release status
BLOCKED / NOT CERTIFIED until GitHub Actions completes successfully and the migration ordering/reconciliation is checked against the intended target database. This change has not been applied to production.
