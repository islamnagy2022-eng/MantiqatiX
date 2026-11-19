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
