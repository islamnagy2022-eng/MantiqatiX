# MantiqatiX — MantiGO Production Gap Report

## Snapshot
Date: 2026-10-07
Repository baseline: main
Supabase project: moyhiluyhjsujhwlyeuu

> This report deliberately separates implementation from verification. No Production Ready / 100% claim is issued here.

## VERIFIED
- Production Supabase project is ACTIVE_HEALTHY.
- Critical MantiGO RPCs are blocked for anon and exposed only to authenticated where required.
- MantiGO captain self-escalation path is closed; direct captain-profile update is revoked.
- Captain identity, verification, vehicle and availability are sourced from backend-controlled profile state.
- Ride creation has idempotency and authoritative route/price validation.
- Bid acceptance uses row locking and server-side ownership/state checks.
- Trip status transitions are backend-controlled and payment-gated before STARTED/COMPLETED.
- MantiGO financial ledger, cash confirmation, Paymob intent and webhook state binding exist.
- Rating submission is immutable/idempotent.
- Digital-page publication is payment/fulfillment gated.
- Financial-config RLS is enabled and client access is fail-closed.
- Every public ordinary table currently has RLS enabled.
- All core MantiGO tables deny direct anon writes; sensitive ledger/config/profile tables also deny direct authenticated writes.
- Live MantiGO security boundary inspection confirms critical SECURITY DEFINER RPCs use hardened search_path and anon execution is disabled.
- DB-enforced MantiGO abuse controls are now installed for ride creation and captain bid creation, with advisory-lock serialization and configurable internal thresholds (10 rides/hour/customer, 30 bids/hour/captain).
- Latest GitHub main baseline before the abuse-control change had successful deploy and production-health workflow evidence.
- Live migration history includes the MantiGO hardening/finance/payment/rating/config migrations plus mantigo_abuse_rate_limits_v1.

## SECURITY REVIEW — CURRENT
Supabase Security Advisor currently reports:
- 1 intentional anonymous SECURITY DEFINER boundary: get_mnty_targeted_advertisements.
- 32 authenticated-callable SECURITY DEFINER findings. These are not automatically vulnerabilities; many are deliberate backend RPC boundaries.
- 1 informational RLS-without-policy finding on digital_page_payment_events. This is intentionally backend-only and has no anon/authenticated table access.
- Additional anonymous-policy findings exist across legacy/general modules and require contextual product review; they are not being silently classified as safe.

High-risk functions inspected include payment intent creation, RBAC helpers, commission preview, MantiGO admin/report/earnings, captain review, stale ride expiration and settlement. The reviewed functions use auth.uid()/membership/RBAC checks and hardened search_path where applicable.

## NOT VERIFIED / BLOCKERS
1. Multi-user and multi-tenant adversarial E2E.
2. Real Paymob transaction and webhook replay against a real provider transaction.
3. Real settlement + GL reconciliation rehearsal.
4. Notification delivery/click-through on a real browser/device.
5. Production browser smoke from an independent browser environment.
6. Backup restore rehearsal, measured RPO/RTO and rollback rehearsal.
7. Android signed release and real-device E2E.
8. Supabase leaked-password protection managed setting.
9. Full MantiGO state-machine/concurrency/IDOR test matrix.

## MantiGO FUNCTIONAL GAPS STILL OPEN
- Destination map coordinates and map UI.
- Distance/duration provider integration.
- Tracking map.
- Customer receipt/invoice.
- Full captain active-trip UX and persistence.
- Configurable matching radius/weights/service-area matching.
- Full notification lifecycle and push delivery proof.
- Refund/cancellation-fee policy and reconciliation.
- Operations dashboard/filtering/dispute workflow.
- Offline conflict/idempotency semantics and real-device proof.

## RELEASE DECISION
**PRODUCTION CERTIFICATION: NOT ISSUED.**

The implementation has advanced materially, but external/runtime evidence remains the release authority. This document must never be used to convert NOT VERIFIED items into VERIFIED status.