# RC468 — Retry-safe medical appointment creation

**Status:** implemented in the candidate branch; exact-head CI and ordered replay required. Not applied to production.

## Finding

The browser keeps a stable appointment request ID when the server response is ambiguous. RC467 returned an idempotency marker on newly created bookings but rejected a duplicate ID; RC468 introduced replay semantics, and this hardening closes a remaining concurrent-request race by serializing operations on the normalized request ID.

## Behavior

- Authenticated caller identity must match `p_user_id`.
- Requests with the same stable ID are serialized before checking the existing booking.
- A retry returns the existing appointment only when patient, business, doctor, timestamp, and normalized reason match exactly.
- A committed booking can still be replayed if the provider is later deactivated, because replay is resolved before current provider availability is checked. The same authenticated patient and exact immutable payload are still required.
- Reusing an ID with a different payload or actor fails closed with `APPOINTMENT_ID_ALREADY_EXISTS` or the identity guard.
- The insert uses `ON CONFLICT (id) DO NOTHING` and validates the conflicting row, protecting against races that reach the insert path concurrently.
- The RPC returns `idempotent_replay: true` for a replay and `false` for a newly created appointment.
- Existing table shape and RPC grants are unchanged. The migration is forward-only.

## Verification added

`supabase/tests/rc468_medical_booking_idempotency_integration.sql` checks exact-payload replay after provider deactivation, unchanged appointment count, conflicting-payload rejection, and actor binding. The Doctor Module Release Contract workflow applies RC457, RC467, then RC468 to an isolated PostgreSQL 16 fixture. The ordered disposable migration replay and production source verifier also track RC468.

These tests are candidate-source evidence only. They do not prove production application, live authenticated browser E2E, or release readiness.

## Next gates

1. Wait for exact-head Doctor Module Release Contract and Module Professionalization workflows.
2. Verify the disposable forward replay includes RC468 and passes on the exact candidate head.
3. Keep PR draft/unmerged and do not apply migrations to production without the required approval and release process.
