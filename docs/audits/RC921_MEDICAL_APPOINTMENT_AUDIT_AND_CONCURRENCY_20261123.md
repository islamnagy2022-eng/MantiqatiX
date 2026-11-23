# RC921 Medical Appointment Status Audit Evidence

Date: 2026-11-23

## Scope

Read-only review of the historical Production function definition and table triggers for `public.medical_appointments`. No Production data or schema was changed.

## Findings

- The pre-RC921 `public.update_medical_appointment_status_backend(uuid,text,text)` implementation updates `status` and `updated_at`, then returns the old and new statuses.
- The function body does not insert into an audit/event table or call an audit RPC.
- A read-only Production catalog query over non-internal triggers attached to `public.medical_appointments` returned zero rows.
- Therefore, the existing status-update path has no table-trigger audit side effect to preserve. RC921 does not invent a new audit contract or claim an audit event exists.
- The RC921 function retains the established JSON response shape: `id`, `old_status`, and `status`.

## Concurrency

The function locks the appointment row using `SELECT ... FOR UPDATE` before checking the old state. A PostgreSQL 17 two-session regression test now forces one transition to hold the row lock while a competing terminal transition waits. The second call must re-read the committed state and reject the invalid terminal transition.

## Safety boundary

The migration is source-only and forward-only. It has not been applied to Production. Production release remains blocked pending the platform's backup, restore, rollback, and approval gates.
