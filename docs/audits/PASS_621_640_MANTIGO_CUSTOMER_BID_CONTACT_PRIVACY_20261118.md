# Pass 621–640 — MantiGO customer bid contact privacy repair (2026-11-18)

## Confirmed live privacy issue

Read-only inspection of `public.list_mantigo_customer_rides_backend(uuid,text)` showed that its `bids` array used `to_jsonb(b)` for every bid on a customer's ride. The live `mantigo_bids` table includes `captain_phone` and `vehicle_plate`, so the RPC returned those direct contact/vehicle identifiers for OFFERED and other non-accepted bids.

The customer needs captain name, rating, vehicle model, offered price, ETA and message to compare offers. Direct phone and plate are not needed until the customer accepts the bid.

## RC477 implementation

- Added `supabase/migrations/20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql`.
- Preserved the existing customer ride JSON envelope and bid fields.
- For non-ACCEPTED bids, the response retains `captain_phone` and `vehicle_plate` keys with JSON null values.
- For ACCEPTED bids, phone and plate remain available for the active ride relationship.
- Preserved `auth.uid()` actor binding, authenticated-only EXECUTE and revoked PUBLIC/anon execution.
- Pinned the SECURITY DEFINER routine to an empty search_path.
- Added a schema preflight for the exact columns and read dependencies.

## Regression coverage

Extended the disposable RC446 fixture with the full bid contact fields plus the ledger/rating relations required by the customer read RPC. Added `supabase/tests/rc477_mantigo_customer_bid_contact_privacy_integration.sql` and static validator `scripts/validate-rc477-mantigo-customer-bid-contact-privacy.mjs`. The MantiGO open-ride privacy workflow now applies RC477 after RC446 and executes the new integration test.

The exact-head test verifies:
- OFFERED bid phone and plate are null and keys remain present.
- ACCEPTED bid phone and plate remain visible.
- Name, vehicle model and offered price remain unchanged.
- Actor mismatch is rejected.
- anon/authenticated EXECUTE grants remain correct.
- Empty search_path is configured.

## Exact-head verification and merge

PR #790 exact-head checks passed:
- RC477 static contract and RC446/RC477 disposable PostgreSQL integration (`RC477 customer bid contact privacy integration: PASS`).
- Forward migration chain replay from the captured Production schema checkpoint.
- Migration immutability/version/collision checks.
- MantiGO open-ride privacy, RC425 Paymob atomicity, backend-only module boundary, approval-action audit and module professionalization suites.
- Catalog/V6 Pages build and browser validation.

PR #790 merged to main as `613bcb654202a2a5bfb6028d43e7b80b9a772388`.

## Production boundary

No Production SQL, Auth, RLS, GRANT, Edge, payment, wallet or settlement mutation occurred. RC477 is source-merged but **not applied to Production**. The release remains blocked by the encrypted off-site backup/restore requirement and exact migration-ledger reconciliation. RC464/RC471 and RC476 also remain source-merged but unapplied.
