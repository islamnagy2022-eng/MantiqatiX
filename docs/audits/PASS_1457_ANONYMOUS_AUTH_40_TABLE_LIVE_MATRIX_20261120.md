# Pass 1457 — Live anonymous-auth policy/command matrix (40-table review queue)

**Captured:** 2026-11-20 UTC  
**Project:** `moyhiluyhjsujhwlyeuu` (PostgreSQL 17.6)  
**Method:** read-only catalog query against `pg_policies`, `pg_class`, `pg_namespace`, and `has_table_privilege`. No application rows, user identities, memberships, payment records, patient records, ride records, or object names were read. No Production mutation.

## Scope and interpretation

This is a table-by-table inventory for the 40 relations previously identified as lacking a table-wide restrictive anonymous guard. It records policy names/commands, whether any policy expression mentions the `is_anonymous` JWT claim, RLS/force-RLS flags, and effective direct table privileges for `anon` and `authenticated`.

Privilege vector order is **SELECT / INSERT / UPDATE / DELETE**. A table grant is not equivalent to row access: RLS and the complete policy composition still apply. For policies, permissive policies combine with OR and restrictive policies combine with AND. The `any_policy_anon_predicate` column is informational only; a predicate on one command does not protect other commands.

## Live inventory

| Relation | RLS / FORCE | anon S/I/U/D | authenticated S/I/U/D | Policies (name: command) | Anonymous predicate present |
|---|---:|---:|---:|---|---|
| public.commission_rules | yes / yes | 0/0/0/0 | 1/0/0/0 | admin_delete:DELETE; admin_insert:INSERT; admin_update:UPDATE; member_read:SELECT | no |
| public.commission_transactions | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.digital_page_orders | yes / no | 0/0/0/0 | 0/0/0/0 | owner_read:SELECT | no |
| public.digital_page_products | yes / no | 0/0/0/0 | 0/0/0/0 | admin_write:ALL; public_read:SELECT (anon+authenticated) | no |
| public.digital_page_sections | yes / no | 1/0/0/0 | 1/1/1/1 | owner_manage:ALL; public_read:SELECT (anon+authenticated) | no |
| public.digital_pages | yes / no | 1/0/0/0 | 1/1/1/1 | admin_manage:ALL; owner_insert:INSERT; owner_select:SELECT; owner_update_draft:UPDATE; public_read:SELECT (anon+authenticated) | no |
| public.general_ledger | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.indrive_bids | yes / yes | 0/0/0/0 | 1/0/0/0 | delete:DELETE; insert:INSERT; select:SELECT; update:UPDATE | yes (SELECT/UPDATE only) |
| public.indrive_requests | yes / yes | 0/0/0/0 | 1/0/0/1 | delete:DELETE; insert:INSERT; select:SELECT; update:UPDATE | yes (SELECT only) |
| public.journal_entries | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT; manager_insert:INSERT; manager_update:UPDATE | no |
| public.journal_entry_lines | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.mantigo_captain_profiles | yes / no | 0/0/0/0 | 0/0/0/0 | self_select:SELECT | no |
| public.mantigo_financial_config | yes / no | 0/0/0/0 | 0/0/0/0 | admin_select:SELECT; admin_update:UPDATE | no |
| public.mantigo_financial_ledger | yes / no | 0/0/0/0 | 0/0/0/0 | customer_select:SELECT | no |
| public.mantigo_rate_limit_config | yes / no | 0/0/0/0 | 0/0/0/0 | admin_select:SELECT; admin_update:UPDATE | no |
| public.marketing_leads | yes / yes | 0/0/0/0 | 1/1/0/0 | managers_view:SELECT; users_create:INSERT; users_view_own:SELECT | no |
| public.marketing_projects | yes / yes | 0/0/0/0 | 1/0/0/0 | clients_view_own:SELECT | no |
| public.marketing_provider_profiles | yes / yes | 1/0/0/0 | 1/1/1/1 | CRM_managers_view:SELECT; owners_manage:ALL; public_active_read:SELECT (anon+authenticated) | yes (owner ALL policy) |
| public.medical_appointments | yes / yes | 0/0/0/0 | 0/0/0/0 | customer_select:SELECT; provider_select:SELECT | no |
| public.notifications | yes / yes | 0/0/0/0 | 1/1/1/0 | insert_self:INSERT; select_own:SELECT; update_own:UPDATE | no |
| public.payment_events | yes / yes | 0/0/0/0 | 0/0/0/0 | finance_read:SELECT | no |
| public.payment_financial_reconciliations | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.payment_intents | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.payment_provider_events | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.platform_brand_assets | yes / no | 0/0/0/0 | 0/0/0/0 | public_active_read:SELECT (anon+authenticated); super_admin_manage:ALL | no |
| public.platform_geo_areas | yes / yes | 1/0/0/0 | 1/0/0/0 | deny_direct_access_authenticated:ALL (RESTRICTIVE); public_active_select:SELECT (anon+authenticated) | no |
| public.push_subscriptions | yes / no | 0/0/0/0 | 0/0/0/0 | delete_own:DELETE; insert_own:INSERT; select_own:SELECT; update_own:UPDATE | no |
| public.refund_transactions | yes / yes | 0/0/0/0 | 0/0/0/0 | finance_select:SELECT | no |
| public.settlement_attempts | yes / yes | 0/0/0/0 | 0/0/0/0 | finance_read:SELECT | no |
| public.settlement_transactions | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.smm_order_events | yes / no | 0/0/0/0 | 0/0/0/0 | owner_read:SELECT | no |
| public.smm_orders | yes / no | 0/0/0/0 | 0/0/0/0 | owner_insert:INSERT; owner_read:SELECT | no |
| public.smm_wallet_transactions | yes / no | 0/0/0/0 | 0/0/0/0 | owner_read:SELECT | no |
| public.smm_wallets | yes / no | 0/0/0/0 | 0/0/0/0 | owner_read:SELECT | no |
| public.subscription_payment_intents | yes / yes | 0/0/0/0 | 1/0/0/0 | owner_read:SELECT | no |
| public.support_tickets | yes / yes | 0/0/0/0 | 1/0/0/0 | insert_self:INSERT; select_member:SELECT; update_staff:UPDATE | no |
| public.ticket_messages | yes / yes | 0/0/0/0 | 0/0/0/0 | insert_member:INSERT; select_member:SELECT | no |
| public.wallet_accounts | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| public.wallet_transactions | yes / yes | 0/0/0/0 | 1/0/0/0 | finance_read:SELECT | no |
| storage.objects | yes / no | 1/1/1/1 | 1/1/1/1 | media_authenticated_read:SELECT; maintenance_provider_read:SELECT; media_user_insert:INSERT; media_user_update:UPDATE; media_user_delete:DELETE; platform_brand_insert/update/delete; profile_media_owner_insert/update/delete; profile_media_public_read:SELECT (public) | yes (media and profile insert/read/write subset) |

