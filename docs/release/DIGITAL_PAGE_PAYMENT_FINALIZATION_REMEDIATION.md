# Digital-page payment finalization — remediation plan

Status: **P0 / BLOCKED — design and evidence required before production change**

## Evidence from current source

- `supabase/functions/digital-page-payment-intent/index.ts` authenticates the caller, obtains a claim token, asks the user-scoped client to claim the order, creates a Paymob intention, then calls `finalize_digital_page_payment_intent_backend` through the same user-scoped client.
- `supabase/migrations/20261007003432_digital_page_payment_intent_claim_boundary_v1.sql` defines the finalizer as SECURITY DEFINER, checks `auth.uid() = p_user_id`, updates the order when the claim token matches, and grants EXECUTE to `authenticated`.
- This permits an authenticated caller to attempt the finalizer directly, outside the intended Edge Function provider-response path. At minimum this can poison the provider-intent binding / interrupt checkout. Source review alone does not establish a paid-state forgery or prove production exploitability.
- Production notes indicate live schema/function parity is incomplete. Never assume the current main-branch migration describes the live database.

## Required remediation design (not yet applied)

1. Introduce a new server-only finalization RPC with an explicit trusted-role guard and least-privilege EXECUTE grant for `service_role`; it must not depend on `auth.uid()` being the customer identity.
2. Preserve the authenticated claim RPC's owner check and the opaque claim token. The Edge Function must verify the caller with `admin.auth.getUser(token)`, create the Paymob intention, then call finalization through the service-role client.
3. Validate non-empty provider intent ID, order/user binding, active claim token, expected pending state, and absence of an existing provider intent under a row lock. Make duplicate finalization idempotent only when the same order and same provider intent are bound; reject conflicting replay.
4. Revoke authenticated EXECUTE on the legacy finalizer only after repository-wide caller search, disposable-database tests, and a reviewed migration that preserves any legitimate caller contract. Do not mutate already-applied historical migrations.
5. Keep provider HMAC verification and the atomic webhook processor as the only path that transitions an order to PAID. Finalization must never accept a client-provided amount or set PAID.
6. Update the production verifier to inspect the new RPC and grants, and keep release blocked if the legacy authenticated grant remains active or deployed source parity is unknown.

## Required regression evidence

- Authenticated user A cannot finalize order B.
- Authenticated user cannot call the privileged finalizer directly.
- Missing, stale, mismatched, or reused claim token is rejected.
- Empty provider intent ID is rejected.
- Duplicate same-intent finalization is deterministic; conflicting intent ID is rejected.
- A successful intention response with a failed DB finalization does not return a checkout success response.
- Invalid HMAC, wrong provider order, wrong amount/currency, duplicate webhook, and replay do not mark an order paid.
- Parallel claims/finalizations do not bind multiple provider intents to one order.
- Confirm exact migration ledger, deployed Edge Function versions, grants, and function definitions in an isolated clone before production rollout.

## Rollout and rollback

- No production grant, migration, secret, or payment state is changed by this document.
- Apply only through a reviewed, ordered migration after disposable-database tests and explicit approval.
- Deploy Edge Function and migration in a compatible sequence, verify exact deployed versions and grant/function definitions, then run a provider sandbox E2E.
- If verification fails, stop release; do not widen grants or manually mark orders paid. Use the established recovery process and retain event/audit evidence.
