# Digital-page payment finalization — live parity audit

Date: 2026-10-18  
Project ref: `moyhiluyhjsujhwlyeuu`  
Scope: read-only production inspection plus candidate-source comparison. No production mutation, migration, grant change, function deployment, payment, or user-data read was performed.

## Observed live database contract

Read-only catalog query returned exactly one overload:

`public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)`

| Property | Live value |
|---|---|
| SECURITY DEFINER | `true` |
| `search_path` | `public, pg_temp` |
| anon EXECUTE | `false` |
| authenticated EXECUTE | `true` |
| service_role EXECUTE | `false` |
| provider-order binding in body | absent |
| `TRUSTED_PAYMENT_FINALIZATION_REQUIRED` guard | absent |

The live migration ledger's latest entry remains `20261008222845 / rc424_atomic_digital_page_payment_webhook`. The five-argument provider-order-bound finalizer is absent.

## Observed live Edge Function

Read-only Supabase Edge Function retrieval returned:

- Function: `digital-page-payment-intent`
- Status: `ACTIVE`
- Deployed version: `5`
- `verify_jwt`: `true`
- Supabase deployed bundle fingerprint (`ezbr_sha256`): `8aa3d2e9c025e7b74d4d1847e8a6744bc84a9ded7cfc0c721f9604efd177af4b`

The deployed source still invokes:

`userClient.rpc("finalize_digital_page_payment_intent_backend", ...)`

using the four-argument signature. It does not persist Paymob's provider-order ID. This is a source/production contract mismatch against the candidate implementation.

## Candidate remediation

The candidate branch `integration/rc526-digital-finalization-20261018` implements:

- finalization via the trusted `admin`/service-role client;
- a provider-order-bound five-argument finalizer guarded by `request.jwt.claim.role = 'service_role'`;
- an inert legacy four-argument overload with EXECUTE revoked from PUBLIC, anon, authenticated, and service_role;
- row locking, order/user/claim-token binding, non-empty provider identifiers, pending-state guard, same-pair idempotency, and conflicting replay rejection;
- a disposable PostgreSQL test and a post-replay grant/body assertion;
- a release verifier that separately reports source contract PASS and live parity BLOCKED until timestamped production evidence exists.

## Evidence status

- Isolated finalization workflow passed at candidate head `7bdd0ec5cd25d6ee156e69bac2107283a034a674` (run 39142880851).
- Full ordered replay passed at code-equivalent migration/test head `e7c6d08854fe2c25d2f061846fa69e292efb1663` (run 39142726549): 32 migrations, finalizer ACL/body/search-path assertions, and bidirectional synthetic tenant isolation.
- The newer release-verifier/manifest hardening is under CI; the latest live-parity gate intentionally remains BLOCKED.
- These are candidate/disposable-environment results only. They do not authorize production rollout.

## Required controlled rollout

1. Complete independent review of the RC425–RC526 migration chain, baseline provenance, and this finalizer change.
2. Obtain explicit owner approval before any production change.
3. Apply the reviewed ordered migration and deploy the compatible Edge Function as one coordinated release; do not apply an out-of-order grant hotfix.
4. Read back live overload signatures/grants/function definitions and the deployed Edge Function version/source fingerprint.
5. Run Paymob sandbox E2E for success, rejection, timeout/ambiguous outcome, duplicate callback, amount/currency mismatch, and replay.
6. Only then populate the live parity fields in `docs/release/production-migration-reconciliation.json` with evidence and timestamp. Do not mark fields PASS before the checks actually pass.

**Current disposition: P0 / BLOCKED.**
