# MantiqaTix — Deployed Edge Function Semantic Diff (Read-Only)

**Observed:** 2026-10-30, approximately 05:00–05:05 UTC  
**Repository baseline:** `main` at `fe01dce043c8c8b5821ad679b561963a23a5357a`  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Scope:** retrieve deployed Edge Function source and compare security-/payment-critical behavior with current `main` source.  
**Production writes/deployments:** none.

## Executive result

The deployed versions are not merely formatted differently from the current repository source. The read-only semantic comparison identified material missing controls in four deployed functions and an older financial-journal RPC contract. This is a **deployment drift / release blocker**, not proof that a payment has been exploited. Do not deploy repository functions blindly: first rehearse them against an isolated database and Paymob sandbox with the exact deployed schema/RPC contracts.

| Function | Deployed version | Main source length | Live source length | Finding |
|---|---:|---:|---:|---|
| `payment-intent` | 8 | 10,366 | 8,114 | Missing amount precision and provider-intention correlation checks; weaker provider outcome handling |
| `digital-page-payment-intent` | 5 | 6,532 | 5,345 | Missing amount precision and provider-intention correlation checks; weaker claim-release/reconciliation behavior |
| `subscription-payment-intent` | 4 | 11,100 | 5,196 | Missing claimable creation/concurrency flow, amount/correlation validation, and encrypted checkout-secret persistence/recovery |
| `financial-journal` | 3 | 3,387 | 1,591 | Uses older `post_financial_journal` RPC instead of actor-bound `post_financial_journal_backend`; wildcard CORS instead of allow-listed origin |
| `paymob-webhook` | 10 | 12,665 | 11,538 | Main source has stronger backend RPC contracts and explicit event/order/amount correlation in payment paths; live still requires full RPC-by-RPC review |
| `order-create` | 8 | 13,988 | 10,083 | Exact parity absent; this pass did not complete a full semantic trace. Keep open, do not infer safety from matching high-level markers |

## Confirmed source-level differences

### 1. `payment-intent` — HIGH

The deployed v8 source:
- Creates a payment intent using `create_payment_intent_backend`.
- Builds the Paymob intention and checks for provider response `id` and `client_secret`.
- Does not require a provider order ID before persisting/returning the intent.
- Does not call `isValidPaymobAmountCents` or `matchesPaymobIntention`.
- On a non-OK/malformed provider response, marks the payment intent `FAILED` directly.

The current `main` source:
- Validates the authoritative amount against the order pricing snapshot and validates cents precision.
- Requires provider intent ID, client secret, and provider order ID.
- Calls `matchesPaymobIntention` to verify amount, currency, reference, and required provider identifiers.
- Treats ambiguous provider outcomes as `PENDING` for reconciliation rather than automatically converting all malformed/non-OK responses to `FAILED`.

**Risk:** the deployed path has weaker correlation and ambiguous-outcome controls. A wrong or incomplete provider response may be persisted/returned without the current repository's fail-closed correlation checks. No live transaction was generated to test exploitability.

### 2. `digital-page-payment-intent` — HIGH

The deployed v5 source:
- Uses claim/release/finalize RPCs, but does not validate amount precision or correlate the returned Paymob intention against amount, currency, reference, and provider IDs.
- Accepts a provider response with an ID and client secret without requiring and persisting the provider order ID in the same guarded way as current `main`.
- Releases the claim on broad provider failure paths, including outcomes that may be ambiguous; the release result is not consistently used to fail closed.

The current `main` source:
- Validates amount precision.
- Requires provider ID, client secret, and provider order ID.
- Uses `matchesPaymobIntention`.
- Releases a claim only for a deterministic provider rejection and requires successful release; uncertain provider outcomes remain unresolved for reconciliation.
- Persists provider identifiers through the guarded finalize RPC.

**Risk:** provider response mismatch and uncertain outcomes can be handled less safely in the deployed version. This needs deterministic sandbox tests before any rollout.

### 3. `subscription-payment-intent` — CRITICAL

The deployed v4 source:
- Calls older `create_subscription_payment_intent_backend` directly.
- Sends a prefixed `special_reference` (`MANTIQATIX-SUB-<id>`) and does not implement the current claimable provider-creation protocol.
- Persists provider intent/order IDs, but the retrieved source does not implement the current encrypted checkout-secret storage/recovery protocol.
- Does not call amount precision or provider intention correlation helpers.

