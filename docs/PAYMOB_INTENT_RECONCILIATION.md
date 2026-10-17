# MantiGO Paymob Payment-Intent Reconciliation

Status: operational procedure for the RC526 candidate; **not an automated recovery tool**.

## Why a claim can remain

The payment-intent endpoint first claims a ledger row, then calls Paymob, and only then finalizes provider identifiers and the client secret. A timeout, connection reset, malformed response, or failed database finalization cannot prove that Paymob did not create an intention. In those cases, RC526 intentionally retains the claim and rejects a blind retry.

Only explicit Paymob HTTP rejections `400`, `401`, `403`, `404`, and `422`, when the response contains no provider intent ID, provider order ID, or client secret, may release the exact claim token automatically. HTTP `408`, `409`, `425`, `429`, `5xx`, network failures, and incomplete success responses remain quarantined.

## Safe operator workflow for an ambiguous claim

1. Capture the ledger ID, request ID, approximate UTC timestamp, amount, and currency from the server-side operational record. Do not copy client secrets, API keys, or the raw claim token into tickets or chat.
2. Read the ledger state using an authorized, read-only database session. Confirm status, provider, provider intent ID, and claim creation time. Do not update the row directly.
3. Search Paymob's authorized merchant dashboard/support tooling by the ledger's `special_reference`, amount, currency, and time window. Confirm whether an intention exists. Do not infer absence from a single transient dashboard/search failure.
4. If an intention exists, **do not retry creation**. Preserve the claim and escalate for a reviewed, audited reconciliation action that links the existing provider intention to the ledger. The current RC526 candidate does not provide an operator-finalization RPC.
5. If Paymob authoritatively confirms no intention was created, preserve that evidence and escalate for an approved release procedure. The current release RPC only accepts the original exact claim token and one of the explicit definitive rejection statuses; do not fabricate an HTTP status or invoke it merely to clear a stale claim.
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

Do not run mutation SQL against production as a workaround. This guide does not authorize production access, manual updates, a provider call, or a release. Any reconciliation implementation needs an audited operator identity, evidence capture, authorization review, and disposable integration tests before production use.

## Release gate

RC526's disposable PostgreSQL concurrency/finalization/release tests and Deno type-check passed on the recorded PR head. This does not verify live Paymob behavior, operator tooling, or production deployment. Full production release remains **BLOCKED / NOT CERTIFIED** until migration chronology and the remaining production gates are resolved.
