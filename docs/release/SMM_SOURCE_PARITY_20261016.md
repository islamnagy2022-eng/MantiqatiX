# SMM Gateway Source Parity — 2026-10-16

## Scope

This branch restores the exact source files returned by the connected Supabase project for the currently deployed `smm-gateway` Edge Function. It does not deploy code or change the live project.

- Supabase project ref: `moyhiluyhjsujhwlyeuu`
- Deployed function version observed read-only: **12**
- Deployed bundle SHA-256 observed: `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`
- Source retrieved: 2026-10-16
- Branch: `fix/smm-gateway-source-parity-v12-20261016`
- Production database migrations observed: 283, latest applied version `20261008222845` (RC424)

## Source files restored

The function source contains these files: `index.ts`, `launch-gate.ts`, `provider-transport.ts`, `order-status.ts`, `catalog-normalization.ts`, `order-validation.ts`, and `request-validation.ts`.

The current `main` source did not contain the six imported helper modules. The gateway's index file is now restored from the live source response, and the imported modules are added unchanged so Deno can resolve the imports.

## Important launch and safety boundary

The deployed source has `SMM_INITIAL_LAUNCH_DEFERRED=true` and a launch gate that rejects all actions with `SMM_DEFERRED`. The source parity change preserves this default-deny behavior. It does not enable SMM orders, contact external providers, alter wallet balances, or perform provider synchronization.

The source contains defensive request-size validation, provider endpoint validation, provider transport timeout, normalized catalog and order validation, request idempotency, and explicit reconciliation responses for ambiguous provider outcomes. These are source-level observations, not proof of runtime correctness.

## Verification required

- GitHub Actions: SMM service-role boundary contract and PostgreSQL ACL fixture.
- Deno type-check across the restored helper imports.
- Review the full diff against the source returned by the connected project.
- Confirm the production schema dependencies exist in the migration baseline before any later rollout.
- Keep source parity separate from any later decision to enable SMM. Any activation requires a distinct reviewed change, test evidence, and explicit approval.

## Not performed

- No Supabase migration applied.
- No Edge Function deployment.
- No wallet, order, provider, payment, Auth, RLS, or grant mutation.
- No merge or production release.
