# RC94 — Production Hardening / Source Convergence

Date: 2026-09-28

## Production evidence

### payment-intent
- Production version: 5
- verify_jwt: true
- Live SHA-256: a2d0bda37fb052bb4d6a38b5917ce76f466f2e88c9a000ba02a942dd474d6533
- Live source is byte-for-byte equal to GitHub main source.
- The deployed source rejects all order states except PENDING and CREATED.
- No real payment transaction was created during this change.

### Source convergence
The following live Edge Function sources were reconciled/tracked without behavioral modification:
- payment-webhook: live v1 already converged.
- api: live v10 converged.
- order-create: live v3 converged.
- order-status-update: live v2 converged.
- settlement-create: live v3 converged.
- smm-gateway: live v6 converged.
- mnty-push-dispatch: live v2 source copied to GitHub; production was not redeployed.
- paymob-webhook: live v4 source copied to GitHub; production was not redeployed.
- business-approval: live v4 source copied to GitHub; production was not redeployed.

### Database/security verification
- public tables: 113
- RLS enabled: 113/113
- FORCE RLS: 100/113
- migrations: 172
- pg_net remains installed in public schema.
- create_payment_intent_backend remains SECURITY DEFINER and executable by authenticated users by design for the current frontend payment path.
- The function itself enforces authenticated/non-anonymous access, tenant access, order ownership/finance authorization, payable state, pricing snapshot, amount/currency validation, and idempotency conflict checks.
- anon/authenticated/public do not have CREATE privilege on public schema.

## CI / release boundary

Recent production-related commits were not associated with GitHub Actions workflow runs at the time of verification. Therefore CI verification for those commits remains NOT VERIFIED.

## Remaining blockers

- Supabase Auth leaked-password protection still requires project-level Auth configuration and has not been verified closed.
- Real two-user/two-tenant authorization E2E remains unverified.
- Real signed Paymob/provider E2E remains unverified.
- Android release build/signing/AAB/APK/device validation remains unverified.
- Backup/restore and RPO/RTO evidence remains unverified.
- Production observability/alert drill remains unverified.
- Real push delivery remains unverified.
- pg_net public-schema advisor warning remains open.
- Historical migration/source convergence remains incomplete.
- Rollback rehearsal remains unverified.
- External browser/device smoke remains unverified.

## Release status

NOT PRODUCTION READY.

This RC closes a real payment-intent source/deployment divergence and improves source convergence, but it does not close the full release gate.
