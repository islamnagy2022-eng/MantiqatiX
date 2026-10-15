# S04 Replay Failure Triage — 2026-10-14

**Status: BLOCKED / NOT CERTIFIED**  
**Scope:** Evidence reconciliation only. No production mutation, migration, grant, Auth change, or deployment was performed.

## Newly retrieved CI evidence

### A. Pure disposable replay after filename normalization

Run: [S04 Migration Chain Clean Replay #38401984931](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38401984931)  
Tested merge checkout: `aec04dc88d83a6b67db9963409096bfc5eb4cf4a`  
Artifact: [S04 replay evidence](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38401984931/artifacts/11816111786)

The artifact confirms:
- 11 duplicate-version filename mappings completed in the disposable checkout.
- SHA-256 was preserved for every renamed SQL file.
- Source audit passed with 160 normalized migration files and zero duplicate version groups.
- Supabase initialization succeeded.
- Supabase startup began applying migrations and failed at `20260927074200_harden_smm_table_api_privileges.sql` because `public.smm_provider_credentials` did not exist (SQLSTATE `42P01`).
- Therefore this run did **not** reach a complete chronological replay.

This is a migration dependency/source-baseline failure, not evidence that the Supabase CLI or Docker stack failed to initialize.

### B. Replay attempt with temporary test-only baselines

Run: [S04 Migration Replay with Test-Only Baselines #38502452148](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38502452148)  
Tested head: `d33c3d86a65841beedf0ffb35cceb59dd2a62af8`

This distinct run injected temporary test-only fixtures and progressed farther, but failed at `20260927095000_revoke_unused_security_definer_execute.sql` because `public.counter_offer_indrive_bid(uuid, uuid, numeric)` did not exist (SQLSTATE `42883`). The run explicitly reports that the function baseline was not recovered historical DDL. It is not a clean replay and must not be represented as one.

## Read-only production ledger cross-check

The live Supabase migration ledger contains:
- `20260927074210 / harden_smm_table_api_privileges`
- `20260927095000 / revoke_unused_security_definer_execute`

The repository source file for the SMM hardening migration currently begins with version `20260927074200`, which differs from the live ledger version. The stored statement for the applied `20260927074210` row contains the two REVOKE statements against `smm_provider_credentials` and `smm_providers`; it does not provide the missing table-creation DDL. A read-only scan of stored migration statements for the named CREATE TABLE dependencies did not locate a canonical creation statement for `smm_provider_credentials`, `credit_accounts`, `credit_periods`, or `marketing_project_participants`.

Repository search found `smm_provider_credentials` creation in `supabase/tests/rc456_smm_service_role_fixture.sql`, whose header explicitly identifies it as a disposable fixture and says it does not synthesize the missing historical baseline. It must not be promoted into a production migration or treated as recovered history.

## Required next action

1. Recover the authentic historical creation source for `smm_provider_credentials` and the other missing dependencies from a trusted repository commit, approved backup, or authoritative deployment artifact.
2. Reconcile the `20260927074200` source filename versus the live ledger's `20260927074210` version through documented evidence. Do not rename or rewrite the applied migration in the repository merely to suppress a replay collision.
3. Keep any explicitly approved test-only fixtures confined to disposable CI and visibly label those runs as non-clean replay.
4. Rerun a true empty-database chronological replay after source provenance and ordering are reconciled. Then address the next actual first failure, if any.
5. Keep production blocked until the full replay and independent release/security gates pass.

**No production changes were made. No migration was applied. No missing historical SQL was invented.**


## New read-only source-versus-ledger SQL comparison — 2026-10-14

The live stored statements were compared against the source files on `fix/s04-replay-normalization-20261013` after whitespace normalization. This comparison was read-only and did not execute any migration.

| Applied ledger version/name | Source file on recovery branch | Source chars | Stored ledger SQL chars | Normalized text match |
|---|---|---:|---:|---|
| `20260928131753 / rc172_restore_medical_booking_contract` | `20260928210000_rc172_restore_medical_booking_contract.sql` | 5,528 | 5,746 | No |
| `20260928161513 / rc206_geographic_ad_targeting_and_nearest_fallback` | `20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql` | 5,323 | 5,646 | No |
| `20260928174954 / rc207_official_global_mnty_cover_ads` | `20260928210000_rc207_official_global_mnty_cover_ads.sql` | 3,607 | 7,056 | No |
| `20260928154527 / rc200_cross_tenant_customer_payment_authorization` | `20260928190000_rc200_cross_tenant_customer_payment_authorization.sql` | 4,000 | 3,987 | No |

The RC206 stored SQL starts with `-- MNTY geographic advertisement targeting + nearest fallback`, whereas the source starts with a longer RC206 description; later content also differs. RC207 has a particularly large stored/source length gap (7,056 vs 3,607 characters), so this must be treated as a substantive reconciliation task rather than a filename-only normalization. RC172 also differs after whitespace normalization. RC200's first normalized difference is the source header comments, so its length delta alone does not establish a semantic difference; compare executable tokens before deciding whether that entry is materially divergent.

These measurements are triage evidence, not a semantic proof or permission to replace applied history. Before any clean replay is certified, produce a reviewed token/statement diff for each mismatch, identify the exact authoritative source or approved reconciliation, and test the result in a fresh disposable database. Do not rename applied migrations, overwrite the stored ledger, or copy the live SQL into historical migration files without explicit review. The original missing-dependency blockers (including `counter_offer_indrive_bid`, `smm_provider_credentials`, credit tables, and `marketing_project_participants`) remain separate and unresolved.

No production schema, ledger, data, grants, Auth settings, Edge Functions, or financial records were changed.
