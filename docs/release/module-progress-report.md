# MantiqaTiX — Module Progress & Production Readiness Evidence
**Checked:** 2026-10-13  
**Repository:** `islamnagy2022-eng/MantiqaTiX`  
**PR:** #218 — OPEN / DRAFT / UNMERGED  
**Source audit head:** `d8f58cdcff2e0f4520994e9cb918f5f1b19c24a6` (later commits in this batch only restore exact Deno config files or update evidence documentation)

## How to read the percentages

These percentages are evidence-based coverage measures, not claims that a module is 100% feature-complete or production-ready. The CI validator `scripts/validate-module-runtime-coverage.mjs` checks that each listed module has a canonical catalog entry, a routed operations workspace, and at least one expected live-table binding. The validator passed on this PR head. It does not prove every workflow, tenant boundary, payment, notification, or device scenario works end-to-end.

## Objective progress metrics

| Measure | Result | Meaning |
|---|---:|---|
| Domain module runtime wiring | **28/28 = 100%** | All 28 domain codes pass the catalog/workspace/table-binding contract |
| Canonical UI feature-flag mappings | **24/24 = 100%** | All 24 canonical module codes are mapped by the validator |
| Exact deployed Edge Function source parity | **32/37 = 86.5%** | All 37 active functions were compared; 32 are byte-for-byte matched after restoring missing Deno config files, and 5 have source differences requiring review (not automatic overwrite) |
| Required post-RC424 production migrations proven applied | **0/33 = 0%** | Live ledger still ends at `20261008222845` / RC424; no required post-RC424 migrations are proven applied |
| Migration source inventory (count-based) | **126/283 = 44.5%** | 126 source files have filename timestamps at or before the live RC424 ledger ceiling, versus 283 live ledger rows; this is an inventory signal, not exact version reconciliation. There are 160 source files total, including 34 after the ceiling |
| Full chronological migration replay | **NOT RUN** | No score assigned; a partial fixture run is not a full replay |
| Full production E2E certification | **NOT VERIFIED** | No production-ready percentage is asserted without tenant/payment/finance/backup/device evidence |
| Exact-head PR workflow set at prior source head | **11/12 succeeded; 1 queued** | On head `d9a6b18995b34ec4a467c16207270ff99427fc48`, the focused migration integration workflow remained queued; queued is not PASS. Subsequent source/config commits triggered a fresh CI set, which must be rechecked on the current head |
| SMM gateway regression tests | **PASS** | Deno check, new Deno tests, boundary validator, and isolated PostgreSQL ACL test passed in run 38329947697 |
| Final release certification | **BLOCKED / NOT CERTIFIED** | Binary release gate remains open; not the same as overall source-code progress |

## All domain modules

“Runtime wiring” is the validated CI contract only. “Production E2E” remains unverified for each row until evidence exists for the actual user/provider/owner/admin workflow and cross-tenant denial in the deployed environment.

| Code | Module | Runtime wiring | Production E2E |
|---|---|---:|---|
| RESTAURANTS | المطاعم | 100% — PASS | NOT VERIFIED |
| CAFES | الكافيهات | 100% — PASS | NOT VERIFIED |
| SUPERMARKET | السوبر ماركت | 100% — PASS | NOT VERIFIED |
| CLOTHING | الملابس والأزياء | 100% — PASS | NOT VERIFIED |
| MANTIGO | MantiGO والنقل | 100% — PASS | NOT VERIFIED |
| MARRIAGE | الزواج | 100% — PASS | NOT VERIFIED |
| JOBS | الوظائف | 100% — PASS | NOT VERIFIED |
| SCHOOLS | المدارس | 100% — PASS | NOT VERIFIED |
| MAINTENANCE | الصيانة | 100% — PASS | NOT VERIFIED |
| MARKETING | التسويق والإعلان | 100% — PASS | NOT VERIFIED |
| BUSINESS_ERP | ERP وإدارة الأعمال | 100% — PASS | NOT VERIFIED |
| ACCOUNTING | المحاسبة | 100% — PASS | NOT VERIFIED |
| LEGAL | الخدمات القانونية | 100% — PASS | NOT VERIFIED |
| PARTNERS | الشركاء | 100% — PASS | NOT VERIFIED |
| ADS | الإعلانات | 100% — PASS | NOT VERIFIED |
| TRAVEL | السفر والرحلات | 100% — PASS | NOT VERIFIED |
| USED_ITEMS | المستعمل | 100% — PASS | NOT VERIFIED |
| PHYSIOTHERAPY | العلاج الطبيعي | 100% — PASS | NOT VERIFIED |
| PHARMACIES | الصيدليات | 100% — PASS | NOT VERIFIED |
| CLINICS | العيادات | 100% — PASS | NOT VERIFIED |
| HOSPITALS | المستشفيات | 100% — PASS | NOT VERIFIED |
| LABS | المعامل والأشعة | 100% — PASS | NOT VERIFIED |
| ACCOUNTING_SERVICES | الخدمات المحاسبية | 100% — PASS | NOT VERIFIED |
| COMPANIES | خدمات الشركات | 100% — PASS | NOT VERIFIED |
| FACTORIES | المصانع والخدمات الصناعية | 100% — PASS | NOT VERIFIED |
| FLIGHTS_TRIPS | الرحلات والسفر | 100% — PASS | NOT VERIFIED |
| HOME_MAINTENANCE | خدمات المنزل والصيانة | 100% — PASS | NOT VERIFIED |
| SOFTWARE_ERP | البرمجيات وERP | 100% — PASS | NOT VERIFIED |

