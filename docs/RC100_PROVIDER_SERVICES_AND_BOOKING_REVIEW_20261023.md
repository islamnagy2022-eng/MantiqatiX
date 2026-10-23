# RC100 / C3 — Provider Services and Order/Booking Review
Date: 2026-10-23
Branch: `work/module-parity-wave1-20261023`
Related PR: https://github.com/islamnagy2022-eng/MantiqaTiX/pull/350

## Provider services
- The current operations workspace implements add/edit/activate/deactivate/delete against the existing `marketing_provider_services` table.
- Mutations re-check ownership by matching `marketing_provider_profiles.owner_user_id` to the authenticated user.
- Update/delete operations constrain both `provider_id` and `service_id`; Supabase Auth/RLS remains authoritative.
- The UI only offers ACTIVE master-catalog services and validates non-negative finite price ranges.
- Existing `scripts/validate-provider-services-contract.mjs` is included in the Pages validation workflow.
- RC100 does not establish a generic provider availability/schedule table; no new schema was introduced.

## Order lifecycle source review
- `order-create` requires a non-anonymous authenticated user, validates branch selection, resolves catalog items and active prices server-side, calculates authoritative totals, and delegates persistence to `create_order_backend`.
- `order-status-update` authenticates the Bearer identity, rejects anonymous users, and delegates to `update_order_status_backend`.
- Existing contract documentation records backend enforcement of tenant/business scope, allowed transitions, customer cancellation rules, and paid-order cancellation/refund boundaries.

## Medical booking source review
- RC172 uses the existing `medical_appointments` table and backend functions; no parallel booking table was added.
- Appointment creation binds the supplied user to `auth.uid()`, requires an active provider and active tenant membership, and checks duplicate appointment IDs and doctor-slot collisions.
- RC340 gates non-cancellation status changes to provider/owner/admin/manager roles; patients may cancel only their own appointments.
- `scripts/validate-booking-payment-flow.mjs` was extended with 11 static assertions for order status authentication/RPC delegation and medical booking/status authorization contracts. The duplicate-ID assertion was aligned to `APPOINTMENT_ID_ALREADY_EXISTS`.

## Verification status
- Source inspection: DONE.
- Static validator source update: IMPLEMENTED.
- Latest exact-head CI: **NOT VERIFIED**. The available commit-run and combined-status queries returned no run/status for commit `084d86838ba197e7ced7c5330ca5a00c5856c997`; do not infer success from earlier runs.
- Browser E2E with two provider accounts: NOT VERIFIED.
- Medical booking slot-conflict E2E and separate-role status transitions: NOT VERIFIED.
- Order status-transition E2E, paid-order cancellation/refund E2E: NOT VERIFIED.
- No production DDL/DML, migration execution, merge, or deployment was performed.

## Next actions
1. Resolve the latest branch/PR head and verify CI on that exact SHA.
2. Run the provider-services, booking/payment, module-runtime, and JavaScript syntax validators on the same checkout.
3. Execute isolated browser tests with separate provider/customer/operator identities and verify cross-provider/tenant denial.
4. Keep release status BLOCKED / NOT CERTIFIED until all required tests pass.
