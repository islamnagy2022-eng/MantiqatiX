# Applied Ledger Statement Recovery — 2026-10-17

**Source of truth:** read-only `supabase_migrations.schema_migrations.statements[1]` from connected production project.  
**Change type:** source recovery only; no production writes.  
**Important:** the files below restore the exact SQL statement bodies recorded in the applied ledger. Original comments/formatting are not claimed unless present in the stored statement.

## Recovery method

- Reconciled all 283 applied ledger entries against repository migrations after applying the 55 alias mappings.
- Restored 21 missing source entries from the exact applied SQL statement body at each ledger version.
- Automated screening found no literal email addresses, Egyptian phone-number patterns, or common API/private-key patterns in these 21 statements.
- The owner bootstrap migration `20260927131555_bootstrap_mnty_owner_islam_nagy_v2` is deliberately excluded because its applied SQL contains a hard-coded owner email; it remains documented separately.
- Four entries were already represented by alias-normalized source files and were not duplicated: `20261001170235`, `20261001173313`, `20261002083009`, `20261008125422`.

## Recovered files

| Ledger version | Name | Statement characters | MD5 |
|---|---|---:|---|
| `20260927132359` | `lock_membership_client_mutations` | 826 | `50680a6f2c52f978cb230a367ad690c9` |
| `20260927132406` | `lock_registration_direct_updates` | 399 | `152f230879e36dedcef78e7f46951691` |
| `20260927132904` | `restore_marketing_catalog_grants_and_owner_profile_access` | 1295 | `8afd1d7873f89a0c9fbbc210b04d940c` |
| `20260927133148` | `restore_feature_flags_authenticated_read` | 63 | `0ae8392db6226bcf57e1eeb82bac05a9` |
| `20260928051833` | `revoke_client_non_dml_table_privileges` | 93 | `121c3b1c59bacc2b9c8e835afeb6ccbc` |
| `20260928062438` | `revoke_client_pg_net_execute` | 136 | `89b50f00f7a802dfb2931b6b18947c46` |
| `20260928062456` | `revoke_public_pg_net_execute` | 152 | `d2cb8868f0cbaf74af1879471809c71d` |
| `20260928062523` | `revoke_pg_net_http_client_execute` | 334 | `5cd44ddb6e6cf044ced9ae7512389bd7` |
| `20260928064230` | `rc91_harden_payment_intent_order_state` | 3729 | `e1687d255eb423424e238afb5edbcfa9` |
| `20260928064412` | `rc92_lock_pg_net_client_execute` | 476 | `9d40dce224fb27ce1443649fc579bbd2` |
| `20260928123822` | `rc161_mantigo_backend_workflow` | 3799 | `1f00fc37405931a6e06908355b82af6c` |
| `20260928130852` | `rc169_nearby_provider_search_active_only` | 1608 | `9851becc334eb6ad40defa862b7a7cef` |
| `20260928154411` | `rc199_marketplace_order_read_grants_v2` | 443 | `6a29da69ff931c09a88f64edfa3017cd` |
| `20260928161523` | `rc206_fix_targeted_ad_selection_tier` | 2710 | `9d25bcde2312a98652a90ca575433057` |
| `20260928220657` | `rc207b_global_ads_delivery_fill` | 3239 | `c7603a17f8c238f5248d030214f053e5` |
| `20260928232357` | `rc208_egypt_wide_ad_booking_creative` | 487 | `83f5c203f3e6dc387025319c21f9ffa6` |
| `20260929073244` | `seed_mnty_berket_test_business` | 335 | `b6b39d78e1bbb670f82f3dd5509a1faa` |
| `20260929073307` | `seed_mnty_berket_provider_profile` | 680 | `92f56077ed7a42d8b9c0bdb434cc77e9` |
| `20260929203603` | `explicit_deny_policies_for_unexposed_sensitive_tables` | 1031 | `862695c07e678fdccaabc7e6f2d9bc3e` |
| `20260930083347` | `crm_leads_permissions` | 1386 | `c24ccfa914db80c12a5b4891cbfecdc2` |
| `20260930090621` | `fix_marketing_leads_service_role_grant` | 69 | `363f577000a32571dcfd924be41389cd` |

## Remaining limitation

The owner bootstrap source gap remains open because its exact applied statement contains personal information. The full replay must remain blocked at the first missing organization seed until a privacy-reviewed source-recovery route or explicitly approved test-only organization baseline is selected. No test result may be called a clean historical reconstruction while this source is absent.
