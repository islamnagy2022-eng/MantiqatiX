# RC341 — Mantiqati official activity profiles

Date: 2026-10-04

## Implemented
- Added a reusable public profile dialog for official Mantiqati showcase activities.
- The profile is opened from the homepage activity card instead of forcing immediate login.
- The dialog reads the active featured provider profile from `marketing_provider_profiles`.
- It validates the linked business as ACTIVE and `settings.showcase=true`.
- It reads the provider's active service links and resolves their names from `marketing_services`.
- It displays existing specialties and portfolio content.
- Pricing is displayed only when stored in the live catalog; otherwise the UI explicitly says the price is determined by request.
- No synthetic price, order, booking, customer, or financial record is created.
- Added accessible modal semantics, Escape close, backdrop close, focus target, responsive layout, and a controlled login CTA.
- Refreshed the homepage stylesheet cache version to RC341.

## Security boundary
This is read-only public showcase behavior. It does not grant management permissions, create memberships, write orders, or expose service-role credentials. Existing RLS remains authoritative.

## Verification status
- Source change committed to `main`.
- CI/deployed-site verification must be taken from the latest GitHub Actions run for the final RC341 commit.
- Browser runtime smoke is still an external verification gate.
- Final Production Gate remains OPEN / NOT PRODUCTION READY YET because previously documented Auth, adversarial multi-tenant E2E, payment/finance, recovery, browser/device/PWA/push, and Android evidence remain open.
