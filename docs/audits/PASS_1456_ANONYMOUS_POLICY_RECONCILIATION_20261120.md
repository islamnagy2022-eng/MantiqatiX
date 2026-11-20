# Pass 1456 — Anonymous-auth policy reconciliation, first evidence slice

**Date:** 2026-11-20  
**Project:** `moyhiluyhjsujhwlyeuu`  
**Method:** fresh Security Advisor snapshot and read-only `pg_policies`, role-grant, RLS, and Storage bucket metadata queries. No application rows selected. No Production mutation.

## Advisor inventory

Fresh Security Advisor returned **90** `auth_allow_anonymous_sign_ins` findings, each associated with a table. This warning is not equivalent to 90 confirmed leaks. Supabase anonymous Auth users use the `authenticated` Postgres role, so the relevant distinction is:
- unauthenticated `anon` role access;
- anonymous Auth session with `role=authenticated` and JWT claim `is_anonymous=true`;
- confirmed Auth user with `role=authenticated` and `is_anonymous=false`.

The available Supabase connector does not expose the project's Auth configuration setting for anonymous sign-in enablement. Do not assume whether it is enabled.

## Policy metadata aggregation across the 90 Advisor tables

Read-only aggregation of live `pg_policies` found:
- **86/90** tables have at least one permissive policy for `authenticated`.
- **46/90** have a table-wide restrictive policy explicitly checking the JWT `is_anonymous` claim.
- **40/90** have no table-wide restrictive anonymous guard. This is a review queue, not a vulnerability count: many policies are still scoped by `auth.uid()`, active tenant membership, provider ownership, or platform-admin checks; some individual policies contain their own anonymous predicate.
- **7/90** have a permissive policy explicitly targeting `anon` or `public` for public-read behavior.
- Across all 90 tables, **56** have at least one direct table grant to `authenticated`; **16** have INSERT, **16** UPDATE, and **16** DELETE grants (the sets overlap).
- **5** have any direct table grant to `anon`; one of those is `storage.objects`, where the grant layer allows write verbs but the inspected RLS policy inventory has no anon write policy. This needs disposable negative tests; a grant alone does not bypass RLS.
- In the public schema, **8** tables have anon SELECT grants and **0** have anon INSERT, UPDATE, or DELETE grants.

The 40 tables lacking a table-wide restrictive anonymous guard are:
`commission_rules`, `commission_transactions`, `digital_page_orders`, `digital_page_products`, `digital_page_sections`, `digital_pages`, `general_ledger`, `indrive_bids`, `indrive_requests`, `journal_entries`, `journal_entry_lines`, `mantigo_captain_profiles`, `mantigo_financial_config`, `mantigo_financial_ledger`, `mantigo_rate_limit_config`, `marketing_leads`, `marketing_projects`, `marketing_provider_profiles`, `medical_appointments`, `notifications`, `payment_events`, `payment_financial_reconciliations`, `payment_intents`, `payment_provider_events`, `platform_brand_assets`, `platform_geo_areas`, `push_subscriptions`, `refund_transactions`, `settlement_attempts`, `settlement_transactions`, `smm_order_events`, `smm_orders`, `smm_wallet_transactions`, `smm_wallets`, `subscription_payment_intents`, `support_tickets`, `ticket_messages`, `wallet_accounts`, `wallet_transactions`, and `storage.objects`.

## Important per-policy distinctions observed

- Many finance/payment read policies require an active `user_memberships` row for the same tenant and a finance/owner role. No membership rows were queried; anonymous membership impossibility has not been assumed.
- `digital_page_orders` owner read is `user_id = auth.uid()`; this is self-scoped, but an anonymous Auth identity could satisfy the identity comparison if such an order were associated with it.
- `notifications` insert/select/update policies are self-scoped by `user_id = auth.uid()`; these are not broad cross-user access but are not explicitly restricted to non-anonymous Auth sessions.
- `marketing_leads` create/view policies bind to `requester_user_id = auth.uid()`; CRM manager view is membership-scoped.
- `indrive_requests` owner operations are UID-bound; `indrive_bids` submit/read paths include provider/helper checks, with explicit anonymous predicates on some commands but not a table-wide restrictive guard.
- `mantigo_financial_config` and `mantigo_rate_limit_config` rely on `mnty_can_platform_admin()`; the separate known global-helper defect remains tracked by P0 #867 and must not be confused with an anonymous-policy finding.
- `digital_pages`, `digital_page_products`, `digital_page_sections`, active marketing-provider profiles, platform brand assets, Egypt geo areas, and profile media include intended public-read contracts. Do not remove these by blanket policy changes.
- Storage bucket metadata: `mantiqatix-media` is private; `mantiqatix-profile-media` is public and has a public-read policy. The public bucket's object/path contract needs an explicit review to ensure it contains only intentionally public profile branding/media.

## Current disposition

P1 Issue **#928** tracks the remaining policy-by-policy review and disposable anonymous-JWT tests.

No anonymous data access was attempted. No app data, user identities, memberships, payment rows, patient records, ride details, customer contacts, or storage object names were selected. No RLS, GRANT, Auth, Storage, Edge, payment, wallet, or production deployment change occurred.

**Pass 1456 remains OPEN.** The next required work is command-by-command policy composition review of the 40 tables without a table-wide anonymous guard, plus disposable PostgreSQL tests using both anonymous and confirmed-authenticated JWT claims. Preserve intended public discovery and tenant-local flows; no blanket deny migration.
