# SMM v10 Source Parity Check — 2026-10-13

## Result

The deployed Supabase Edge Function `smm-gateway` was retrieved read-only as ACTIVE version 10 with `verify_jwt=true` and reported bundle SHA-256:

`80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`

All seven deployed source files were compared byte-for-byte against the existing GitHub branch `test/s06-payment-integrity-20261013`. Every file matched exactly:

- `index.ts`
- `launch-gate.ts`
- `provider-transport.ts`
- `order-status.ts`
- `catalog-normalization.ts`
- `order-validation.ts`
- `request-validation.ts`

This resolves the earlier claim that no matching source was found anywhere in the repository branches: the matching source is present on the S06 PR branch, not on `main` and not yet on this S03 branch. It does not establish that the source has been merged or deployed from that branch, and it does not certify the SMM behavior at runtime.

## Follow-up

Before any SMM rollout, reconcile the exact files into the approved release path, preserve the hard-coded deferred-launch gate, run the existing isolated S07 tests, and verify database privileges plus role/tenant isolation. Do not deploy or merge as part of this parity observation.

## Verification boundary

Comparison was read-only. No deployed function was invoked, no provider request was made, and no production database or configuration was changed.
