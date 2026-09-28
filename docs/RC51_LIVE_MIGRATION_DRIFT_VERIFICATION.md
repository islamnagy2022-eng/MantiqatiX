# RC51 — Live Migration Drift Verification

Date: 2026-09-28
Project: moyhiluyhjsujhwlyeuu

## Verified live state

Supabase live migration history currently contains **150 migration records**.

The latest live records include:
- 20260927140200_lock_platform_admins_rls
- 20260927140545_remove_anonymous_sensitive_policy_access_v2

## Tracked GitHub state

The tracked migration directory currently contains **8 SQL files**.

The corresponding filenames in GitHub include:
- 20260927140202_lock_platform_admins_rls.sql
- 20260927140500_remove_anonymous_sensitive_policy_access_v2.sql

These version/name differences are not treated as equivalent.

## ERP/SMM reconciliation

The live migration history contains production-only migrations for:
- ERP inventory/stock transfer authority
- ERP purchase receipts and purchase receiving
- ERP purchase order authority
- SMM API privilege hardening
- MNTY platform administration and registration review

The current tracked migration tree does not contain the complete SQL history for those live migrations.

## Security decision

No production migration was reconstructed or reapplied from migration names.
No speculative RLS policy was added to the seven Advisor tables.
No blanket FORCE RLS change was performed.

## Release consequence

Migration convergence remains a controlled production blocker until authoritative SQL/history can be recovered and reconciled with the tracked source.

This checkpoint supersedes assumptions that the GitHub migration directory is a complete reproducible representation of the current Production database.
