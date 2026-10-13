# Migration Semantic Reconciliation — 2026-10-13

**Repository:** `islamnagy2022-eng/MantiqaTiX`  
**PR:** #218 (draft, unmerged)  
**Reviewed branch head:** `a5252349cc84680c618628a4c88ac87f1ce5dbf2`  
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

## CI snapshot at review

Observed workflow results on the reviewed head included successful runs for:
- Migration history immutability
- Migration version uniqueness
- Open-PR migration collision guard
- RC446 MantiGO open-ride privacy boundary
- RC449/RC462 platform-admin scope boundary
- RC522 audit-log append-only ACL
- Approval-action audit atomicity
- SMM service-role access boundary
- Targeted-ad search-path integration
- Matrimony privacy integration
- Module professionalization validation
- RC434 ERP receiving integration

The focused recovered-migration integration workflow and RC523 financial-report integration job were still queued at the last observation; they are not counted as passing. Web validation succeeded, but the deploy job was skipped. These results do not constitute release certification.

## Release gate

**BLOCKED / NOT CERTIFIED.** Required next steps:
1. Reconcile the five semantic discrepancies above, including migration filename/version ordering.
2. Complete the unmatched ledger/source inventory with exact-version and normalized SQL comparison; manually review material differences.
3. Run a full chronological replay in disposable PostgreSQL with required extensions/roles and module fixtures.
4. Re-run all exact-head CI after reconciliation.
5. Verify deployed Edge Function source differences individually; do not overwrite hardened branch implementations with weaker live copies.
6. Complete backup/restore evidence, tenant isolation, financial idempotency/reconciliation, and production E2E checks before any release decision.
