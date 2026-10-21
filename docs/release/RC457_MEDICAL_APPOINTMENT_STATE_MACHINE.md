# RC457 — Medical Appointment State Machine

**Status:** source candidate; review and exact-head CI required. **Not applied to production.**  
**Migration:** `supabase/migrations/20261019190000_rc457_medical_appointment_state_machine.sql`  
**Predecessor source:** RC451 `20261010200000_rc451_targeted_ads_empty_search_path.sql`  
**Live migration ledger observed 2026-10-19:** 283 rows, latest applied version `20261008222845` (RC424). Therefore RC425 onward remains a pending ordered chain; RC457 must not be applied alone or out of order.

## Finding

The live/source definition of `update_medical_appointment_status_backend` locks the appointment row and checks identity/membership, but it accepts any allowed target status without checking whether that transition is valid from the current state. The existing web UI offers:
- `BOOKED → CONFIRMED` for provider/owner/admin/manager roles.
- `BOOKED → CANCELLED` and `CONFIRMED → CANCELLED` for patient/provider flows.
- `CONFIRMED → COMPLETED` for provider/owner/admin/manager roles.

The RPC also explicitly permits `NO_SHOW`, so this candidate permits `CONFIRMED → NO_SHOW` for provider roles. Terminal `COMPLETED`, `NO_SHOW`, and `CANCELLED` states cannot be rewritten through this RPC.

## State contract

| Current state | Target | Actor | Result |
|---|---|---|---|
| BOOKED | CONFIRMED | active provider/owner/business owner/admin/manager in the appointment tenant/business | Allow |
| BOOKED | CANCELLED | owning patient or authorized provider role | Allow |
| CONFIRMED | COMPLETED | authorized provider role | Allow |
| CONFIRMED | NO_SHOW | authorized provider role | Allow |
| CONFIRMED | CANCELLED | owning patient or authorized provider role | Allow |
| Any terminal state | Any change | any actor | Deny |
| Any other transition | any actor | Deny |

The function locks the appointment row with `FOR UPDATE`, binds the caller argument to `auth.uid()`, requires active membership in the appointment tenant/business scope, and leaves existing EXECUTE grants unchanged. This migration changes no table, data, RLS policy, or grant. It also pins the SECURITY DEFINER function to an empty `search_path`; all application relations and `auth.uid()` are schema-qualified, reducing object-shadowing risk.

## Verification

A disposable PostgreSQL 16 integration fixture and test cover successful transitions, invalid/skipped transitions, terminal-state rewrites, patient ownership, cross-tenant membership, same-tenant cross-business denial, caller identity mismatch, invalid target status, and the existing anon/authenticated EXECUTE boundary. The test is wired into the Module Professionalization workflow.

Passing the isolated PostgreSQL test proves the migration candidate's behavior in the fixture only. It does not prove production migration convergence or replace multi-account browser E2E.

## Rollout gate

1. Resolve and review the pending RC425–RC456 chain and migration collision check.
2. Run exact-head CI including RC457's disposable PostgreSQL integration.
3. Replay the full ordered migration chain on disposable PostgreSQL/Supabase and verify no historical migration is edited.
4. Review the state contract with the medical product owner, especially `NO_SHOW` semantics.
5. Only after separate approval and a verified rollback/recovery plan may the ordered chain be considered for staging/production. No production mutation was performed for this candidate.
