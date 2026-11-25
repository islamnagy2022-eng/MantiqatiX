# PASS 2431–2440 — Read-only Production release-gate recheck

**Date:** 2026-11-25  
**Project:** `moyhiluyhjsujhwlyeuu` — MANTIQATIX FINAL  
**Database:** PostgreSQL 17.6.1.155 / `us-east-2`  
**Scope:** Supabase project, migration ledger, selected database contracts, deployed Edge Function inventory, and GitHub validation/deployment workflow state.  
**Production impact:** Read-only inspection only. No SQL writes, migration application, Auth/RLS/GRANT mutation, Storage/Vault change, Edge deployment, payment, settlement, or website deployment.

## 1. Project health and migration ledger

| Check | Read-back |
|---|---|
| Supabase project status | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.155` |
| Migration ledger rows | 310 |
| Latest live migration | `20261110150618` — `revoke_public_execute_from_trigger_functions` |
| Current exact release migration set | 83 versions |
| Exact required versions recorded in Production | 0 / 83 |
| Production release certification | **BLOCKED / NOT CERTIFIED** |

The exact 83-version set is defined by `REQUIRED_RELEASE_MIGRATION_VERSIONS` in `scripts/production/live-reconciliation-contract.mjs` and checked by `scripts/validate-production-migration-chain-gate.mjs`.

**Interpretation:** zero exact version identifiers is a source/ledger identity blocker; it is not proof that every SQL effect is wholly absent. The historical source-to-live crosswalk identifies partial baselines and three separate source/ledger aliases whose effects are represented under older ledger identifiers. Those aliases are outside the current 83-version release set, and their formal migration-history repairs remain pending. Do not replay an alias or fabricate migration-ledger rows.

## 2. Direct read-only database contract checks

Exact RPC signature checks were performed against `pg_proc`, with effective role privileges checked through `has_function_privilege`.

| Required contract | Present | Relevant live state |
|---|---:|---|
| Standard payment failure processor | No | Exact required signature absent |
| Subscription payment success processor | No | Exact required signature absent |
| Subscription payment failure processor | No | Exact required signature absent |
| MantiGo payment processor | No | Exact required signature absent |
| Claimable subscription intent creation | No | Exact required signature absent |
| Subscription provider-intent claim | No | Exact required signature absent |
| Digital-page payment processor | Yes | SECURITY DEFINER; owner `postgres`; `search_path=public, pg_temp`; `service_role` EXECUTE = true; `anon` and `authenticated` EXECUTE = false |
| Financial journal backend | Yes | SECURITY DEFINER; owner `postgres`; `search_path=public`; `service_role` EXECUTE = false; `anon` and `authenticated` EXECUTE = false |

The two present functions do not satisfy the full release contract: the digital-page function retains a non-empty search path, and the financial-journal backend is not executable by `service_role`.

## 2A. Security Advisor and catalog-write hardening

A fresh Supabase Security Advisor read-back at `2026-11-25T02:27:16Z` returned **166 lint findings across five categories** (9 + 1 + 65 + 90 + 1):

| Advisor category | Count | Severity / interpretation |
|---|---:|---|
| RLS enabled without policies | 9 | INFO; access is denied by default in these cases, but intended policy design must be verified |
| Anonymous can execute SECURITY DEFINER | 1 | WARN; the reported function is the targeted-advertisement read RPC and needs an explicit public-read contract review |
| Authenticated can execute SECURITY DEFINER | 65 | WARN; each routine needs body/ACL/tenant-scope review; not 65 confirmed vulnerabilities |
| Policies permit Anonymous Auth role | 90 | WARN; policy intent must be reviewed individually, especially on business, finance, storage and owner data |
| Leaked-password protection disabled | 1 | WARN; Auth security setting remains to be enabled and verified |

These are advisor findings, not a count of confirmed exploitable vulnerabilities. Several catalog-related functions flagged by the advisor were inspected read-only. The live item, price, profile, settings and status RPC bodies include `auth.uid()` and tenant/business/branch membership predicates. The live `catalog-admin` Edge Function also requires a Bearer token, validates the user with Supabase Auth, rejects Anonymous Auth users, and checks active memberships before forwarding writes. Those controls reduce the significance of a generic SECURITY DEFINER warning, but do not close the separate source-contract and database-hardening gaps below.

**Catalog price-write blocker — RC486:**
- Live `upsert_catalog_price_backend` is still `SECURITY DEFINER` with `search_path=public`.
- Its current body allocates `MAX(version)+1` without a transaction-scoped advisory lock.
- The unique null-safe item/branch/version index `catalog_item_prices_item_branch_version_uidx` is absent.
- The live `catalog-admin` Edge Function exposes both `ITEM_PRICE_UPSERT` and `PRICE_UPSERT`, which call this RPC through the authenticated user client.
- The source migration `20261120210000_rc486_catalog_price_version_serialization.sql` and its integration test exist in the repository. The migration performs duplicate/null preflight, adds the unique index, sets an empty `search_path`, and locks the item/branch key before reading `MAX(version)`. It is not recorded as applied in Production.

Therefore the current `CATALOG_PILOT_GATE=PASS` must not be read as proof that concurrent catalog price writes are production-safe. Keep concurrent price mutation outside the approved pilot/write scope until RC485/RC486/RC923/RC925 and their preceding registry dependencies are reconciled, replayed and tested as one ordered chain. Do not hot-patch a live RPC or apply RC486 by itself.

**Directory-specific advisor findings:** `directory_listing_claim_requests`, `directory_source_permission_evidence`, and `public_directory_listings` are among the nine RLS-enabled tables with no policies. The public unclaimed-directory endpoint and contact-consent flow must remain disabled/fail-closed until its consent registry and reviewed policy set are installed. The zero-row source-permission evidence result is a separate blocker.

## 3. Physical relation, RLS and consent checks

| Relation | Present | RLS | FORCE RLS | Result |
|---|---:|---:|---:|---|
| `public.directory_listing_contact_consents` | No | — | — | **BLOCKED** — consent registry absent |
| `public.directory_source_permission_evidence` | Yes | Yes | Yes | **BLOCKED** — 0 evidence rows |
| `private.platform_admins` | Yes | Yes | No | **BLOCKED** — FORCE RLS absent |
| `public.erp_purchase_order_lines` | No | — | — | **BLOCKED** — order-line table absent |
| `public.mantigo_payment_provider_events` | No | — | — | **BLOCKED** — provider-event idempotency table absent |
| `public.journal_entries` | Yes | Yes | Yes | Presence only; required columns/RPC/ACL parity still needs proof |

No customer, merchant, payment, or directory contact values were selected. Only catalog metadata and the aggregate count of source-permission evidence rows were read.

## 4. Deployed Edge Function inventory

The current Supabase function inventory reports these critical functions as `ACTIVE`:

| Edge Function | Deployed version |
|---|---:|
| `api` | 17 |
| `order-create` | 8 |
| `order-status-update` | 4 |
| `payment-webhook` | 3 |
| `payment-intent` | 8 |
| `paymob-webhook` | 10 |
| `digital-page-payment-intent` | 5 |
| `subscription-payment-intent` | 4 |
| `financial-journal` | 3 |
| `smm-gateway` | 13 |
| `directory-listings` | 18 |

An `ACTIVE` status proves that a function version is deployed, not that its source bundle, RPC dependencies, grants, or runtime behavior match current `main`. The prior source-parity report classified the 11-function set as 4 exact source matches and 7 mismatches; the directory v18 deployment was separately classified as a single-file fail-closed temporary disable. A matching database + complete Edge bundle release remains required.

## 5. CI and deployment distinction

| Workflow | Run | Result |
|---|---:|---|
| Primary Catalog Frontend Validation | `45530237012` | All 3 jobs succeeded: build, employee RBAC PostgreSQL tests, browser E2E |
| Deploy MantiqatiX Web validation | `45530237064` | Validation job succeeded |
| Deploy MantiqatiX Web deployment job | `45530237064` | **Skipped** — this was a pull-request event, not a push/workflow dispatch to `main`; no website deployment occurred |

The workflow log explicitly recorded:
- `CATALOG_PILOT_GATE=PASS`
- `FULL_PLATFORM_GATE=BLOCKED; CATALOG_PILOT_GATE=PASS; continuing only with the scoped catalog frontend.`
- Backend deployment scope limited to `catalog-platform-admin`, `catalog-admin`, `public-catalog`, and `public-catalog-directory`; it excluded payment-intent, webhook, order, finance, SMM, and MantiGO deployments.

This proves that the **scoped catalog pilot gate** passed for this candidate workflow. It does not mean the site was deployed by this PR run, nor does it override the blocked full-platform gate or certify the complete platform. The Pages deploy job is separately conditioned on a `main` push or `workflow_dispatch`, after the required validation jobs pass.

## 6. Backup and recovery gate

The organization read-back identifies the Free plan. The current backup runbook and read-only evidence do not demonstrate a retrievable owner-created database export, separate Storage object export, Vault/secret recovery, disposable PostgreSQL 17 restore, rollback rehearsal, or measured RPO/RTO.

This is **NOT VERIFIED**, not a claim that no owner-created backup exists. The connected tools did not expose an owner backup inventory. An operator-controlled encrypted export and independently verified restore remain prerequisites. Do not upgrade the plan or create a billable Supabase branch without explicit cost approval.

## 7. Repository change status

- PR [#1101 — verify required MantiqatiX brand assets](https://github.com/islamnagy2022-eng/MantiqatiX/pull/1101) remains **open / draft**. Its exact-head validation jobs passed; it has not been merged by this review.
- PR [#1102 — align production release runbook to 83 migration versions](https://github.com/islamnagy2022-eng/MantiqatiX/pull/1102) is **open / draft** and contains documentation-only changes. No CI status checks were returned for its commit at the time of this report. It is not merged or deployed.

## 8. Release decision

**FULL PLATFORM: BLOCKED / NOT CERTIFIED.**

Do not apply the 83-version migration set as a blind batch. First complete operator-owned encrypted DB + Storage backup and isolated restore/rollback; reconcile historical source identities and partial effects; then run chronological PostgreSQL 17 replay and adversarial authorization/payment/directory tests against the exact candidate. Apply the coordinated DB/Edge release only in an explicitly approved Production window, followed by deployed-origin positive and negative tests.

**No Production mutation or deployment was performed in this recheck.**
