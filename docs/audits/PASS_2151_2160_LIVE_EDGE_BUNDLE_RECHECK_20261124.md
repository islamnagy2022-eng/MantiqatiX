# PASS 2151–2160 — Launch-critical Edge bundle recheck

**Date:** 2026-11-24, approximately 19:40 UTC  
**Repository main:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** retrieved current Supabase Edge deployment metadata and deployed `index.ts`/bundle file lists for nine launch-critical functions; fetched the matching current-main entrypoints and compared import lists and source lengths. No Edge function was invoked or deployed; no database, payment or customer data was read or changed.

## 1. Nine launch-critical entrypoints

| Function | Live version / JWT | Live SHA-256 identifier | Main Git blob | Live / main source bytes | Direct import delta |
|---|---|---|---|---:|---|
| `catalog-admin` | v20 / false | `7732207160cf91176d4478d101f85be8789b9eb1ce1b9cd56499994b0cf9ea2c` | `88d2f2ef4e1c3a7ca160125e595110b4e6c7b80b` | 37,862 / 44,115 | Same external imports; body differs |
| `order-create` | v8 / true | `16f9b8bb687c33afeca14d85cb4c43af9948bd8b3ef3178990cc76ca1abea782` | `3a6777683e537dcff1ad30cbd1c89e431f77d926` | 10,083 / 13,988 | Same direct imports; body differs |
| `paymob-webhook` | v10 / false | `f26fe1580e66c7f8cb9b885d5bccf4a44e49aa74874b3fe28dd7f9c5ed181cca` | `2eee7c80756e3c9a6b4310b65c90b7d8d2464c67` | 11,538 / 12,376 | Same direct imports; body differs |
| `payment-intent` | v8 / true | `d6b8faee1582c73ead440614cbe983114d1e7f31aa50f69795522fb20e737f54` | `5fd63573a8229bb65ef999293ed17520a0eaf8b9` | 8,114 / 10,146 | Main adds `../_shared/paymob-intent-correlation.mjs` |
| `subscription-payment-intent` | v4 / true | `4466345787ea6b10a29b1dd63e9f0ab3cae640e9bb4d8ecb6d09445809e077e5` | `c702d7a70ea85727ec5e14695ebf8fb26158514e` | 5,196 / 11,100 | Main adds `paymob-intent-correlation.mjs` and `checkout-secret-crypto.mjs` |
| `financial-journal` | v3 / true | `79ee18d0544e7cab8fe33fe84c27a5017d1163f411eb5b9e07b99fd79e16e366` | `49706589cc6d77af713ae44bcc0818066de72243` | 1,591 / 3,387 | Import/runtime source differs; body differs |
| `settlement-financial-atomic` | v4 / true | `f9afab1108159f8aba3631e6aeab7395bd0225e6cf7ffc840e5af7c5a008b11d` | `f1d3b439c59dff88668b54667bf371ec7411087` | 2,314 / 7,442 | Main adds CORS module and `./authorization.mjs` |
| `business-register` | v9 / true | `21a87964716c54043f3d8f2c00b0a75dd4b6d7aec084041b06eb53bca982b54e` | `932d32f17d36573f991dc138d1d21231e150d806` | 5,288 / 5,709 | Runtime import differs; body differs |
| `directory-listings` | v18 / false | `bb65d74325f8bdf08f060f7ae2517bb30901630635d1de4f35523d7cef6afe48` | `78bd91897cc9071e1b23cd2a56714e582c0661d5` | 2,054 / 54,284 | Main adds eight local modules and Supabase client |

The deployed SHA-256 values are provider bundle identifiers and must not be compared directly with Git blob SHAs. Source byte lengths and import lists are indicators, not substitutes for a byte-for-byte bundle hash or behavioral test.

Previously checked public functions `public-catalog` v9 and `public-catalog-directory` v19 retain the entrypoint-match disposition in PASS 2051–2060. Their imported/transitive dependencies still require separate closure proof.

## 2. Dependency consequences

- **Platform/catalog administration:** `catalog-admin` v20 is behind main's registry-root authorization contract. Production `mnty_can_platform_admin()` is still a SECURITY DEFINER wrapper over the legacy unscoped membership helper; `is_platform_admin()` remains membership-derived; registry FORCE RLS is off. The matching database and shared caller dependencies are absent live.
- **Orders:** `order-create` v8 is behind the current authenticated `create_order_backend`/JWT path. The live function signature exists, but its body and ACL contract remain source-different. Require exact RC103–RC106/RC497/RC498 schema, grants, idempotency and branch-scope tests before deploy.
- **Paymob:** deployed `paymob-webhook` v10 is behind the current provider-event/atomic processing flow. Earlier live dependency closure found missing current RPCs/event table. Keep Paymob fail-closed.
- **Payment intent:** the live function lacks main's shared `paymob-intent-correlation.mjs` dependency. Require amount, currency, order, provider-reference and idempotency binding before use.
- **Subscription payment:** the deployed bundle lacks correlation and encrypted-checkout-secret modules. The five claim/encrypted-secret columns and two claim RPCs are absent live. Keep checkout deferred.
- **Financial journal:** deployed v3 differs from main's backend-journal contract; the current backend journal RPC's service-role ACL was previously found absent. Require RC449A → RC450 plus journal integration.
- **Settlement:** deployed v4 has no authorization module; the live settlement RPC exists but retains the legacy `pg_catalog, public` search path and authorization helper dependency. Require RC464/RC471/RC494 ordering and tests.
- **Business registration:** deployed v9 lacks main's platform-root helper path. Registration/approval must remain on the reviewed legacy path until its dependency bundle passes.
- **Directory listings:** deployed v18 is deliberately fail-closed. Main's 54 KB consent-aware implementation and eight local modules must not be deployed until RC472/RC473, owner consent, source-rights evidence and privacy-negative tests pass.

## 3. Full closure still missing

This recheck validates direct imports and identifies source/body deltas. It does not yet certify:
- complete transitive local import graphs and import-map lockfiles;
- exact SQL function definitions, owners, `proconfig`, ACLs and RLS expressions for every consumer;
- DB migration-to-Edge-version-to-E2E dependency manifest;
- deployed-origin negative and positive E2E for each released function.

No single Edge deployment is approved by this audit.

## 4. Safe sequence

1. Finish the exact 81-migration physical-effect/alias crosswalk and keep Production read-only.
2. For each Edge function, resolve direct + transitive imports against main and create a deployment bundle manifest with versions, hashes, JWT mode and required secrets-by-name.
3. Bind each function to its SQL/RPC/ACL prerequisites and focused PG17 adversarial tests.
4. Keep Paymob, subscription checkout, settlement and legacy directory publication fail-closed until their entire dependency slice passes.
5. Require encrypted database + separate Storage backups, Auth/Vault recovery, independent restore/rollback, measured RPO/RTO and release-owner approval.
6. After approval, deploy only coordinated DB + Edge slices and run deployed-origin smoke/E2E before re-enabling dependent user flows.

**Production impact:** read-only retrieval/comparison only. No Edge function invocation/deployment, SQL mutation, payment, settlement, directory publication or business-data write occurred. Full platform remains **BLOCKED / NOT CERTIFIED**.
