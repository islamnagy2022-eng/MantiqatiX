# Production Physical-Object Reconciliation — 2026-10-30

**Scope:** read-only reconciliation of the live Supabase project `moyhiluyhjsujhwlyeuu` against the repository's 41 exact required release-migration identifiers and their physical object contracts.

**Result:** **BLOCKED / NOT CERTIFIED**. No production migration, DDL/DML, grant, Auth/RLS change, Edge Function deployment, payment, wallet operation, or financial posting was performed.

## 1. Migration identity is still unresolved

- Live migration ledger: 308 records; latest `20261029083845 require_phone_for_published_directory_listings`.
- Required source IDs in `scripts/production/verify-production.mjs`: **0 of 41** are present under their exact original version identifiers.
- Exact identifier absence is not proof that every effect is absent. Some effects were deployed through later forward-only bundles or repairs. Each source must be reconciled to live SQL/effects before deciding whether to apply, alias, repair, or leave it.
- Do not fabricate migration-ledger rows, replay all missing historical SQL blindly, or replay duplicate source aliases.

## 2. Dashboard dependencies: applied through an exact forward bundle

The live ledger records `20261029041815 professional_dashboard_dependencies_forward_repair`. Its stored SQL statement was compared with `supabase/migrations/20261029041815_professional_dashboard_dependencies_forward_repair.sql`: both are **83,324 characters** and match exactly after CRLF/edge-whitespace normalization.

The bundle explicitly contains reconciled source segments from:

- RC113 — platform custom roles and scoped assignments.
- RC114 — business employee hiring/position management.
- RC115 — control-center integration and employee permission checks.
- RC116 — business subscriber administration.
- RC457 — employee permission-ceiling correction.

Fresh live catalog checks confirmed the four role/employee tables, their related six indexes, and the corresponding control-center/employee RPCs are present. The four tables have both RLS and FORCE RLS enabled, with no direct table privileges for `anon`, `authenticated`, or `service_role`; access is through guarded SECURITY DEFINER RPCs.

This corrects the older object-presence snapshot that incorrectly marked several RC113–RC116 dependencies absent. The original migration version IDs are still not recorded separately. The separate RC113 membership-scope index `ux_user_memberships_user_business_branch_nullsafe` remains absent.

## 3. RC117 default-image work is not in Production

The applied dashboard bundle intentionally excludes RC117 image-column additions and bulk default-image operations. Fresh checks confirm:

- `mnty_default_image_url` and the three default-image trigger functions are absent.
- Default-image triggers for businesses, catalog items, and marketing services are absent.
- `marketing_services.image_url` and `marketing_services.image_source` are absent.
- Forward repairs `20261030100000_rc117_activity_name_sync_forward_repair.sql` and `20261030110000_rc117_restore_untruncated_business_list.sql` exist in `main`, but the live ledger still ends at 20261029083845. Their disposable-replay success is not Production deployment evidence.

## 4. Payment, finance, and ERP object gaps

| Area | Read-only Production evidence |
|---|---|
| RC425 MantiGO Paymob | `mantigo_payment_provider_events` and `process_verified_mantigo_payment_backend` are absent. |
| RC426 digital-page claim | Expected five-argument `finalize_digital_page_payment_intent_backend` is absent; only an older four-argument function exists, with `search_path=public, pg_temp` and authenticated EXECUTE. |
| RC427/428/429/430 | Active-payment-intent unique index and provider/subscription success/failure backend RPCs are absent. |
| RC431 | Digital-page payment backend exists and service_role can execute it, but its live search_path is `public, pg_temp`, not the reviewed empty search_path; body/ACL parity and runtime E2E remain open. |
| RC432 | SMM wallet idempotency unique index is absent, even though wallet RPC names exist. |
| RC434/435 | Atomic ERP receipt RPC and the two claimable subscription-intent RPCs are absent. |
| RC436 + RC449A/RC450 | Atomic journal RPC and journal uniqueness indexes are absent; RC449A/RC450 are not recorded; five required journal columns are absent; neither legacy nor backend journal RPC grants EXECUTE to service_role. |
| RC437/438 | Purchase-order lines table, line receiving/management RPCs, indexes, and create-with-lines RPC are absent. The existing two-argument `update_purchase_order_status_backend` has `search_path=public` and postgres-only EXECUTE. |

The disposable PostgreSQL 16 RC449A→RC450 integration now passes in GitHub Actions run [40998426630](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40998426630). This validates the migration/test chain in an isolated database; it does not change or certify Production.

## 5. Marketing, CRM, SMM, and digital-page scope

- **RC452 CRM:** live manager-read policies on `marketing_leads` and `marketing_provider_profiles` are role-based but do not constrain tenant/business scope. The intended RC452 scoped policy is not verified live.
- **RC102 provider services:** the owner-manage RLS policy exists for `marketing_provider_services`, but authenticated INSERT/UPDATE table privileges are false. The owner-write grant migration is not reflected in effective table privileges.
- **RC453 campaigns:** `marketing_campaigns`, `marketing_campaign_participants`, and the five campaign RPCs are absent.
- **RC456 SMM:** service_role has no SELECT/INSERT/UPDATE privileges on the six SMM tables inspected. The SMM gateway remains deferred; do not enable it until the reviewed service-role boundary and negative runtime tests pass.
- **RC525 digital pages:** the live `digital_page_products_admin_write` policy checks an ACTIVE SUPER_ADMIN/ADMIN membership, but does not demonstrate the reviewed explicit platform-admin scope. RC525's policy contract remains unverified.

For order RPCs, `create_order_backend` and `update_order_status_backend` currently exist and expose EXECUTE to service_role only, with `search_path=public`. Their full body/source semantic parity, caller contracts, and end-to-end behavior remain to be reconciled.

## 6. Verified forward repairs and aliases

- **RC451:** original source version remains absent, but forward repair `20261027223523` is recorded and its statement matches source exactly. The live targeted-ad function has empty search_path; anon/authenticated EXECUTE is retained for intended public discovery and PUBLIC EXECUTE is false.
- **Dashboard:** RC113–RC116/RC457 effects are present via the exact applied forward bundle described above.
- **Qadam:** the original seed version `20261027093000` is absent. The scoped follow-up repair `20261027205405` is recorded; the business and owner membership are active, with 15 active products and 12 matching price rows. Do not replay the seed migration as a duplicate.
- **RC424 alias:** source version `20261009010000` has an exact statement-body alias at live ledger version `20261008222845`; preserve the historical version and do not rerun.
- **Marketing-contact alias:** source version `20261027100000` is an exact source-blob alias of already-recorded `20261027041411`; do not rerun duplicate SQL.

## 7. Security snapshot and release decision

The latest Security Advisor snapshot observed 8 RLS-enabled/no-policy tables, 3 SECURITY DEFINER functions callable by anon, 67 callable by authenticated, and leaked-password protection disabled. These findings require function-by-function/grant-by-grant review; no blanket revoke or broad policy was applied.

Remaining release blockers include the exact 41-version migration identity gate, missing/drifted payment/finance/ERP/marketing effects, six critical Edge Function source mismatches, Auth hardening, real payment/finance E2E, backup/restore rehearsal, rollback rehearsal, and browser/device verification.

**Production remains BLOCKED / NOT CERTIFIED.**