## Initial findings from the live matrix

1. **All 40 relations currently have RLS enabled.** This is positive evidence, but it does not prove anonymous Auth isolation.
2. **No direct anon INSERT/UPDATE/DELETE table grants** were observed on the 39 public-schema relations in this queue. The public tables with direct anon SELECT are the intended public-discovery surfaces listed below.
3. `storage.objects` has direct anon SELECT/INSERT/UPDATE/DELETE grants. Its inspected policy inventory has a public SELECT policy for the public profile-media bucket, while write policies target authenticated roles and include owner/admin/path checks. This is a high-priority disposable negative-test target; do not infer that the anon grants bypass RLS.
4. `platform_geo_areas` has an explicit restrictive `deny_direct_access_authenticated` policy plus a public active SELECT policy. This is an example where policy names and roles must be interpreted together.
5. `indrive_bids` has explicit anonymous JWT checks on SELECT and UPDATE, but not DELETE/INSERT. Current direct anon grants are zero; still add negative tests for every command because an anonymous Auth JWT uses the `authenticated` role.
6. `indrive_requests` has an anonymous JWT predicate on SELECT, but not INSERT/UPDATE/DELETE. Direct anon DELETE grant is zero; anonymous Auth behavior must be exercised using the `authenticated` role and `is_anonymous=true`.
7. UID-bound self-service policies (notifications, SMM orders/wallet, digital-page order ownership, support tickets/messages, push subscriptions) are not automatically safe for anonymous Auth sessions. Test the anonymous identity separately from a confirmed user and verify it cannot read or mutate private records belonging to another identity.
8. Finance/payment tables generally have no direct anon grants and are membership/role scoped. Their remaining risk is a regression in the helper/membership boundary, not evidence of a current public grant. Disposable tests must cover no-membership anonymous JWT, confirmed non-member, wrong tenant, and authorized same-tenant member.
9. Public discovery contracts must remain available: published `digital_pages`, active `digital_page_products`/`digital_page_sections`, active marketing-provider profiles, active platform brand assets, active geographic areas, and intentionally public profile-media reads. Do not apply blanket deny policies.

