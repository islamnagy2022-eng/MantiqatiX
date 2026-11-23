# Pass 2021–2030 — backup runbook scope and current release-chain reconciliation

**Date:** 2026-11-23  
**Base commit:** `08e84d0b06e8532c76c9f93094659f91233de6ea`  
**Scope:** documentation, source-contract validation and CI wiring only.

## Findings

- The Production backup runbook described the Supabase CLI logical dump as if Auth and Storage database metadata were necessarily present.
- The official Supabase CLI `db dump` reference states that managed schemas including `auth` and `storage` are excluded. A separate official restore guide says `auth.users` is included. Because these official statements are inconsistent, the runbook now requires inspection of the actual generated artifacts and a successful isolated restore before assigning backup coverage to Auth.
- Storage object bytes remain a separate export regardless of database metadata. The updated runbook also requires a separately captured source inventory for `storage.objects`; it must not assume that this metadata appears in the CLI dump.
- The repository's migration replay workflow pins Supabase CLI v2.122.0. The runbook now requires the same tested version and a version check before export, until any CLI upgrade has its own reviewed backup/restore tests.
- The current Production release contract is 78 required migration versions. Merged PR #1013 added RC479 (`20261120193000`) and RC921 (`20261123010000`) to the release gate. The website backlog and backup runbook now use that current count and record that source presence is not evidence of Production application.

## Changes

- Clarified the backup coverage boundary for application schemas, Auth records, Storage metadata and Storage object bytes.
- Added a dump-inspection checkpoint that records schema/table inclusion without exposing PII or secrets.
- Added explicit per-component coverage status to the non-secret backup manifest and conditional Auth restore acceptance.
- Updated the release-gate chain from 76 to 78 versions and identified RC479/RC921.
- Added `scripts/validate-production-backup-runbook-current.mjs` and wired it into the forward migration replay workflow's push and pull-request path filters and validation job.
- Updated the post-launch release backlog to reflect the current 78-version contract.

## Verification and limits

- Latest read-only Production migration inventory: **310 rows**, latest version `20261110150618`.
- Current reconciliation manifest remains **BLOCKED / NOT VERIFIED**; its recorded intersection is 0/78 required identifiers. No migration was applied.
- Current Production is on the Supabase Free plan and PostgreSQL 17.6.1.155 according to the current project audit snapshot.
- This change does not create backup artifacts, export Auth data, export Storage objects, recover Vault keys, restore a database, or measure RPO/RTO. Those remain operator-run P0 gates.
- No Production database, Auth, RLS, GRANT, Storage, Edge Function, payment, wallet, settlement, or customer-data mutation occurred.
- No Production deployment is requested or required by this documentation-only change.

## Source references

- [Supabase CLI db dump reference](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Restore a Platform Project to Self-Hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- Merged release-gate update: [PR #1013](https://github.com/islamnagy2022-eng/MantiqatiX/pull/1013)
