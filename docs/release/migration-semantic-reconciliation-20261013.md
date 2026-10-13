# Migration Semantic Reconciliation — 2026-10-13

**Repository:** `islamnagy2022-eng/MantiqaTiX`  
**PR:** #218 (draft, unmerged)  
**Reviewed code/test head:** `ca520738fde2fcac405840312ef52a8a1d3df44f`  
**Documentation refresh commit:** `b2c2eab3a78c0a96eb59d3f0756f87b1b9278be4` (no PR-triggered workflow run was returned for this docs-only commit at the time of recheck).  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only comparison of repository migration files with `supabase_migrations.schema_migrations.statements`. No production schema or data was changed.

## Findings requiring a migration reconciliation decision

| Ledger version/name | Repository source | Observed discrepancy | Safe disposition |
|---|---|---|---|
| `20260928130841 / rc169_nearby_provider_search_adapter` | `20260928193000_rc169_nearby_provider_search_adapter.sql` | Repository function joins `marketing_provider_profiles` and requires active status; ledger function joins branches directly. This changes which providers can be returned. | Do not silently replace either copy. Establish intended behavior, then test both active and inactive profile cases in disposable PostgreSQL. |
| `20260928131753 / rc172_restore_medical_booking_contract` | `20260928210000_rc172_restore_medical_booking_contract.sql` | Function body differs materially; ledger declares `v_status` while repository source does not. | Review complete function-body diff and run appointment lifecycle/authorization regression tests before choosing a canonical forward correction. |
| `20260928154050 / rc199_customer_cross_tenant_order_visibility` | `20260928184000_rc199_customer_cross_tenant_order_visibility.sql` | Ledger statement creates only `orders_customer_select_own`. Repository file also creates `order_status_history_customer_select_own`, which is already created by the later ledger migration `20260928154411 / rc199_marketplace_order_read_grants_v2`. The repository filename also sorts after that later migration. | The current repository file sequence is not safely replayable as-is: it may attempt to create the history policy twice. Reconcile the file contents/order without editing historical production history; verify customer-only visibility and anonymous-session denial in an isolated database. |
| `20260928161513 / rc206_geographic_ad_targeting_and_nearest_fallback` | `20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql` | The function/table SQL differs beyond formatting; a normalized comparison showed a body difference. The RPC exists in both copies, so presence alone does not establish parity. | Review complete function-body diff and assert country/governorate/center targeting, nearest fallback, inactive ads, and anonymous execution contract in isolated tests. |
| `20260928174954 / rc207_official_global_mnty_cover_ads` | `20260928210000_rc207_official_global_mnty_cover_ads.sql` | The ledger SQL includes a replacement of `get_mnty_targeted_advertisements` (global-ad fallback behavior); the repository file only defines the global-ad table/admin RPC/seeds and does not include that replacement. | Treat as a semantic source gap. Verify RPC behavior and migration dependency order; do not declare full replay ready until resolved. |

## Related checks

- Live Supabase migration ledger observed: **283 rows**, ending at `20261008222845 / rc424_atomic_digital_page_payment_webhook`.
- Repository migration files observed at reviewed head: **160**.
- The count-based inventory ratio (126 filenames timestamped at/before the RC424 ceiling / 283 ledger rows) is an inventory indicator only, not a semantic match rate.
- Existing ledger-derived files under `supabase/recovered-migrations/` are archival candidates, not automatically executable migrations. They require source review, secret scanning, dependency/order reconciliation, and disposable replay before use.
- No historical migration was edited by this audit. No production migration, RLS policy, grant, function, Edge Function, payment, or other data-changing operation was executed.

## CI snapshot — refreshed for reviewed head `ca520738fde2fcac405840312ef52a8a1d3df44f`

The following GitHub Actions runs associated with the tested code head `ca520738fde2fcac405840312ef52a8a1d3df44f` were observed completed successfully. They are not represented as checks on the later documentation-only commit:

