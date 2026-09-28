# RC177–RC180 — Homepage & Booking Release Baseline

## Goal
Make the public homepage a real marketplace entry point before expanding additional modules.

## Implemented
- Homepage provider cards now expose `احجز / اطلب خدمة` when an active provider has an operational business.
- Unauthenticated users preserve the intended provider context through `MNTYPendingProvider` and resume the catalog after successful customer authentication.
- Customer marketplace authorization was widened safely for cross-tenant ordering: a customer may order from an ACTIVE provider business without gaining membership permissions inside that provider tenant.
- `create_order_backend` now requires either membership in the target tenant or an ACTIVE CUSTOMER membership elsewhere, verifies an ACTIVE provider profile for the target business, and retains server-authoritative catalog/pricing validation.
- API catalog/order access applies the same customer cross-tenant boundary and requires an ACTIVE provider profile.
- Added local default artwork for completed sector modules: Education, Jobs, Used Items, Fashion.
- Added a local MNTY homepage hero artwork; no external image dependency was introduced.

## Explicitly not claimed
- No real customer order or booking was created.
- Paymob/payment completion for cross-tenant customer orders is not yet verified.
- Browser/mobile E2E is not yet verified.
- Provider-side acceptance/status notification E2E is not yet verified.
- CI/release-gate status for the latest commits is not yet verified.
