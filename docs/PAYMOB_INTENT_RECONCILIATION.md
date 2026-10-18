# MantiGO Paymob Payment-Intent Reconciliation

Status: operational procedure for the RC526 candidate; **not an automated recovery tool**.

## Why a claim can remain

The payment-intent endpoint first claims a ledger row, then calls Paymob, and only then finalizes provider identifiers and the client secret. A timeout, connection reset, malformed response, or failed database finalization cannot prove that Paymob did not create an intention. In those cases, RC526 intentionally retains the claim and rejects a blind retry.

Only explicit Paymob HTTP rejections `400`, `401`, `403`, `404`, and `422`, when the response contains no provider intent ID, provider order ID, or client secret, may release the exact claim token automatically. HTTP `408`, `409`, `425`, `429`, `5xx`, network failures, and incomplete success responses remain quarantined.

## Safe operator workflow for an ambiguous claim

1. Capture the ledger ID, request ID, approximate UTC timestamp, amount, and currency from the server-side operational record. Do not copy client secrets, API keys, or the raw claim token into tickets or chat.
2. Read the ledger state using an authorized, read-only database session. Confirm status, provider, provider intent ID, and claim creation time. Do not update the row directly.
3. Search Paymob's authorized merchant dashboard/support tooling by the ledger's `special_reference`, amount, currency, and time window. Confirm whether an intention exists. Do not infer absence from a single transient dashboard/search failure.
4. If an intention exists, **do not retry creation**. Use the authenticated RPC `reconcile_mantigo_payment_intent_backend` with resolution `PROVIDER_INTENT_CONFIRMED`, the exact ledger amount/currency, provider intent/order IDs, the client secret obtained through an approved secure provider workflow, and the evidence reference. The RPC is limited to an active platform `SUPER_ADMIN` with `PLATFORM` scope and `full_control`; it checks amount/currency, atomically links the existing intent, stores the secret in the private table, removes the claim, and writes an audit record. Never place the client secret in an incident ticket or audit evidence reference.
5. If Paymob authoritatively confirms no intention was created, use the same authenticated RPC with resolution `PROVIDER_INTENT_ABSENT`, a non-secret evidence reference, and all provider-detail parameters set to null. The RPC clears the claim only after platform-admin authorization and writes the decision to the audit log. Do not invoke the low-level service-role release RPC manually or fabricate an HTTP status to clear a stale claim.
6. After an approved reconciliation, verify the ledger and provider state again, then retry only if the evidence shows no live provider intention and the approved procedure has released the claim.
7. Record actor, UTC time, ledger ID, provider evidence/reference, decision, and verification result in the incident record. Never log or expose the client secret or provider API credentials.

## Read-only triage query

Run only in an authorized, read-only `psql` session. Supply the ledger ID as a variable, for example `psql -v ledger_id='MGO-FIN-...'`. The query deliberately excludes client-secret values and claim tokens.

```sql
select
  id,
  payment_status,
  provider,
  provider_intent_id,
  metadata -> 'paymob_intent_claim' ->> 'created_at' as claim_created_at,
  metadata -> 'paymob_intent_last_rejection' ->> 'http_status' as last_definitive_rejection_status,
  metadata -> 'paymob_intent_last_rejection' ->> 'rejected_at' as last_definitive_rejection_at,
  updated_at
from public.mantigo_financial_ledger
where id = :'ledger_id';
```

Do not run mutation SQL against production as a workaround. This guide does not authorize production access, manual updates, a provider call, or a release. The RPC's disposable integration tests cover non-admin rejection, confirmed-absence release, confirmed-intent recovery, amount mismatch rejection, audit logging, and claim/secret isolation. It remains a candidate until the migration chain is approved and the RPC is deployed through the controlled release pipeline.

## Release gate

RC526's disposable PostgreSQL concurrency/finalization/release tests and Deno type-check passed on the recorded PR head. This does not verify live Paymob behavior, operator tooling, or production deployment. Full production release remains **BLOCKED / NOT CERTIFIED** until migration chronology and the remaining production gates are resolved.


## RC526 isolated integration evidence — 2026-10-18

- Added dedicated workflow `.github/workflows/rc526-mantigo-payment-intent-claim.yml` to run the provider-response correlation unit tests, source-boundary validator, and the SQL fixture + RC526 migration + RPC integration test against a disposable PostgreSQL 16 service.
- Exact-head run [39089810858](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39089810858) passed on commit `0cbfc69921806d58ba9f7ef37294757475e3d86e`.
- Evidence includes 9/9 provider-correlation unit tests, static checks for claim-before-provider ordering and ambiguous-outcome quarantine, and SQL assertions for role grants, private claim/secret tables, single-winner claim behavior, wrong-token rejection, finalization, duplicate provider-intent conflict rollback, and concurrent claims through two PostgreSQL sessions.
- Scope is isolated database/source testing only. This does not prove the RC526 migration was applied in production or that live Paymob callbacks, payment settlement, tenant isolation, and end-to-end checkout are production-ready. Keep the PR Draft and release gate blocked pending the complete ordered migration replay and live acceptance evidence.
