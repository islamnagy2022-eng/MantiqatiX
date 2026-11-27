# Production and Edge Read-only Recheck — 2026-11-28

## Scope and method

This report records a read-only verification of the connected Supabase Production project and selected deployed Edge Function entrypoints against the current GitHub source. No production migration, SQL write, Auth/RLS/GRANT mutation, Storage write, Edge deployment, payment, refund, wallet, payout, settlement, or customer/business-data mutation was performed.

Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`)  
Observed at: 2026-11-28 00:55 EET (2026-11-27 22:55 UTC)  
Application/source baseline recorded after RC930: `6581ba937f7075987bd1d6055412afb9a73ad44e`  
Latest read-only evidence-document commit recorded previously: `9aa0a4cca803f6d6d71ea06720fe9f15d23cb34f`

## Live database and migration identity

- Supabase project status: `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.155`.
- Live migration inventory: 310 rows; latest version `20261110150618`.
- The canonical source contract in `scripts/production/live-reconciliation-contract.mjs` contains 90 unique, strictly ordered required migration versions.
- Exact source-version intersection with the live migration ledger: **0/90**; 90 required IDs are absent as exact IDs.
- Three previously declared legacy aliases have their target ledger versions present while their source filename versions are absent:
  - `20261009010000 → 20261008222845` (RC424).
  - `20261027100000 → 20261027041411` (marketing contact).
  - `20261101150000 → 20261101140105` (directory permission evidence).
- The 2026-11-27 21:42 UTC read-only audit recorded exact SQL/blob alias comparisons and relevant physical effects for these three cases. Their formal reconciliation/repair states must not be silently treated as complete if the current manifest still says pending.
- Do not fabricate migration ledger entries, rewrite history, or replay the 90-version chain blindly against Production. A zero exact-ID match is an identity gap, not proof that every physical object is absent.

## Platform-root authorization

A fresh read-only PostgreSQL catalog query confirmed:

- `private.platform_admins` exists and is owned by `postgres`; RLS is enabled but FORCE RLS is disabled.
- `public.is_platform_admin()` remains SECURITY INVOKER with `search_path=public`; its body grants true for any ACTIVE `user_memberships` row whose role is `ADMIN` or `SUPER_ADMIN`. It does not consult the private platform-admin registry.
- `public.mnty_can_platform_admin()` remains SECURITY DEFINER, owned by `postgres`, with `search_path=public, pg_temp`; its body delegates to `public.mnty_can('admin',NULL,NULL,NULL)`. It does not consult the private platform-admin registry.
- The helper blast radius remains 57 policy references for `is_platform_admin()` and five for `mnty_can_platform_admin()`, previously measured across 27 distinct tables combined (62 references).

This is a confirmed authorization design defect in the live helper definitions; it is not evidence that exploitation occurred or that a breach happened. Keep admin Edge deployments blocked until the ordered registry-backed migration, caller, policy, ACL and adversarial-test chain is released as one reviewed unit.

## Complete deployed Edge Function source comparison

All **42 ACTIVE Edge Functions** were enumerated from the connected Production project. Every deployed file returned by the function read was compared byte-for-byte with its corresponding tracked `main` source where a source path exists. The shared `_shared/*` files were correctly compared with `supabase/functions/_shared/*` rather than a function-local folder.

### Summary

| Result | Count |
|---|---:|
| Complete deployed bundle matches current tracked source | **21 / 42** |
| Function entrypoint differs from tracked current source | **19 / 42** |
| Entrypoint matches but a deployed Deno configuration file is not tracked at the expected source path | **2 / 42** |

The `public-catalog` entrypoint matches after normalizing only the expected packaging import prefix (`../_shared/` in Git source → `./_shared/` in the deployed bundle); all three of its deployed shared modules match byte-for-byte. The four shared modules used by `public-catalog-directory` also match byte-for-byte, but its deployed entrypoint remains materially older than current source.

### 19 entrypoints with source drift

| Function | Live version | Comparison note |
|---|---:|---|
| `business-branch-admin` | 5 | Entrypoint differs |
| `mnty-push-dispatch` | 4 | Entrypoint differs |
| `financial-journal` | 3 | Entrypoint differs; live entrypoint is substantially shorter |
| `settlement-financial-atomic` | 4 | Entrypoint differs; deployed `deno.json` matches |
| `legal-cms` | 6 | Entrypoint differs |
| `catalog-platform-admin` | 23 | Entrypoint differs |
| `subscription-payment-intent` | 4 | Entrypoint differs; current source includes claim/idempotency and encrypted checkout-secret flow |
| `digital-page-payment-intent` | 5 | Entrypoint differs; current source includes claim/idempotency correlation |
| `catalog-admin` | 20 | Entrypoint differs; current source includes later catalog/admin guards and gallery boundaries |
| `public-catalog-directory` | 20 | Entrypoint differs; current source adds signed, scope-bound keyset pagination and bounded scans |
| `paymob-webhook` | 10 | Entrypoint differs; current source includes additional subscription/digital-order processing |
| `order-create` | 8 | Entrypoint differs |
| `business-register` | 9 | Entrypoint differs |
| `mnty-customer-registration` | 4 | Entrypoint differs |
| `ai-gemini-proxy` | 5 | Entrypoint differs |
| `health` | 3 | Entrypoint differs; deployed entrypoint is a small stub relative to current source |
| `payment-intent` | 8 | Entrypoint differs; current source uses the user-scoped payment authorization RPC and Paymob correlation checks |
| `erp-purchase-receive` | 3 | Entrypoint differs |
| `directory-listings` | 18 | Deployed code is a 2 KB fail-closed stub; current source is a larger consent/source-gated implementation. Keep the deployed fail-closed behavior until legal source evidence and owner/contact consent gates are independently satisfied. |

### Two deployed Deno configuration files without tracked counterparts

| Function | Live version | Entrypoint | Untracked deployed file |
|---|---:|---|---|
| `mnty-provider-onboarding-review` | 3 | Matches | `deno.json` (Supabase JS import map) |
| `payment-webhook` | 3 | Matches | `deno.json` (strict compiler option) |

The expected function-local `deno.json` path is absent in current `main` for these two functions. No configuration was copied or deployed in this audit.

### 21 complete bundle matches

`legal-center`, `settlement-create`, `api`, `legal-gate`, `smm-gateway`, `post-financial-journal`, `approval-list`, `marketing-lead-create`, `business-deactivate`, `facebook-page-import`, `mnty-provider-onboarding-submit`, `subscription-start-trial`, `mnty-registration-review`, `business-onboarding-status`, `mantigo-payment-intent`, `public-catalog` (after the packaging import-prefix normalization described above), `order-status-update`, `erp-product-create`, `digital-page-order-create`, `legal-consent`, and `business-approval`.

### Release consequences

- The 19 entrypoint differences are **source-to-live parity gaps**, not proof by themselves of exploitable vulnerabilities. Current source must not be deployed just to eliminate a byte difference; some changes depend on unapplied migrations, RPC signatures, ACL/RLS policies, keys and tested business flows.
- Do not deploy `catalog-admin` or `catalog-platform-admin` until the platform-admin registry and exact caller/policy release chain is applied and verified.
- Do not deploy payment, webhook, journal, subscription, digital-page-order or settlement functions individually. Their source dependencies and atomicity/idempotency behavior must be released together after the backup and sandbox gates.
- Do not replace the deployed fail-closed `directory-listings` stub with current source until source provenance, owner publication rights, contact consent, claim authorization and the full deployed-origin negative/positive tests are proven.
- Keep `public-catalog-directory` deployment blocked until pagination RPC/schema, token/cursor tests and all shared Edge bundles are reconciled as one deployment.
- No Edge Function was deployed or changed during this read-only comparison.

## Website and monitoring status

- The latest recorded Pages deployment and deployed-origin browser checks passed for the root catalog, `/legacy/`, `/v6-preview/`, catalog routes, dashboard desktop/mobile, QR and activity-share accessibility.
- The associated Production Health Monitor reported the protected Edge `/health` endpoint as **NOT CHECKED** because `HEALTH_MONITOR_TOKEN` was missing. A successful website/legacy database probe is not evidence that protected Edge health was checked.

## Complete public-schema SECURITY DEFINER inventory

A fresh read-only `pg_proc` + effective EXECUTE privilege inventory over all 149 public-schema SECURITY DEFINER functions found:

| Measure | Count |
|---|---:|
| Public SECURITY DEFINER functions | 149 |
| Effective EXECUTE for `authenticated` | 65 |
| Effective EXECUTE for `anon` | 1 |
| Empty function-level `search_path` | 28 |
| Non-empty explicit `search_path` | 121 |
| Unset function-level `search_path` | 0 |

Among the 65 authenticated-executable functions, 18 have an empty path and 47 have a non-empty path. All 149 inspected functions are owned by `postgres`. The only anon-executable function is `public.get_mnty_targeted_advertisements(...)`, and its path is empty. It is a documented public ad-read contract and must be checked against its allowlisted projection and predicates rather than blindly revoked.

These are aggregate exposure counts, not a declaration that all 65 routines are unsafe. A non-empty path may still be defensible when the function body is schema-qualified and all referenced schemas are trusted; each routine requires body, caller, tenant/auth, grants and intended-audience classification. A separate focused sample found eight shared SECURITY DEFINER helper/caller routines using non-empty paths; only `mnty_can_platform_admin()` in that sample was directly authenticated-executable. Do not mass-revoke or mass-alter function paths.

The current Supabase Security Advisor snapshot returned 166 findings total (157 WARN, 9 INFO): 90 anonymous-Auth policy warnings, 65 authenticated SECURITY DEFINER warnings, one anon SECURITY DEFINER warning, nine RLS-enabled/no-policy INFO, and leaked-password protection disabled. Advisor categories are signals for predicate-by-predicate review; anonymous Auth-session policies are not equivalent to raw anon-role grants.

## Release blockers and operating decisions

1. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.
2. Owner-controlled encrypted Production database and Storage exports, integrity/retrieval proof, Auth/Vault recovery coverage, independent PostgreSQL 17 restore/rollback and measured RPO/RTO remain NOT VERIFIED. Disposable CI replay is not a Production backup/restore drill.
3. Finish the complete 90-version source-to-ledger/alias/physical-effect reconciliation and database/RPC/ACL/RLS dependency closure.
4. Correct platform-root registry enforcement only through the coordinated ordered migration/caller/policy release, after its required backup and exact-head adversarial tests.
5. Reconcile all critical Edge source bundles and their database dependencies; do not ship a partial admin/payment deployment.
6. Keep payment, webhook, wallet, payout, settlement, and customer-data operations blocked until signed sandbox tests and finance/journal/idempotency/rollback evidence pass.
7. Keep the Menoufia-specific catalog and OSM-candidate work permanently cancelled. Use only the existing `Activity → Specialty` sections; newly added unverified records must remain hidden `DRAFT / UNVERIFIED` until independently verified.
8. Do not edit `docs/SESSION_LOG.md` in this audit update.

## Evidence boundaries

The release contract now includes RC115 (`20261125130000`, tenant/business-scoped marketing CRM) and RC931 (`20261128010000`, removal of global provider-profile base-table reads). Both are source-only and depend on the complete RC479 → RC926 → RC115 → RC931 security chain.

This report records source and metadata reads only. It does not claim that all 90 migrations' physical effects are absent, that all 42 Edge Functions were byte-compared, that payments are safe, that a Production backup exists, or that the platform is launch-certified.
