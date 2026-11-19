# RC464B Orders Policy Preflight Port — 2026-11-19

**Disposition:** source-only, read-only policy preflight; Production NOT modified.

## Why this was ported

Open PR #828 contained a useful fail-closed preflight for the exact legacy permissive SELECT policy sets consumed by RC465. Its base was 21 commits behind and 20 commits ahead of the current main at review time, and its exact-head checks did not include the RC465 policy-preflight PostgreSQL workflow. It was therefore not merged as-is. The narrow migration/test change was ported onto current main in a fresh branch so the actual current-base workflow can validate it.

## Change set

- Adds `20261113220000_rc464b_orders_select_policy_preflight.sql` between RC464 and RC465. It opens a transaction and only inspects table existence, RLS state, authenticated SELECT grants, and exact permissive SELECT/ALL policy sets. It performs no DDL/DML/GRANT/REVOKE.
- Adds disposable negative fixtures for unexpected permissive SELECT policies on `orders` and `order_status_history`; the preflight must fail before RC465 runs.
- Runs the focused PostgreSQL workflow on PostgreSQL 17, matching Production.
- Extends the RC465 static validator, the ordered release migration contract, production verifier, migration-chain gate and reconciliation manifest from 62 to 63 exact source versions.

## Static pre-PR checks

- Manifest JSON parses.
- Required and missing version arrays each contain exactly 63 entries; RC464B appears once in each.
- The live reconciliation contract, production verifier and migration-chain gate all include RC464B.
- The migration-chain gate expects 63 required sources.
- The RC465 workflow uses PostgreSQL 17 and runs the read-only preflight before immutable RC465.
- The validator asserts both order-policy and history-policy drift rejection.

## Safety

- The preflight is not an instruction to run it against Production independently.
- No Production migration, SQL/DDL/DML, RLS, GRANT, Auth, Edge, payment, wallet or settlement operation was performed.
- This PR adds a source migration requirement, so the required release manifest count increases from 62 to 63. Live ledger state remains the previously verified 310 rows through `20261110150618`; the added migration is not applied.
- Production release remains **BLOCKED / NOT CERTIFIED** pending the full chronological migration reconciliation, encrypted backup, isolated restore rehearsal, rollback plan and explicit release authorization.


## Current-main port — 2026-11-19

The source-only change was re-applied to current main after the earlier PR branch diverged. Current base at port creation: `d170501cdd52db4584bb76359da2153d640cbaf9` (includes the merged directory-consent release gate and explicit public Edge JWT configuration). Current PR: #849, latest source head `467f17f96763dbd735c320577f9c097d12143add` (after the current-main port and additional read-only contract assertions).

The refreshed release contract preserves the directory-consent certification predicate and now requires 63 unique, timestamp-ordered migration source versions, including RC464B. The live ledger remains 310 rows through `20261110150618`; no required source IDs are recorded. Exact-head CI for PR #849 is pending. No Production operation was performed.


## Read-only Production policy preflight evidence — 2026-11-19

A fresh read-only catalog query was run against Production after the current-main port:

- `public.orders`: RLS enabled; authenticated SELECT grant present; exactly three permissive SELECT policies: `orders_member_select`, `orders_provider_select_own_business`, `orders_customer_select_own`; all target `authenticated`.
- `public.order_status_history`: RLS enabled; authenticated SELECT grant present; exactly two permissive SELECT policies: `order_status_history_member_read`, `order_status_history_customer_select_own`; all target `authenticated`.
- Required `orders`, `order_status_history`, and `user_memberships` columns used by RC465 exist, including business_id and branch_id on orders/history/memberships, and role/status/user_id on memberships.
- No unexpected permissive SELECT/ALL policy was returned for either table. The catalog counts, names, role arrays, RLS flags and SELECT grants match the RC464B preflight predicates.

The current live policy expressions still use the older tenant-wide membership predicates; this read-only check does not prove RC465's new business/branch policy behavior. RC465's PostgreSQL 17 behavioral tests must pass before any coordinated production release. RC464B and RC465 have **not** been applied to Production.
