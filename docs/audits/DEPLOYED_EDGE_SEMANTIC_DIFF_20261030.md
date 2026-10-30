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


## Follow-up: live SQL contract and migration-ledger verification (read-only)

A targeted read-only query against the live project checked the exact RPC names, identity arguments, owners, SECURITY DEFINER flags, search_path settings, execute ACLs, relevant table columns, and migration ledger versions.

### Subscription checkout — schema and RPC prerequisites are absent

Live database currently exposes `create_subscription_payment_intent_backend(uuid,text,text,text,text,uuid)`, but the following functions required by current `main` are absent from `pg_proc`:
- `create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)`
- `claim_subscription_provider_intent_creation_backend(uuid,uuid)`

Live `subscription_payment_intents` does not contain:
- `provider_creation_state`
- `provider_creation_claimed_at`
- `client_secret_ciphertext`
- `client_secret_iv`
- `client_secret_key_version`

The source migrations defining these are present in the repository but are absent from the live migration ledger:
- `20261009210000_rc435_subscription_provider_intent_claim`
- `20261010010000_rc439_encrypted_checkout_recovery`

The current live ledger query returned no rows for these versions. Therefore the current `main` subscription function cannot run successfully against the observed production schema as-is. This is a confirmed source/schema contract mismatch, not a hypothetical risk.

### Financial journal — deployed and current-main RPC calls do not match the granted RPC

Live ACL inspection returned:
- `post_financial_journal(jsonb,jsonb)`: only `postgres` has EXECUTE; `service_role` EXECUTE = false.
- `post_financial_journal_backend(uuid,jsonb,jsonb)`: only `postgres` has EXECUTE; `service_role` EXECUTE = false.
- The repository's `20261009220000_rc436_atomic_financial_journal` migration defines `post_financial_journal_atomic_backend(uuid,jsonb,jsonb)` and grants EXECUTE to `service_role`, but this migration version is absent from the live ledger.
- Current `main` Edge Function source calls `post_financial_journal_backend`, not the RC436 `post_financial_journal_atomic_backend` contract.

The deployed v3 function calls `post_financial_journal`, which also lacks service-role EXECUTE in the observed live ACL. A service-role RPC call to either of those two existing functions is therefore expected to be rejected by PostgreSQL privileges. No production call was made to test this.

The RC159 baseline migration revokes execution from `public`, `anon`, and `authenticated`; the RC436 migration is the later atomic actor-scoped implementation with the explicit service-role grant. The correct resolution is not to grant the old functions blindly. First verify the full RC436 migration against a restored isolated database, align the Edge Function to the atomic RPC signature, add integration tests, then propose a controlled migration and function rollout.

### Exact missing ledger versions

The live migration ledger did not contain:
- `20261009210000` — RC435 subscription provider intent claim.
- `20261009220000` — RC436 atomic financial journal.
- `20261010010000` — RC439 encrypted checkout recovery.

The live ledger did contain the earlier digital-page claim migrations `20261007003432` and `20261007003440`.

**Updated severity:** subscription checkout source/schema mismatch and financial journal RPC/ACL mismatch are confirmed **CRITICAL release blockers**. No production DDL, grant, migration, RPC mutation, or Edge deployment was performed.


## Superseding correction — canonical financial journal path (2026-10-30)

This section supersedes the earlier financial-journal interpretation in this report and in the initial PR #526 summary. A deeper review of the repository's RC449A/RC450 migrations, RC450 runbook, integration tests, and the live RPC body established the following:

1. **RC436 is not the canonical production rollout path.** RC436 introduced an earlier atomic RPC named `post_financial_journal_atomic_backend`. Later work established the production rollout path as RC449A followed by RC450. Do not apply RC436 as a substitute for RC449A/RC450 or switch the Edge Function to the RC436 RPC.
2. **Current `main` Edge source is correctly aligned by RPC name with RC450.** `supabase/functions/financial-journal/index.ts` calls `post_financial_journal_backend(p_user_id,p_entry,p_lines)`; RC450 defines that same RPC signature, revokes it from `PUBLIC`, `anon`, and `authenticated`, and grants EXECUTE to `service_role`. The earlier claim that current `main` calls a different RC436-only RPC was incorrect and is withdrawn.
3. **The live database still lacks the canonical rollout migrations.** A fresh read-only migration-ledger query returned no rows for `20261010175000` (RC449A) or `20261010180000` (RC450).
4. **The live RPC is the older incompatible implementation.** Live `post_financial_journal_backend(uuid,jsonb,jsonb)` has only the postgres ACL; `service_role` EXECUTE is false. Its body requires `p_user_id = auth.uid()`, which is incompatible with the Edge Function's verified-user + service-role RPC call, and it does not enforce RC450's business/branch/organization membership scope. Therefore the deployed/current Edge endpoint cannot successfully use the current production RPC contract as intended.
5. **The correct remediation is the prepared RC449A → RC450 rollout.** The repository already contains `docs/runbooks/RC450_FINANCIAL_JOURNAL_ROLLOUT.md`, `supabase/tests/rc450_financial_journal_integration.sql`, and `scripts/validate-financial-journal-service-role.mjs`. The runbook explicitly requires RC449A first, RC450 second, schema/ACL verification, then matching Edge deployment. The RC450 integration suite covers tenant/business/branch/organization scope, service-role actor validation, duplicate IDs, balanced lines, and cumulative ledger balances.
6. **No production migration or grant was run.** The next safe step remains a restorable isolated database rehearsal, followed by an approved migration window. The runbook is prepared but does not authorize production execution.

### Corrected severity and release status

The financial-journal issue remains a **CRITICAL production blocker**, but its root cause is now accurately stated as missing RC449A/RC450 migrations and an old live RPC body/ACL, not a mismatch between current `main` RPC name and RC450. The earlier suggested RC436 RPC switch is withdrawn. Subscription RC435/RC439 remain separate missing migration/schema blockers.
