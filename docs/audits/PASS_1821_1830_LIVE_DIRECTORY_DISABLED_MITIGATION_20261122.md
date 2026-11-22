# Live directory disabled-mitigation recheck — 2026-11-22

**Project:** `moyhiluyhjsujhwlyeuu`  
**Production status:** **BLOCKED / NOT CERTIFIED**  
**Inspection type:** read-only Supabase metadata/source retrieval and aggregate-only SQL. No Production mutation.

## 1. Current deployed Edge behavior

The live `directory-listings` function is ACTIVE at version **18**, `verify_jwt=false`, with one deployed file (`index.ts`) and SHA-256:

`bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48`

The deployed source implements a deliberate fail-closed temporary disable:

- GET returns HTTP 200 with `listings: []`, `pageSize: 0`, `hasMore: false`, `nextCursor: null`, and `directoryDisabled: true`.
- POST returns HTTP 503 with `DIRECTORY_LISTINGS_DISABLED_FOR_V1`.
- The source explicitly says public rows and listing mutations remain disabled until RC472/RC473 and the owner contact-consent/source-rights gate are complete.

This is a meaningful safety improvement over the previously inspected v16 bundle that selected and returned contact columns. The current v18 endpoint does not return any directory records. It is **not** the final consent-aware implementation and does not restore the directory feature.

## 2. Fresh Production database evidence

Read-only migration ledger query:

| Check | Result |
|---|---:|
| Total migration rows | 310 |
| Latest applied version | `20261110150618` |
| RC472 applied | No |
| RC473 applied | No |
| `public.directory_listing_contact_consents` exists | No |
| `public.directory_source_permission_evidence` exists | Yes |

Aggregate-only directory query (no contact values or owner identities selected):

| Published listing metric | Count |
|---|---:|
| Published listings | 869 |
| Listings with primary phone | 869 |
| Listings with secondary phone | 178 |
| Listings with address | 869 |

These counts describe the stored directory population, not public exposure through the current disabled endpoint.

## 3. Release interpretation

1. **Temporary mitigation active:** the current live endpoint suppresses all public directory rows and rejects claim/edit mutations.
2. **Consent foundation absent:** RC472/RC473 remain unapplied; the public consent registry table is absent.
3. **Source implementation not deployed:** current main contains the consent-aware sanitizer, consent pagination, contact-consent pagination and registry-backed authorization modules. The live v18 one-file disable is intentionally not source parity.
4. **No re-enable:** do not deploy the full directory source or re-enable listing operations until the ordered database release, complete matching seven-file Edge bundle, platform-admin registry dependencies, backup/restore evidence and deployed-origin anonymous/owner tests are completed together.

## 4. Other production gates

- The exact required release set remains 76 migration versions; current live ledger evidence records 0/76 exact required identifiers.
- Registry-backed platform-admin and catalog RPC hardening (RC484/RC485) remain unapplied.
- Six other critical payment/order/subscription/finance Edge entrypoints were previously found different from main and remain unreconciled.
- Actual encrypted off-site database + Storage backup, off-site retrieval, Vault recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO remain **NOT VERIFIED**.
- Paymob sandbox and financial reconciliation E2E remain blocked by missing live schema/RPC/ACL contracts. Monthly subscriptions remain deferred.

## 5. Safety

No contact values were selected. No Production DDL/DML, migration, Auth, RLS, GRANT, Storage, Edge deployment, payment, wallet, settlement or customer-data mutation was performed. The directory remains disabled.

**Decision:** The immediate public-contact disclosure path is currently suppressed by the live fail-closed v18 endpoint. The directory privacy release gate remains open because consent is not implemented in Production and the feature is unavailable. Production remains **BLOCKED / NOT CERTIFIED**.
