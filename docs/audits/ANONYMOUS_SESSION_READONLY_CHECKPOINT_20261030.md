# Anonymous-session read-only authorization checkpoint — 2026-10-30

## Scope and safety

Project: `moyhiluyhjsujhwlyeuu`  
Method: read-only production catalog inspection plus a transaction-scoped PostgreSQL role/JWT-claims simulation.  
No persistent writes, DDL, migrations, grants, RLS policies, Auth settings, Edge Functions, secrets, payments, or financial records were changed.

This is **not** a real Supabase Auth anonymous-user E2E test. The test used `SET LOCAL ROLE authenticated` and a synthetic `request.jwt.claims` payload with `is_anonymous=true` and a non-existent UUID. It checks policy behavior for that simulated claim context only. A real anonymous access token, permanent-user comparison, and cross-tenant fixture tests are still required.

## Direct privilege and RLS inventory

For the reviewed sensitive tables, production reports RLS enabled and FORCE RLS enabled. Direct SELECT privilege is absent for the Postgres `anon` role on every table in the inventory. Several tables also deny direct SELECT to `authenticated` (including `payment_events`, `refund_transactions`, `settlement_attempts`, `ticket_messages`, and `medical_appointments`), so those were not queried under the authenticated simulation.

## Simulated anonymous-session SELECT results

The following counts were observed under the synthetic anonymous claims context:

| Table | Visible rows |
|---|---:|
| orders | 0 |
| payment_intents | 0 |
| payment_financial_reconciliations | 0 |
| payment_provider_events | 0 |
| journal_entries | 0 |
| journal_entry_lines | 0 |
| general_ledger | 0 |
| wallet_accounts | 0 |
| wallet_transactions | 0 |
| settlement_transactions | 0 |
| subscription_payment_intents | 0 |
| business_subscriptions | 0 |
| notifications | 0 |
| support_tickets | 0 |
| marketing_leads | 0 |
| user_memberships | 0 |
| businesses | 2 |

The two visible `businesses` rows are consistent with the explicit public SELECT policy limited to ACTIVE showcase businesses. This is an intended public catalog surface, not evidence of tenant-private business exposure. The query did not inspect sensitive columns or attempt mutation.

## Policy review observations

- Financial SELECT policies on payment, wallet, settlement, and journal tables generally bind the row's tenant to an active membership for `auth.uid()` and an allowed finance/owner role. Most of these specific predicates do not textually include `is_anonymous`; the synthetic no-membership anonymous session returned zero rows.
- `orders` policies include explicit anonymous-session rejection in addition to customer/tenant membership checks.
- `business_subscriptions` has multiple restrictive anonymous-session guards plus active business membership.
- `notifications` and `marketing_leads` use user-ID ownership predicates; both returned zero rows for the synthetic anonymous UUID.
- `businesses` intentionally allows public reads of ACTIVE showcase rows.
- Direct table privilege denial is distinct from RLS denial; tables without authenticated SELECT privilege were excluded from the simulated query and documented as denied at the table ACL layer.

## Result and remaining work

**Checkpoint result: PASS for the limited simulated SELECT checks; security gate remains OPEN / NOT CERTIFIED.**

Still required:
1. Obtain a real anonymous JWT from Supabase Auth in an isolated/restorable environment and repeat reads/writes through the Data API.
2. Compare with a permanent authenticated user lacking membership, a same-tenant member, and users in other tenants/businesses/branches.
3. Exercise INSERT/UPDATE/DELETE paths, including attempts to spoof `user_id`, `tenant_id`, `business_id`, `customer_id`, and role fields.
4. Test service-only tables and intended RPC/Edge paths without widening direct table grants.
5. Preserve public ACTIVE-showcase business reads and other documented public catalog behavior.
6. Continue per-function SECURITY DEFINER ACL/search_path/caller review and rerun Security Advisor after any approved changes.

No production security setting or policy was changed as a result of this checkpoint.
