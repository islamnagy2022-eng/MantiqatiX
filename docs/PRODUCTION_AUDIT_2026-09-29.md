# MNTY Production Audit — 2026-09-29

## Verified baseline
- Repository: islamnagy2022-eng/MantiqatiX
- Branch: main
- Supabase project: moyhiluyhjsujhwlyeuu
- Supabase status: ACTIVE_HEALTHY
- Database: PostgreSQL 17.6.1.155

## Website gate
- Website source validation: VERIFIED by CI.
- JavaScript syntax/static production guards: VERIFIED by CI.
- Required web assets and selected backend files: VERIFIED by CI.
- GitHub Pages deployment: VERIFIED by CI on run #788.
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
- SECURITY DEFINER callable-by-anon warnings for the three public geographic discovery/delivery RPCs. Current definitions use SECURITY DEFINER with search_path=public; radius/limit inputs are bounded and the functions return operational discovery data only.
- authenticated-callable SECURITY DEFINER warnings remain for workflow-specific operational functions and require adversarial multi-account E2E before release.
- several RLS-enabled tables intentionally have no policies; current migrations revoke anon/authenticated table access and keep these boundaries deny-by-default.

No blanket RLS rewrite is authorized from this audit alone.

## Payment security evidence
- paymob-webhook v4 verifies the Paymob HMAC-SHA512 signature before processing, rejects non-POST requests, requires the HMAC secret, validates amount/currency, and persists provider event identity for idempotency.
- payment-intent v5 requires a non-anonymous Bearer session, checks the production origin, validates the order/pricing snapshot server-side, revalidates pricing after the backend RPC, and keeps the Paymob secret server-side.
- create_order_backend is SECURITY DEFINER and not executable by anon/authenticated roles directly; it enforces auth.uid(), tenant/business/provider/branch checks, idempotency, catalog availability, active price, and server-authoritative pricing.
- create_payment_intent_backend is SECURITY DEFINER and executable by authenticated users because payment-intent invokes it through a user-scoped client; the function itself enforces authenticated identity, tenant/order authorization, payable state, pricing snapshot, amount/currency, provider/method, and idempotency constraints.

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
- [x] Added scripts/validate-booking-payment-flow.mjs.
- [x] Gate verifies public booking auth handoff, authenticated order boundary, backend order RPC, catalog availability, active server pricing, pricing authority, payment pricing snapshot, Paymob integration boundary, and absence of direct client writes to orders/payment intents.
- [x] Initial gate run #785 failed because the test expected an incorrect source marker (h instead of authHeader). This was a test defect, not a production failure.
- [x] Corrected the invariant and reran CI.
- [x] GitHub Actions run #786 succeeded: validate + deploy + deployed-site verification.
- [x] Verified CI baseline commit: 8196cf532f754421171a43b1172f7e229c9be726.

## 2026-09-29 — CI baseline + monitoring verification
- [x] GitHub Actions run #787 for the audit update completed successfully.
- [x] Verified CI baseline commit: 6561e79d8f0171b39067d9bfdffab2cdf26bb8ac.
- [x] Supabase Edge Functions relevant to the production flow are ACTIVE, including api, order-create, payment-intent, payment-webhook, and paymob-webhook.
- [ ] Monitoring verification remains BLOCKED: the Supabase unified-log query backend returned an internal backend error for an error/fatal aggregation query.

## 2026-09-29 — Monitoring recheck
- [x] Supabase unified logs returned per-source counts on recheck: edge_logs 1055, postgrest_logs 684, postgres_logs 572, auth_logs 170, auth_audit_logs 59, pgbouncer_logs 12, function_logs 7, storage_logs 6, function_edge_logs 3, realtime_logs 2.
- [ ] Error-rate verification remains BLOCKED: filtering/reading detailed log rows still returns a Supabase unified-log backend error.
- [x] GitHub Actions run #788 completed successfully: validate PASS, deploy PASS, deployed-site verification PASS.

## 2026-09-29 — Pages run #789 failure analysis
- [x] Validate job PASSed completely, including syntax checks and all production static validators.
- [x] Pages artifact upload PASSed.
- [ ] Deploy job FAILED at actions/deploy-pages@v4.
- [x] Root cause verified from job log: the rerun sequence left 3 artifacts named github-pages in the same workflow run, and actions/deploy-pages@v4 rejected the deployment with "Multiple artifacts named github-pages were unexpectedly found".
- [x] This failure is isolated to the repeated workflow-run artifact state; it did not fail because of site validation or application code.
- [x] Fresh GitHub Actions run #790 completed successfully: validate PASS, deploy PASS, and deployed-site verification PASS.
- [x] Verified website baseline commit: 6336864003a8554570214794e97eeef853f6fb67.

