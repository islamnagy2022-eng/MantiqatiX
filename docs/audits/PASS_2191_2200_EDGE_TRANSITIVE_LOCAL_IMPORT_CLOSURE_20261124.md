# PASS 2191–2200 — Edge transitive local-import closure recheck

**Date:** 2026-11-24, approximately 20:20 UTC  
**Repository main:** `e5cb0c7644d63d3a1f12bd73a1f3258457ef4b53`  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Method:** read-only retrieval of nine current-main entrypoints, their local imports, each referenced local module, one further transitive level, live deployed file lists/version/JWT metadata and Deno config/lock files. No function invocation or deployment occurred; no DB, payment, settlement, contact or customer data was read.

## 1. Local import closure

The nine launch-critical main entrypoints were traversed through all local relative imports.

| Function | Main entrypoint local imports | Transitive local imports | Local closure result |
|---|---|---|---|
| `catalog-admin` | None | None | Entry only |
| `order-create` | None | None | Entry only |
| `paymob-webhook` | None | None | Entry only |
| `payment-intent` | `../_shared/paymob-intent-correlation.mjs` | None | One helper |
| `subscription-payment-intent` | `../_shared/paymob-intent-correlation.mjs`, `../_shared/checkout-secret-crypto.mjs` | None | Two helpers |
| `financial-journal` | None | None | Entry only |
| `settlement-financial-atomic` | `./authorization.mjs` | None | One helper |
| `business-register` | None | None | Entry only |
| `directory-listings` | Eight local helpers | `doctor-publication-contract.mjs` imports `doctor-import-contract.mjs`; no further local imports | Eight helpers, one additional transitive edge |

All fetched helper modules were inspected for relative imports:
- `paymob-intent-correlation.mjs`: no local imports.
- `checkout-secret-crypto.mjs`: no local imports.
- `settlement-financial-atomic/authorization.mjs`: no local imports.
- Directory pagination, source/import normalization, output projection, consent pagination, contact-consent pagination, platform-admin registry and release-gate helpers: no additional local imports.
- Only additional edge: `doctor-publication-contract.mjs → doctor-import-contract.mjs`.

The direct import graph is acyclic for the inspected modules. This proves local relative-import closure, not external module resolution or runtime behavior.

## 2. Live deployed file manifests

| Function | Live version | Deployed files | Current-main local dependency delta |
|---|---:|---|---|
| `catalog-admin` | v20 | `index.ts` | No local helpers, but entrypoint/body differs and uses legacy admin authorization. |
| `order-create` | v8 | `index.ts` | No local helpers; source body differs from current main. |
| `paymob-webhook` | v10 | `index.ts` | No local helpers; current main routes to atomic provider/subscription RPC contracts absent live. |
| `payment-intent` | v8 | `index.ts` | Missing `_shared/paymob-intent-correlation.mjs`. |
| `subscription-payment-intent` | v4 | `index.ts` | Missing `_shared/paymob-intent-correlation.mjs` and `_shared/checkout-secret-crypto.mjs`; live source uses esm.sh Supabase JS v2 while main uses jsr Supabase JS v2. |
| `financial-journal` | v3 | `index.ts` | No local helpers; entrypoint/body differs from current journal service-role contract. |
| `settlement-financial-atomic` | v4 | `index.ts`, `deno.json` | Missing `authorization.mjs` and explicit CORS import used by main. |
| `business-register` | v9 | `index.ts` | No local helpers; source body differs and the current platform-root dependency is absent live. |
| `directory-listings` | v18 | `index.ts` | Deployed file is the deliberate 2 KB fail-closed stub; main's eight helper files are not deployed. |

The deployed file list confirms the relevant local helper modules are not present in the bundles for payment-intent, subscription-payment-intent, settlement-financial-atomic and directory-listings.

## 3. Deno and external dependency lock state

- `supabase/config.toml` exists and contains explicit `verify_jwt=false` overrides for `directory-listings`, `paymob-webhook`, `catalog-admin` and several other functions. The inspected live JWT modes match the relevant explicit overrides.
- Only `supabase/functions/settlement-financial-atomic/deno.json` was found among the tested Deno config paths; it contains `{"compilerOptions":{"strict":true}}`.
- No `deno.lock` was found at repository root, `supabase/`, `supabase/functions/`, or the inspected function-local directories.
- The local modules have no nested third-party imports, but external JSR/esm.sh package resolution, version equivalence and compiled bundle integrity are not certified by the source import graph.
- Supabase provider `ezbr_sha256` identifiers are not Git blob SHAs. No false byte-for-byte bundle equivalence is claimed.

## 4. Remaining P1.2 work

1. Add deterministic Deno dependency lock/import-map coverage for the launch-critical functions, with reviewed external package versions.
2. Produce a release bundle manifest containing exact main commit, all local module SHAs, resolved external dependency versions, Edge version, `verify_jwt`, required secret names and SQL/RPC prerequisites.
3. Compare the final built bundle against a newly deployed test version only after DB dependencies and isolated behavior tests pass; do not deploy into Production for comparison.
4. Keep payment, subscription, financial journal, settlement and directory endpoints disabled/fail-closed while their database and runtime contracts differ.
5. Do not publish any single Edge function ahead of its coordinated migration, ACL, RLS, Auth and E2E dependency slice.

**Disposition:** local transitive-import graph for the nine functions is now inventoried. External lockfile/package resolution, compiled-bundle parity, SQL contract closure and deployed-origin E2E remain **NOT VERIFIED**. No Production Edge, database, payment, settlement, directory or customer-data change was made.
