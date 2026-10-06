# MantiGO Production Gap Report — 2026-10-06

## Executive Status

**Production certification: NOT ISSUED**

This report distinguishes implementation from verification. Existing code, migrations and prior reports are not treated as proof of production readiness.

## COMPLETED / VERIFIED AT SOURCE OR DATABASE LEVEL

- Secure ride creation with idempotency key.
- Pickup coordinates captured when browser geolocation is available.
- Captain profile registry.
- Captain onboarding and admin review.
- Captain presence update through protected RPC.
- Captain bid backend with authoritative captain vehicle/rating data.
- Customer bid acceptance with ride-row locking.
- MantiGO financial ledger.
- Fare lock.
- Cash confirmation.
- Paymob payment-intent Edge Function.
- Paymob webhook verification/idempotent provider-event path.
- Payment gate before STARTED/COMPLETED.
- Captain settlement bridge to central settlement/journal.
- Immutable rating with exact-request replay.
- Digital-page publication gate.
- MantiGO customer full-screen request UI.
- MantiGO customer ride/bid/payment realtime UI.
- MantiGO full-screen captain cockpit.
- Captain active-trip transition controls.
- Master production TODO covering all platform domains.

## NOT VERIFIED

- Real customer + captain E2E with real authenticated identities.
- Cross-tenant/customer/provider isolation E2E.
- Real Paymob transaction.
- Real webhook replay.
- Real settlement posting/reconciliation.
- Notification delivery/click-through.
- Browser production smoke.
- Android real-device E2E.
- Offline/reconnect behavior.
- Backup/restore rehearsal.
- Rollback rehearsal.
- Complete MantiGO state-machine/concurrency suite.
- Production Security Advisor final sign-off.

## REMAINING HIGH-PRIORITY IMPLEMENTATION

### MantiGO
1. Map UI and destination coordinates.
2. Distance/duration calculation using an approved map provider.
3. Configurable pricing policy.
4. Customer passenger-count support after schema/API contract is defined.
5. Authoritative captain verification/trips/rating projection in bid cards.
6. Active-trip customer timeline.
7. Captain navigation/pickup UX.
8. Cancellation/no-show policy.
9. Ride expiration worker.
10. Notification lifecycle.
11. Receipt/invoice.
12. Operations dashboard.
13. Dispute/support flow.
14. Rate limiting/abuse protection.
15. Full offline/idempotency/reconnect contract.
16. Automated E2E/concurrency tests.

### Platform
1. Multi-user/multi-tenant E2E.
2. Auth/session regression.
3. CRM E2E.
4. provider/service/location E2E.
5. payment/finance E2E.
6. notification E2E.
7. backup/restore.
8. browser smoke.
9. Android signed release/device E2E.
10. rollback rehearsal.
11. leaked-password protection.
12. final Security Advisor review.

## BLOCKERS

- External/managed Auth setting: leaked-password protection.
- Real payment provider verification.
- Real device release verification.
- Controlled backup/restore rehearsal.
- Multi-user/multi-tenant test fixture.
- Production rollback rehearsal.

## Evidence rule

A task is not VERIFIED because a function exists or because a previous report says it works. It becomes VERIFIED only after the required test produces evidence.

## Latest source changes

- 0de40deeff434ecad09afc86401fdad7231a8320 — master production TODO.
- 1a2faea3f0f58850abc8b732cf8ed77389ef8e78 — captain cockpit.
- f878855826a17dab4c4a3b3527ff37e07d9b1e02 — captain bid input validation.
- f083948eeb69ea6d250806fcba2eb7b18d38aae8 — customer accepts OFFERED bids.
- b3172866a0b8706a8d31e265ff31f55a177425da — captain active-trip controls.
- 99c4da43b0bd8611b819a33beebc6d82f3bd52f2 — render correction after active-trip integration.

CI status for 99c4da43: NOT VERIFIED. No workflow/status result is currently associated with this commit through the available GitHub checks.
