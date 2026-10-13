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
| Ledger-derived archive recovery | **33/185 = 17.8%** | 33 candidate rows without exact version/name matches now have SQL statement-derived archive files under `supabase/recovered-migrations/`; these are not yet validated by full chronological replay |
| Full chronological migration replay | **NOT RUN** | No score assigned; a partial fixture run is not a full replay |
| Full production E2E certification | **NOT VERIFIED** | No production-ready percentage is asserted without tenant/payment/finance/backup/device evidence |
| Exact-head PR workflow set at prior source head | **11/12 succeeded; 1 queued** | On head `d9a6b18995b34ec4a467c16207270ff99427fc48`, the focused migration integration workflow remained queued; queued is not PASS. Subsequent source/config commits triggered a fresh CI set, which must be rechecked on the current head |
| SMM gateway regression tests | **PASS** | Deno check, new Deno tests, boundary validator, and isolated PostgreSQL ACL test passed in run 38329947697 |
| Final release certification | **BLOCKED / NOT CERTIFIED** | Binary release gate remains open; not the same as overall source-code progress |


## All canonical UI modules

These 24 canonical codes passed the feature-flag alias mapping contract. The 100% value below applies only to that mapping contract; it does not certify the workflow or production E2E.

| Canonical code | Module | Mapping contract | Production E2E |
|---|---|---:|---|
| ANALYTICS | التحليلات والتقارير | 100% — PASS | NOT VERIFIED |
| CONTROL | التحكم الكامل / إدارة المنصة | 100% — PASS | NOT VERIFIED |
| CRM | المستخدمون وإدارة علاقات العملاء | 100% — PASS | NOT VERIFIED |
| DOMAINS | المجالات والقطاعات | 100% — PASS | NOT VERIFIED |
| EDUCATION | التعليم والمدارس | 100% — PASS | NOT VERIFIED |
| FASHION | التجارة والأزياء | 100% — PASS | NOT VERIFIED |
| FINANCE | المالية والعمولات والتسويات | 100% — PASS | NOT VERIFIED |
| GOVERNANCE | الحوكمة والتدقيق | 100% — PASS | NOT VERIFIED |
| GROCERY | البقالة والسوبر ماركت | 100% — PASS | NOT VERIFIED |
| HOME | الرئيسية | 100% — PASS | NOT VERIFIED |
| JOBS | الوظائف والتوظيف | 100% — PASS | NOT VERIFIED |
| MAINTENANCE | الصيانة والخدمات المنزلية | 100% — PASS | NOT VERIFIED |
| MANTIGO | MantiGO والنقل والمزايدات | 100% — PASS | NOT VERIFIED |
| MARKETING | التسويق والإعلان | 100% — PASS | NOT VERIFIED |
| MATRIMONY | الزواج | 100% — PASS | NOT VERIFIED |
| MEDICAL | المنظومة الطبية | 100% — PASS | NOT VERIFIED |
| MODULES | إدارة الموديولات | 100% — PASS | NOT VERIFIED |
| OPERATIONS | الطلبات والعمليات | 100% — PASS | NOT VERIFIED |
| PRO_SERVICES | الخدمات المهنية | 100% — PASS | NOT VERIFIED |
| REGISTRATION | التسجيل والعضويات | 100% — PASS | NOT VERIFIED |
| RESTAURANTS | المطاعم والكافيهات | 100% — PASS | NOT VERIFIED |
| SETTINGS | الإعدادات | 100% — PASS | NOT VERIFIED |
| SMM | خدمات التسويق الرقمي SMM | 100% — PASS | DEFERRED / NOT DEPLOYED |
| USED_ITEMS | المستعمل | 100% — PASS | NOT VERIFIED |

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

1. **Migration chain:** live ledger has 283 recorded migrations and ends at RC424. The repo contains 160 migration source files, of which 126 have filename timestamps at/before RC424 and 34 are later candidates. There are 185 rows without exact version or suffix-name matches; 33/185 (17.8%) now have ledger-derived archive files outside the CLI migration path. Full per-version source reconciliation and chronological replay remain blocked; 0/33 required later migrations are proven applied.
2. **Security:** live Security Advisor reports 40 authenticated-executable SECURITY DEFINER functions requiring per-function review, one anon-executable targeted-advertisement SECURITY DEFINER warning, one RLS-enabled/no-policy table (`digital_page_payment_events`, intentionally fail-closed pending access-contract verification), and leaked-password protection warning(s). Do not blanket-revoke or add broad RLS policies.
3. **Performance:** current Advisor reports 105 unindexed foreign keys, 375 auth/RLS init-plan warnings, 124 unused-index notices, and 28 multiple-permissive-policy warnings. These need query/usage analysis, not blind schema changes.
4. **Critical runtime acceptance:** two-tenant isolation, live Paymob, finance/settlement, notification delivery, backup/restore rehearsal, signed Android/device release, rollback, and post-deployment smoke remain unverified or external.
5. **SMM:** source and regression CI passed, but SMM remains explicitly disabled/deferred and is not deployed from this branch.

## Next work sequence

1. Continue safe recovery/reconciliation of the production ledger source: 33/185 candidate archive rows are recovered so far; a later bulk write batch was denied by repository write safeguards, and no alternate route was used to bypass that denial.
2. Re-run and finish exact-head focused migration integration.
2. Build a disposable PostgreSQL chronological replay from the authoritative baseline; resolve only real historical dependencies, never stubs or rewritten history.
3. Continue exact source parity comparison for the remaining live Edge Functions and capture results.
4. Close security findings function-by-function and complete owner-controlled Auth settings.
5. Complete two-tenant and payment/finance E2E in an approved test environment, then backup/restore, device/signing and rollback evidence.
6. Recalculate metrics from new evidence; do not infer progress from queued jobs or source presence alone.

**Release status remains BLOCKED / NOT CERTIFIED. No production mutation, deployment, merge, real payment, or migration application was performed in this measurement batch.**
