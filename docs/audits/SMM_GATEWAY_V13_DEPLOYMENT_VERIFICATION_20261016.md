# SMM Gateway v13 — Deployment Verification

**Date:** 2026-10-16 (UTC)  
**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Supabase project ref:** `moyhiluyhjsujhwlyeuu`  
**Scope:** Source-parity deployment only; not SMM launch approval.

## Deployment evidence

The `smm-gateway` Edge Function was deployed from the tracked `main` source as version **13**. Supabase returned an active function with `verify_jwt=true` and deployment bundle SHA-256:

```
a45cee9f5c90beba2c2409ba4fe2927f5be3df4965fb3929f5b7d467b3121b72
```

The deployed source was then read back from Supabase and checked against the repository source. The live `index.ts` was byte-for-byte equal to `main` at verification time.

## Pre-deployment source guards

All checks passed before deployment:

- All seven expected source files were retrieved successfully: `index.ts` plus six helper modules.
- The entrypoint imports all six helper modules.
- `SMM_INITIAL_LAUNCH_DEFERRED=true` remains in source.
- The launch gate runs before user authentication and request handling.
- Deferred launch returns `SMM_DEFERRED` with HTTP 503.
- Wallet response distinguishes `NOT_INITIALIZED` from a real zero balance using `wallet_initialized`, `wallet_status`, and nullable `balance`.
- `verify_jwt=true` was explicitly set in the deployment request.

## Scope and exclusions

This deployment did **not** apply a migration or change database rows, grants, RLS policies, Auth settings, wallet balances, payment state, provider credentials, or provider settings. It did not enable the standalone SMM storefront; the explicit launch-deferred gate remains active.

The result proves source parity and deployment metadata only. It does not prove end-to-end provider operations or authorize enabling SMM.

## Separate production release blocker

The read-only production migration ledger currently reports **283 applied migrations**, latest version `20261008222845`. RC449A and RC450 are not applied. The production release verifier fails closed because required migration sources are missing from `main`, including RC425–RC441 recovery candidates. This must be resolved through reviewed migration-source recovery and disposable replay; do not bypass the gate or apply financial-journal migrations ad hoc.

## Follow-up

1. Keep SMM launch deferred until separately approved and tested.
2. Continue source-semantic review for the other drifted Edge Functions.
3. Recover and verify missing migration sources against production evidence in an isolated review branch.
4. Require disposable replay, tenant-isolation tests, financial E2E tests, and backup/restore rehearsal before release certification.
