# RC76 — Production Release Closure Program

Date: 2026-09-28

## Purpose

This checkpoint consolidates the remaining release gates after RC75. It does not mark the product Production Ready; it defines the final evidence required to reach that state without fabricating results.

## Production Edge Function inventory

The live project currently exposes 26 ACTIVE functions. The tracked GitHub tree currently exposes 6 function directories. The difference is a source-convergence gap, not proof that the additional production functions are unused or unsafe.

The live inventory includes the payment, business, approval, legal, subscription, AI, ERP, SMM, and registration surfaces already audited in the release program.

## Closed controls

- High-risk permissive RLS policies removed from the audited financial/order/business surfaces.
- Broad media Storage boundary removed.
- Payment pricing, signature verification, provider-event idempotency and server-side financial boundaries reviewed.
- Public client secret exposure reviewed.
- SMM gateway CORS hardened and redeployed as production version 5.
- RC70/RC71 migration SQL tracked in GitHub.

## Final external evidence gates

1. CI workflow completes successfully on the intended release commit.
2. Android release build, signing, APK/AAB artifact and physical-device regression.
3. Real Paymob test transaction and verified webhook/replay/idempotency evidence.
4. Two independent users across tenant boundaries for authorization E2E.
5. Two-user/two-tenant Storage isolation E2E.
6. Isolated backup restore drill with measured RPO/RTO.
7. Supabase Auth leaked-password protection enabled and verified.
8. Complete source mapping for all ACTIVE production Edge Functions.
9. Historical production migration source convergence.
10. Final rollback rehearsal and release artifact retention.

## Release rule

MantiqatiX remains NOT CERTIFIED as final Production Ready until the external evidence gates above are closed. Operational availability is not equivalent to release certification.

No production test accounts, fake transactions, fake provider responses, or speculative migrations are authorized as substitutes for evidence.