## Existing anonymous-session test coverage mapped

| Surface | Existing test | Coverage found in source |
|---|---|---|
| Provider services | `rc102_provider_services_integration.sql` | Anonymous Auth session cannot write provider service |
| Marketing campaign create | `rc453_marketing_campaign_integration.sql` | Anonymous Auth session cannot create campaign |
| Commission preview | `rc455_commission_preview_integration.sql` | Anonymous Auth session rejected |
| Orders read/history | `rc465_orders_read_scope_integration.sql` | Anonymous Auth session receives no order visibility/history |
| Business/branch/inventory | `rc466_business_branch_scope_integration.sql` | Anonymous Auth session receives no business/branch/inventory visibility |
| Commission/finance preview | `rc467_commission_scope_integration.sql` | Anonymous Auth session is not a finance actor |
| MantiGO open rides | `rc478_mantigo_open_ride_forward_privacy_integration.sql` | Anonymous Auth session rejected on open-ride flow |

Related tests exist but were not located with explicit anonymous-JWT assertions in the reviewed source: RC426/428/430/431/444/449a/450/452/456/458/468/474/476/480. They must not be counted as anonymous coverage until the test source asserts the relevant JWT claims and SQL command outcomes.

## Remaining test work, ordered by risk

### P0/P1 sensitive surfaces
- **Storage:** test `storage.objects` SELECT/INSERT/UPDATE/DELETE for direct `anon`, anonymous Auth JWT, confirmed owner, wrong owner, and public profile-media bucket paths. Verify private `mantiqatix-media` remains inaccessible to anon while intended public profile-media SELECT continues to work.
- **Finance/payment:** `payment_events`, `payment_financial_reconciliations`, `payment_intents`, `payment_provider_events`, `refund_transactions`, `settlement_attempts`, `settlement_transactions`, `general_ledger`, `journal_entries`, `journal_entry_lines`, `wallet_accounts`, `wallet_transactions`, `mantigo_financial_ledger`, `mantigo_financial_config`, `mantigo_rate_limit_config`. Assert anonymous Auth and confirmed non-member cannot read, write, or cross tenant; assert authorized finance members retain required reads.
- **Medical/support/private communications:** `medical_appointments`, `support_tickets`, `ticket_messages`, `notifications`, `push_subscriptions`. Assert anonymous identity cannot create/read/update/delete private data; preserve confirmed self-service and staff access.
- **Commerce/self-service:** `digital_page_orders`, `digital_page_sections`, `digital_page_products`, `smm_orders`, `smm_order_events`, `smm_wallets`, `smm_wallet_transactions`. Preserve intended public product/page reads and authenticated owner operations.
- **Marketing/provider:** `marketing_leads`, `marketing_projects`, `marketing_provider_profiles`. Preserve active public provider discovery; verify private owner/CRM fields and write operations do not become anonymous.
- **MantiGO ride lifecycle:** `indrive_requests`, `indrive_bids`, `mantigo_captain_profiles`. Test each SQL command under anonymous Auth claims, including DELETE and INSERT where no explicit anonymous predicate appears.

## Release boundary

This document is a **read-only Production evidence record** and test plan. It does not certify that all 90 Advisor findings are safe, does not establish whether anonymous sign-in is enabled, and does not authorize Production policy/grant changes. All new behavioral tests must run against disposable PostgreSQL fixtures with explicit JWT claims. Production remains uncertified until the complete matrix, regressions, backup/restore rehearsal, and other release gates pass.