- Migration History Immutability — run `38333772074`
- Open PR Migration Collision Guard — run `38333772068`
- Migration Version Uniqueness — run `38333772081`
- Audit Log Append-only ACL — run `38333772063`
- SMM Service Role Access Boundary — run `38333772056`
- MantiGO Open Ride Privacy Boundary — run `38333772138`
- MantiGO Platform Admin Scope Hardening — run `38333772101`
- Approval Action Audit Atomicity — run `38333772091`
- Module Professionalization Validation — run `38333772093`
- Backend-only Module Boundary — run `38333772116`
- Recovered Migration Focused Integration — run `38333772075`, including the RC523 financial-report regression job and its canonical-column-only second pass
- Web validation — run `38333772096`; the validation job succeeded and the deploy job was **skipped**

These results strengthen branch-level regression evidence, including disposable-PostgreSQL checks. They do **not** establish that the entire workflow matrix is complete, that a chronological full-history replay succeeds, or that the live production authorization defect is fixed. No production deployment was performed by the skipped deploy job, and no candidate migration was applied to production.

## Release gate

**BLOCKED / NOT CERTIFIED.** Required next steps:
1. Reconcile the five semantic discrepancies above, including migration filename/version ordering.
2. Complete the unmatched ledger/source inventory with exact-version and normalized SQL comparison; manually review material differences.
3. Run a full chronological replay in disposable PostgreSQL with required extensions/roles and module fixtures.
4. Re-run all exact-head CI after reconciliation.
5. Verify deployed Edge Function source differences individually; do not overwrite hardened branch implementations with weaker live copies.
6. Complete backup/restore evidence, tenant isolation, financial idempotency/reconciliation, and production E2E checks before any release decision.


## Additional read-only ledger reconciliation — duplicate source timestamps

A new read-only query against the live `supabase_migrations.schema_migrations` ledger resolved the actual version/name identities for all five duplicate source-version groups. The ledger rows exist under distinct versions, but this does **not** establish that current source SQL is semantically identical to the applied SQL.

| Conflicting source timestamp | Source migration names | Live ledger identities observed |
|---|---|---|
| `20260928020000` | `rc101_g6_rls_permissive_policy_hardening`; `rc102_g8_crm_notification_support_rls_hardening` | `20260928101022 / rc101_g6_rls_permissive_policy_hardening`; `20260928104107 / rc102_g8_crm_notification_support_rls_hardening` |
| `20260928060000` | `rc109_harden_order_support_tenant_boundaries`; `restore_registration_request_dml_grants` | `20260928112420 / rc109_harden_order_support_tenant_boundaries`; `20260928034100 / restore_registration_request_dml_grants` |
| `20260928190000` | `rc162_mantigo_trip_state_machine`; `rc200_cross_tenant_customer_payment_authorization` | `20260928124303 / rc162_mantigo_trip_state_machine`; `20260928154527 / rc200_cross_tenant_customer_payment_authorization` |
| `20260928200000` | `rc164_mantigo_direct_delete_lockdown`; `rc164_retire_legacy_mantigo_mutator`; `rc206_geographic_ad_targeting_and_nearest_fallback` | `20260928125655 / rc164_mantigo_direct_delete_lockdown`; `20260928125731 / rc164_retire_legacy_mantigo_mutator`; `20260928161513 / rc206_geographic_ad_targeting_and_nearest_fallback` |
| `20260928210000` | `rc172_restore_medical_booking_contract`; `rc207_official_global_mnty_cover_ads` | `20260928131753 / rc172_restore_medical_booking_contract`; `20260928174954 / rc207_official_global_mnty_cover_ads` |

### Disposition

- This result is a **version/name identity finding only**. It is not a source-content approval.
- Do not mechanically rename these files solely to make duplicate-version CI pass. Before any rename, compare each full SQL body with its ledger statement array, review dependencies/order, and confirm the appropriate historical-source treatment.
- RC172, RC206, and RC207 already have material source-vs-ledger semantic differences documented above; preserve these as explicit reconciliation blockers and do not silently select either copy.
- No production objects, migration rows, grants, RLS policies, Auth settings, or data were changed. The query was read-only.