The current `main` source:
- Uses `create_subscription_payment_intent_claimable_backend` and `claim_subscription_provider_intent_creation_backend` to control concurrent provider creation.
- Handles uncertain outcomes through `RECONCILIATION_REQUIRED`.
- Validates amount precision and provider amount/currency/reference/identifier correlation.
- Encrypts the Paymob client secret using AES-GCM with per-intent/business associated data and stores ciphertext, IV, and key version; recovery decrypts it only when needed.
- Uses explicit compare-and-set state transitions for persistence.

**Risk:** deployed behavior lacks the repository's concurrency, correlation, reconciliation, and at-rest checkout-secret protections. Treat as a payment-security release blocker. Before updating production, verify that all required RPCs, columns, key versions, and secrets exist in an isolated restore of the current production schema. Never print or retrieve secret values in logs.

### 4. `financial-journal` — CRITICAL

The deployed v3 source:
- Uses `Access-Control-Allow-Origin: *`.
- Authenticates a non-anonymous user token with `admin.auth.getUser`.
- Calls `post_financial_journal` with only `p_entry` and `p_lines`.

The current `main` source:
- Restricts CORS to the deployed MantiqaTix origin.
- Validates the request body and tenant identifier.
- Calls `post_financial_journal_backend` with explicit `p_user_id`, tenant-scoped entry data, and lines. Its source comment states that the database rechecks active financial membership for the supplied actor.

**Risk:** the deployed function uses a different database contract and does not pass the verified actor ID into the backend RPC as current `main` does. This is not enough by itself to conclude unauthorized posting is possible; inspect the exact live RPC definition, execute grants, and function body in an isolated clone before any deployment. Keep financial posting blocked until proven.

### 5. `paymob-webhook` — HIGH / REVIEW OPEN

Both live v10 and `main` contain HMAC-SHA512 verification. The current `main` source additionally shows explicit checks for:
- provider transaction event ID and positive finite amount/currency;
- provider order ID matching the stored intent/order;
- amount and currency matching the stored payment intent;
- duplicate provider event detection;
- backend processing RPC contracts for subscription, digital-page, MantiGO, and ordinary order payments, including provider-confirmed values and signature-verification context.

The deployed source uses older RPC names/contracts in the retrieved paths (for example `process_verified_subscription_payment` and `process_verified_provider_payment`) and must be reviewed against the live SQL function definitions and ACLs. The current comparison did not fully trace every branch and every RPC argument. Do not mark this function cleared yet.

### 6. `order-create` — REVIEW OPEN

Both deployed and repository sources show authenticated-user validation, anonymous-user rejection, idempotency handling, service-role access, and a backend RPC. Exact source lengths differ materially, but this pass did not complete a line-by-line semantic trace of every validation and RPC argument. Keep the function in the parity queue; no safety conclusion is made.

## Required safe remediation sequence

1. Create a restorable isolated database from the current production schema/data snapshot with secrets and personal data sanitized. Do not use production for adversarial or migration rehearsal.
2. Compare live RPC definitions, signatures, owners, grants, SECURITY DEFINER settings, and search paths for every RPC named above against current `main` migrations.
3. Run unit tests for `paymob-intent-correlation.mjs` and `checkout-secret-crypto.mjs`, including wrong amount, wrong currency, wrong reference, missing IDs, tampered ciphertext, wrong key version, and concurrent claims.
4. Run isolated integration tests for deterministic provider rejection, network timeout after provider acceptance, duplicate callbacks, wrong provider order ID, wrong amount/currency, replayed HMAC event, concurrent subscription checkout, and financial actor-role denial.
5. Run the complete payment/order/finance regression suite and verify idempotency/ledger invariants.
6. Produce a reviewed deployment plan with exact function versions, required DB objects, secret names/rotation plan, rollback path, and owner approval.
7. Deploy only the individually approved functions, one at a time, then fetch deployed source/version again and run post-deploy smoke tests.

## Explicit non-actions

- No Edge Function was deployed or modified.
- No production SQL, migration, grant, RLS/Auth setting, secret, payment, wallet, settlement, or financial journal was changed.
- No Paymob transaction or webhook was generated.
- This report is an evidence-backed source review, not a penetration-test certification.

## Release decision

**BLOCKED / NOT CERTIFIED.** Highest priority: subscription payment intent, financial journal actor-bound RPC parity, payment-intent correlation, and digital-page payment claim/reconciliation parity. Continue with isolated schema/RPC contract verification before proposing any production function deployment.
