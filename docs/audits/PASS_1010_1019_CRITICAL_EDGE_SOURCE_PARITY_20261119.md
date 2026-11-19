# Critical Supabase Edge Function Source Parity — Pass 1010–1019 (2026-11-19)

**Canonical Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Git main checkpoint:** `6793c4720b2fe94846ac5c953e3950927c8e71e1`  
**Evidence mode:** live Edge Function metadata/source retrieval compared byte-for-byte with `main` entrypoint files  
**Deployments or Production mutations:** NONE

## 1. Exact entrypoint comparison

Eleven critical entrypoints were fetched from the live project and compared with the corresponding `supabase/functions/<slug>/index.ts` file on main.

| Function | Live version | Status | verify_jwt | Exact entrypoint match |
|---|---:|---|---:|---|
| `api` | 17 | ACTIVE | false | PASS |
| `order-create` | 8 | ACTIVE | true | **MISMATCH** |
| `order-status-update` | 4 | ACTIVE | true | PASS |
| `payment-intent` | 8 | ACTIVE | true | **MISMATCH** |
| `payment-webhook` | 3 | ACTIVE | false | PASS |
| `paymob-webhook` | 10 | ACTIVE | false | **MISMATCH** |
| `digital-page-payment-intent` | 5 | ACTIVE | true | **MISMATCH** |
| `subscription-payment-intent` | 4 | ACTIVE | true | **MISMATCH** |
| `financial-journal` | 3 | ACTIVE | true | **MISMATCH** |
| `smm-gateway` | 13 | ACTIVE | true | PASS |
| `directory-listings` | 16 | ACTIVE | false | **MISMATCH** |

**Result: 4/11 exact matches; 7/11 mismatches.** Comparison was performed on the retrieved `index.ts` content, not only version numbers or timestamps.

## 2. Risk classification

The mismatches are in payment/order/finance and public-directory paths:
- `order-create`
- `payment-intent`
- `paymob-webhook`
- `digital-page-payment-intent`
- `subscription-payment-intent`
- `financial-journal`
- `directory-listings`

This is a source-parity finding, not by itself proof of a live exploit. However, deploying a source replacement individually is unsafe because the 62-version schema release contract remains 0/62 applied, multiple required RPC/table dependencies are absent, and payment/finance end-to-end and backup/restore gates remain incomplete.

## 3. What matched

The live entrypoints for `api`, `order-status-update`, `payment-webhook`, and `smm-gateway` match main exactly. Their live metadata is recorded above. A matching entrypoint does not independently prove runtime authorization, RLS correctness, or negative-path behavior.

## 4. Release decision

- Do not deploy any of the seven mismatched functions individually.
- Reconcile each function's full source bundle, imports, configuration, secrets and verify_jwt contract against the same ordered database release.
- Require disposable integration tests, live negative authorization tests, Paymob sandbox payment/callback correlation, idempotent fulfillment and rollback evidence before any Edge deployment.
- Preserve the catalog-only Pages deployment; it is separate from this Edge parity gate.

**Disposition:** critical Edge Function parity remains **PARTIAL / BLOCKED**. No Edge Function was deployed or changed; no Production SQL/DDL/DML/Auth/RLS/GRANT/payment/wallet/settlement change occurred.


## 5.1 Confirmed public directory contact-disclosure gap (high priority)

The live `directory-listings` v16 is deployed with `verify_jwt=false`. Its public GET path requires no bearer token, selects `phone`, `secondary_phone` and `address` through `publicReadFields`, and returns the row with only metadata sanitization; the live entrypoint does not import or call the current main `sanitizePublicDirectoryListing` / `collectActiveAddressConsentIds` contract. A read-only aggregate query found 869 PUBLISHED rows, all 869 with a phone and address, and 178 with a secondary phone. A direct catalog check found `public.directory_listing_contact_consents` and `private.directory_listing_contact_consents` both absent.

Main source includes RC473 (`20261118020000`) to create the consent table with RLS + FORCE RLS, revoke client-role access and grant service_role only; it also imports explicit row-level contact sanitization and consent pagination. RC473 is one of the 62 missing required release migrations. Therefore the live public directory currently does not enforce the intended per-field consent boundary for phone/address. This is a confirmed privacy-contract gap and a release blocker, not a statement about whether each listed phone/address is otherwise public business information. Do not deploy the whole directory function or apply RC473 alone; reconcile RC472/RC473 and all function/schema dependencies in the coordinated release. Consider a separately reviewed, minimal fail-closed public-contact hotfix only if the owner authorizes an emergency mitigation.


## Bundle-level recheck addendum

The live `directory-listings` v16 bundle contains only `index.ts`, `pagination-filter.mjs`, and `doctor-import-contract.mjs`. Main requires five files; the live bundle is missing `consent-pagination.mjs` and `public-directory-output-contract.mjs`. This is separate from the entrypoint mismatch and confirms that deploying the current frontend against the live function cannot provide the consent contract. The release gate now requires `complete_bundle_match=true`, `required_files_present=true`, and an empty `missing_live_files` list in addition to entrypoint parity.