## Edge Function source divergence requiring review

| Function | Observed difference | Safe next action |
|---|---|---|
| `catalog-admin` | Formatting/text differs; the three actions and RPCs appear semantically equivalent in the inspected source | Keep parity classified as non-exact until normalized comparison or a reviewed commit establishes the intended canonical source |
| `financial-journal` | Live source uses wildcard CORS and an `esm.sh` import; branch source uses the site-origin allowlist, `Vary`, `no-store`, and a pinned `jsr:` import | Do not replace the hardened branch source with the less restrictive live copy; review and test deployment migration plan |
| `business-branch-admin` | Live and branch sources differ in authorization/validation implementation | Review role, tenant, business, and branch checks with negative tests before any deployment |
| `mnty-customer-registration` | Live calls `private.ensure_customer_membership_for_user`; branch calls `private.activate_customer_registration_atomic` | Reconcile the intended RPC contract and test against the live migration state before rollout |
| `digital-page-order-create` | Branch source adds pricing-hash/idempotency and business-membership checks absent from the live source | Keep branch hardening; test dependencies and rollout sequencing; do not overwrite it with the live version |

## Release blockers that dominate overall readiness

1. **Migration chain:** live ledger has 283 recorded migrations and ends at RC424. The repo contains 160 migration source files, of which 126 have filename timestamps at/before RC424 and 34 are later candidates. Full per-version source reconciliation and chronological replay remain blocked; the release gate tracks 33 required later migration sources, and 0/33 are proven applied.
2. **Security:** live Security Advisor reports 40 authenticated-executable SECURITY DEFINER functions requiring per-function review, one anon-executable targeted-advertisement SECURITY DEFINER warning, one RLS-enabled/no-policy table (`digital_page_payment_events`, intentionally fail-closed pending access-contract verification), and leaked-password protection warning(s). Do not blanket-revoke or add broad RLS policies.
3. **Performance:** current Advisor reports 105 unindexed foreign keys, 375 auth/RLS init-plan warnings, 124 unused-index notices, and 28 multiple-permissive-policy warnings. These need query/usage analysis, not blind schema changes.
4. **Critical runtime acceptance:** two-tenant isolation, live Paymob, finance/settlement, notification delivery, backup/restore rehearsal, signed Android/device release, rollback, and post-deployment smoke remain unverified or external.
5. **SMM:** source and regression CI passed, but SMM remains explicitly disabled/deferred and is not deployed from this branch.

## Next work sequence

1. Re-run and finish exact-head focused migration integration.
2. Build a disposable PostgreSQL chronological replay from the authoritative baseline; resolve only real historical dependencies, never stubs or rewritten history.
3. Continue exact source parity comparison for the remaining live Edge Functions and capture results.
4. Close security findings function-by-function and complete owner-controlled Auth settings.
5. Complete two-tenant and payment/finance E2E in an approved test environment, then backup/restore, device/signing and rollback evidence.
6. Recalculate metrics from new evidence; do not infer progress from queued jobs or source presence alone.

**Release status remains BLOCKED / NOT CERTIFIED. No production mutation, deployment, merge, real payment, or migration application was performed in this measurement batch.**
