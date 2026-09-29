# MNTY Production Audit — 2026-09-29

## Verified baseline
- Repository: islamnagy2022-eng/MantiqatiX
- Branch: main
- Commit: d0d61a4b75d97f93076a8b9360f56ca2b1c24836
- Commit: seo(web): declare platform author metadata
- GitHub Actions run: #782
- Validation: PASS
- Deployment: PASS
- Published-site smoke verification: PASS
- Supabase project: moyhiluyhjsujhwlyeuu
- Supabase status: ACTIVE_HEALTHY
- Database: PostgreSQL 17.6.1.155
- Latest live migration: 20260928234315 / rc212_nearest_provider_fallback

## Website gate
- Website source validation: VERIFIED by CI.
- JavaScript syntax/static production guards: VERIFIED by CI.
- Required web assets and selected backend files: VERIFIED by CI.
- GitHub Pages deployment: VERIFIED by CI.
- External browser interaction: NOT VERIFIED in this execution environment.
- Functional authenticated E2E: NOT VERIFIED.

## Live data gate
Current public schema inspection shows:
- businesses: 0
- branches: 0
- marketing_provider_profiles: 0
- marketing_provider_services: 0
- catalog_items: 0
- catalog_item_prices: 0
- orders: 0
- payment_intents: 0
- payment_events: 0
- payment_provider_events: 0
- advertisements: 0
- bookings: 1
- platform_geo_areas: 28
- advertisement_target_locations: 0
- platform_global_advertisements: 4

Therefore a real production booking chain Provider → Business → Branch → Service → Price → Order cannot currently be verified from live production data without introducing real authorized business/provider data.

## Security findings
Supabase Security Advisor currently reports:
- leaked password protection: WARN / disabled.
- SECURITY DEFINER callable-by-anon warnings for the three public geographic discovery/delivery RPCs; these are intentionally exposed read-only operational functions and are guarded by bounded inputs/search_path and sanitized output in the current migrations.
- authenticated-callable SECURITY DEFINER warnings remain for workflow-specific operational functions and require adversarial multi-account E2E before release.
- several RLS-enabled tables intentionally have no policies; current migrations revoke anon/authenticated table access and keep these boundaries deny-by-default.

No blanket RLS rewrite is authorized from this audit alone.

## Release blockers
1. Real authenticated browser E2E.
2. Provider/business/branch/service/price/order chain using authorized real data.
3. Payment provider E2E including webhook replay/idempotency/refund/reconciliation.
4. Auth/session/role authorization E2E.
5. Backup → Restore → Verify evidence.
6. Monitoring/alert/incident verification.
7. Rollback rehearsal.
8. External browser/device regression.
9. Supabase leaked-password protection must be enabled in project Auth Security settings, then Security Advisor rechecked.

## Decision
Status: NOT PRODUCTION READY.
Reason: release gates remain NOT VERIFIED; no claim of production certification is made.


## 2026-09-29 — Booking / Payment CI gate
- [x] Added `scripts/validate-booking-payment-flow.mjs`.
- [x] Gate verifies public booking auth handoff, authenticated order boundary, backend order RPC, catalog availability, active server pricing, pricing authority, payment pricing snapshot, Paymob integration boundary, and absence of direct client writes to orders/payment intents.
- [x] Initial gate run #785 failed because the test expected an incorrect source marker (`h` instead of the implementation's `authHeader`). This was a test defect, not a production failure.
- [x] Corrected the invariant and reran CI.
- [x] GitHub Actions run #786 succeeded: validate + deploy + deployed-site verification.
- [x] New verified baseline commit: `8196cf532f754421171a43b1172f7e229c9be726`.


## 2026-09-29 — CI baseline + monitoring verification
- [x] GitHub Actions run #787 for the audit update completed successfully.
- [x] Verified CI baseline commit: `6561e79d8f0171b39067d9bfdffab2cdf26bb8ac`.
- [x] Supabase Edge Functions relevant to the production flow are ACTIVE, including `api`, `order-create`, `payment-intent`, `payment-webhook`, and `paymob-webhook`.
- [ ] Monitoring verification remains BLOCKED: the Supabase unified-log query backend returned an internal backend error for an error/fatal aggregation query. A successful `distinct source` query confirmed the log streams exist, but no claim about current error rates is made until the log query path succeeds.
