# S04 — Migration Chain & Clean Replay Report

**Audit date:** 2026-10-13  
**Repository:** `islamnagy2022-eng/MantiqaTiX`  
**PR:** [#218](https://github.com/islamnagy2022-eng/MantiqaTiX/pull/218) — open, Draft, unmerged  
**Supabase project:** `moyhiluyhjsujhwlyeuu`  
**Status:** `BLOCKED / NOT CERTIFIED`

## 1. Production ledger — read-only verification

A fresh read-only query of `supabase_migrations.schema_migrations` returned **283 rows**, first version `20260808000000`, latest version `20261008222845`. The latest entry remains `rc424_atomic_digital_page_payment_webhook`.

The candidate RC425–RC441, RC449, RC462, RC522, and RC523 migrations are **not proven applied**. The queried target versions were absent from the live ledger. No production migration, schema, data, permission, or migration-ledger write was performed.

A separate read-only ledger search found the same first-migration name under live version `20260927074210 / harden_smm_table_api_privileges`, while the repository filename is `20260927074200_harden_smm_table_api_privileges.sql` (10-second version mismatch). The source contains only privilege revocations; it does not create `public.smm_provider_credentials`. The table exists in the live schema, but no ledger statement returned by the exact-name search records its creation. Treat this as an unresolved baseline/source-identity gap; do not rewrite the live ledger version.

## 2. Source inventory and ordering

The PR branch contains **160 SQL files** in `supabase/migrations/` and **33** in `supabase/recovered-migrations/`. The source-chain preflight reported **193 total files**, **187 unique 14-digit versions**, and **five duplicate-version groups**. All 20 explicit required sources (RC425–RC432, RC434–RC441, RC449, RC462, RC522, RC523) were present in the preflight. RC433 has no matching source; confirm from authoritative evidence whether RC433 was ever a defined migration. Absence alone does not establish a missing applied migration.

The five duplicate-version groups are a chain-integrity blocker because Supabase uses the first 14 filename digits as the migration version:

| Duplicate version | Conflicting source filenames |
|---|---|
| `20260928020000` | `20260928020000_rc101_g6_rls_permissive_policy_hardening.sql`; `20260928020000_rc102_g8_crm_notification_support_rls_hardening.sql` |
| `20260928060000` | `20260928060000_rc109_harden_order_support_tenant_boundaries.sql`; `20260928060000_restore_registration_request_dml_grants.sql` |
| `20260928190000` | `20260928190000_rc162_mantigo_trip_state_machine.sql`; `20260928190000_rc200_cross_tenant_customer_payment_authorization.sql` |
| `20260928200000` | `20260928200000_rc164_mantigo_direct_delete_lockdown.sql`; `20260928200000_rc164_retire_legacy_mantigo_mutator.sql`; `20260928200000_rc206_geographic_ad_targeting_and_nearest_fallback.sql` |
| `20260928210000` | `20260928210000_rc172_restore_medical_booking_contract.sql`; `20260928210000_rc207_official_global_mnty_cover_ads.sql` |

Do not resolve these collisions by changing production history or arbitrarily renaming files. Establish intended ordering and reconcile source/ledger semantics first, then make a reviewed correction on the source branch.

## 3. Requested migrations — dependency and precondition review

| Migration | Source/order observation | Dependency or replay precondition |
|---|---|---|
| RC425 | Present at `20261009120000` | Uses MantiGO provider-event/financial-ledger tables, notifications, and `process_verified_mantigo_payment_backend`; those objects must exist before replay. |
| RC426 | Present at `20261009130000` | Replaces digital-page payment-intent finalization and references `digital_page_orders`; existing function/table signature must match. |
| RC427 | Present at `20261009140000` | Adds an active-intent uniqueness rule over `payment_intents`; existing duplicate active intents intentionally block application. |
| RC428 | Present at `20261009150000` | Replaces provider-payment failure RPC; depends on `payment_intents`, `orders`, and `payment_provider_events`. |
| RC429 | Present at `20261009160000` | Replaces subscription-payment failure RPC; depends on subscription intents, provider events, and businesses. |
| RC430 | Present at `20261009170000` | Replaces subscription-payment success RPC; depends on subscription intents, subscriptions, memberships, businesses, and the legal assertion contract. |
| RC431 | Present at `20261009180000` | Hardens existing digital-page payment RPC/event objects; compare with the preceding RC424 function definition, not as standalone. |
| RC432 | Present at `20261009190000` | Depends on SMM wallet tables/functions and aborts on conflicting legacy debit/refund/credit references. |
| RC434 | Present at `20261009200000` | Depends on ERP purchase, warehouse, receipt, stock, inventory, membership, business, and catalog objects. Its header flags missing purchase-order line modeling; RC437 appears later in timestamp order. |
| RC435 | Present at `20261009210000` | Alters subscription intent state and creates claim RPCs; requires the existing subscription-intent schema and related pricing/membership objects. |
| RC436 | Present at `20261009220000` | Depends on the financial journal, chart-of-accounts, general-ledger, membership, and business schemas. |
| RC437 | Present at `20261009230000` | Adds purchase-order lines and line-aware receiving; existing purchase orders/catalog/ERP receipt contracts must match. |
| RC438 | Present at `20261009240000` | Explicitly depends on RC437's line schema and line-aware receiving wrapper; timestamp ordering is correct. |
| RC439 | Present at `20261010010000` | Adds encrypted checkout recovery columns to `subscription_payment_intents`; requires the RC435-era intent table. |
| RC440 | Present at `20261010020000` | Updates search paths for matching exposed SECURITY DEFINER functions; test target selection against actual grants and function metadata. |
| RC441 | Present at `20261010030000` | Adds MantiGO platform-admin scoping and replaces several RPCs; depends on memberships, rides, ledger, audit logs, notifications, and settlement/journal contracts. |
| RC449 | Present at `20261010170000` | Substantially overlaps RC441's function set. Keep both immutable during audit; establish their intended semantic relationship and prerequisite availability before full replay. |
| RC462 | Present at `20261012040000` | Forward correction to `mnty_can_platform_admin()`; requires RC441/RC449 to have defined the function and `user_memberships` to exist. |
| RC522 | Present at `20261013190000` | Alters privileges on `audit_logs`; table and intended owner/application-role grants must be present. |
| RC523 | Present at `20261013200000` | Replaces the MantiGO financial report RPC; requires the platform-admin guard and canonical `mantigo_financial_ledger` columns. Focused fixtures do not prove full-chain compatibility. |

This is a source-level dependency review, not a successful replay result. Exact dependency validity remains **NOT VERIFIED** until the actual SQL executes in chronological order.

## 4. Clean replay execution and first failure

### Actual disposable Supabase startup/replay attempt

Run [38336871463](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38336871463), tested merge commit `c9f960f4745054ff0f3348a2b938623581aea812`, initialized a disposable local Supabase stack. Supabase CLI began applying migrations during `supabase start`, then stopped at the **first migration in the directory**:

- **First failed migration:** `20260927074200_harden_smm_table_api_privileges.sql`
- **SQLSTATE:** `42P01` (`undefined_table`)
- **First error:** `relation "public.smm_provider_credentials" does not exist`
- **Failing operation:** revoking `REFERENCES, TRIGGER, TRUNCATE` on `public.smm_provider_credentials` from `anon, authenticated`
- **Replay status:** `FAIL_BLOCKED`; later migrations were not applied in this disposable attempt.

This demonstrates a missing prerequisite in the clean source chain: the first executable migration assumes `public.smm_provider_credentials` already exists, but the clean local database does not have it. The source inventory starts at this migration and does not contain the earlier table-creation baseline needed to make this chain self-contained. Do not bypass the failed migration or create an unreviewed production-history workaround.

The evidence artifact is [s04-clean-replay-evidence](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38336871463/artifacts/11784793144).

### Independent source-chain preflight

A separate disposable PostgreSQL 16 source-preflight run [38336927669](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38336927669) also returned `STATUS=BLOCKED`, `STAGE=SOURCE_PREFLIGHT`; SQL replay was not started by that job. Its artifact confirms five duplicate-version groups, zero invalid filename formats, zero missing explicit required sources, and zero conflicting duplicate file copies. This is independent evidence of the additional version-collision blocker.

The S04 workflow was updated to extract the first migration/error from the Supabase startup log. Follow-up run [38337145926](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38337145926) completed on PR head `b62b7f2104cc3be0ef5602f3cf08bb71090f6cd8` (merge-test SHA `c25042494575427f4d997e1aa17001af6506fc86`): source audit failed closed on the five version collisions, and the disposable Supabase startup/replay attempt reported the first failed migration and SQLSTATE shown above.

## 5. Recovered migrations and semantic discrepancies

Files under `supabase/recovered-migrations/` are archival candidates, not an executable migration directory. Their existence is not proof of application.

A read-only comparison of all **33** recovered archive files against the live migration ledger found **33/33 exact filename-version/name matches**. SQL content comparison found **22/33 byte-for-byte matches**; the remaining **11/33** matched after normalization that removes SQL comments and statement delimiters and normalizes formatting. This supports archival content correspondence, but does not make these files executable migrations or prove any unapplied migration is safe to replay. The separate source-chain preflight found no duplicate file copies between the executable and recovered directories.

The existing semantic reconciliation record documents unresolved source-versus-ledger differences for RC169, RC172, RC199, RC206, and RC207. In particular, RC199 may create a policy already introduced by a later ledger statement when replayed in repository filename order, and the RC207 repository source omits a function replacement present in the recorded ledger statement. These discrepancies prevent claiming a production-equivalent rebuild.

## 6. Files changed by S04

- `scripts/audit-migration-chain-s04.mjs` — filename format, global version uniqueness, required source presence, recovered archive count, and SHA-256 inventory for target migrations.
- `.github/workflows/s04-migration-chain-clean-replay.yml` — isolated replay attempt, first-error extraction, and evidence artifact.
- `docs/release/s04-migration-chain-clean-replay-report.md` — independent report.

No changes were made to `.github/workflows/mantigo-platform-admin-scope.yml` or S02 administrative-function tests.

## 7. Safety and closure

- Production writes/migrations: **NONE**
- Applied migration history rewritten: **NO**
- PR merged / deployment performed: **NO**
- Full chronological clean replay: **BLOCKED at the first migration**
- First failure: **missing `public.smm_provider_credentials` at `20260927074200_harden_smm_table_api_privileges.sql`**
- Additional chain blocker: **five duplicate migration-version groups**
- Release status: **BLOCKED / NOT CERTIFIED**

Closure requires restoring/reconciling the missing earlier baseline source, globally unique migration versions, resolution of source/ledger semantic discrepancies, successful chronological replay from a disposable empty environment, and exact-head CI evidence. Do not skip a failed migration or mark this task complete based only on source presence.

## Follow-up evidence — S04 run 159 (2026-10-14)

**Tested head:** `124b60db2b58b72aa6458cb66f8e477a681e691f`  
**Workflow run:** [38499236142](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38499236142)  
**Evidence artifact:** [11865441240](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38499236142/artifacts/11865441240)  
**Job:** `115641970393` — `Disposable Supabase clean replay and source audit`

The follow-up corrected the test-baseline validator and reached local Supabase startup, but the run remains **`FAIL_BLOCKED`**, not a clean replay or release certification:

- `source_audit_exit=0`
- `normalized_version_validation_exit=0`
- `ledger_recovered_source_validation_exit=0`
- `disposable_alias_normalization_exit=0`
- `test_baseline_validation_exit=0`
- `temporary_test_baselines_injected=true` — test-only compatibility fixtures were added to the disposable runner; these are not historical source migrations.
- `supabase_init_exit=0`
- `supabase_start_exit=1`
- `clean_replay_exit=FAILED_DURING_SUPABASE_START`
- `first_failure=Applying migration 20260927095000_revoke_unused_security_definer_execute.sql...`
- `first_error=ERROR: function public.counter_offer_indrive_bid(uuid, uuid, numeric) does not exist (SQLSTATE 42883)`
- `status=FAIL_BLOCKED`

A separate read-only check of the live production catalog confirmed that `public.counter_offer_indrive_bid(uuid,uuid,numeric)` exists there as a SECURITY DEFINER function owned by `postgres`. A read-only scan of the live migration ledger's stored statement arrays returned **zero matches** for that function name. This establishes a source-history gap between the current repository replay chain and the live database; it does not identify the authentic original function body or authorize synthesizing one. The other nine function names referenced by this revocation migration are present in ledger statements, but their earlier authoritative source files still need full-chain reconciliation.

**Disposition:** do not weaken or make the revocation migration conditional merely to pass replay; that could hide a missing historical prerequisite. Recover the authentic creation source for `counter_offer_indrive_bid` from trusted history/backup or establish the correct historical baseline, then rerun the disposable chronological replay. Keep production read-only, and do not merge or certify release based on this run.

### Read-only production catalog evidence — missing replay prerequisite

A subsequent read-only catalog query confirmed the current production definition and its access boundary:

- Signature: `public.counter_offer_indrive_bid(uuid,uuid,numeric)`
- Definition fingerprint: `md5(pg_get_functiondef(...)) = b0032d51962bddf93a74a679e8449644`
- Owner: `postgres`; `SECURITY DEFINER`; function-level `search_path=public`
- ACL inspection: `anon` and `authenticated` cannot execute it; the recorded ACL is `postgres=X/postgres`.
- The inspected body checks for a non-null, non-anonymous authenticated UID, validates nonnegative price, and updates only a bid attached to the supplied request when the request belongs to that UID and is not completed/cancelled.
- A read-only search of all stored statement elements in `supabase_migrations.schema_migrations` returned **zero matches** for `counter_offer_indrive_bid`. A repository source search likewise did not identify its creation in the current tracked migration sources; the nearby `20261007021500_reverse_bidding_server_authority_v1.sql` defines the backend request/bid creation RPCs, not this counter-offer RPC.

**Interpretation:** the live function definition is useful forensic evidence of the current deployed behavior, but it is not proof of the original migration, creation time, or intended historical source. Do not copy it into an invented historical migration or alter the revocation migration to conceal the gap. Recover a trusted source/backup or document an explicitly reviewed forward baseline strategy in a separate decision before any code change. No production writes were made by these queries.

### S04 run 160 — repeatable failure confirmation

**Run:** [38499702486](https://github.com/islamnagy2022-eng/MantiQaTix/actions/runs/38499702486)  
**Tested commit:** `f09fef2dc50b70d72373eb20a5f4dea0101f7fcf`  
**Artifact:** [11865107597](https://github.com/islamnagy2022-eng/MantiQaTix/actions/runs/38499702486/artifacts/11865107597)

This run independently repeated the same first blocker after the validator fix:

- Source audit, normalized-version validation, recovered-source validation, disposable alias normalization, and test-baseline validation all returned `0`.
- Supabase local initialization returned `0`; startup returned `1`.
- First failing migration: `20260927095000_revoke_unused_security_definer_execute.sql`.
- First error: `function public.counter_offer_indrive_bid(uuid, uuid, numeric) does not exist (SQLSTATE 42883)`.
- Result: `FAIL_BLOCKED`; no chronological full-chain replay completed.

This repeat confirms the failure is reproducible with the current source chain, not a one-off baseline-validator error. The production catalog evidence recorded above is from read-only queries and does not establish the historical source file. The next safe action remains source recovery/reconciliation, not a conditional revoke or an invented migration. Production remains unchanged and release remains uncertified.



## Follow-up — bounded source-history search and forward-baseline decision record (2026-10-14)

A further bounded source-history search was performed after the repeatable run-160 blocker:
- GitHub indexed commit searches for `counter_offer_indrive_bid` and `counter offer indrive` returned no matches.
- Current indexed repository code search returned only the revocation migration reference, not a creation definition.
- Seven related InDrive/reverse-bidding migration files across candidate PR branches were fetched and inspected; none defined the missing function.
- This is not proof that an authoritative backup or unreachable Git object does not exist.

A proposal-only decision record was added at
`docs/release/counter-offer-rpc-forward-baseline-decision.md`. It prefers recovery of authentic historical source; a forward-baseline strategy is only a fallback proposal requiring explicit review. It does not authorize migration code or production changes.

**No code migration was created. No production change was made. No clean replay was completed. Release remains BLOCKED / NOT CERTIFIED.**


## Follow-up — S04 run 168 on exact PR head (2026-10-14)

**Run:** [38500724335](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38500724335)  
**Tested commit:** `5b01aede91340bd9281dda97da6ebc46d45bdfcc`  
**Evidence artifact:** [11865404343](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38500724335/artifacts/11865404343)  
**Result:** `FAIL_BLOCKED` — not a clean replay.

Observed from the completed job logs:

- Source audit, normalized-version validation, recovered-source validation, disposable alias normalization, and test-baseline validation all returned `0`.
- Test-only provider-onboarding and SMM baselines were injected; the workflow explicitly records these as catalog-derived fixtures, not historical DDL.
- `supabase_init_exit=0`; `supabase_start_exit=1`.
- First failing migration: `20260927095000_revoke_unused_security_definer_execute.sql`.
- First error: `ERROR: function public.counter_offer_indrive_bid(uuid, uuid, numeric) does not exist (SQLSTATE 42883)`.
- The artifact SHA-256 reported by GitHub is `e5ba5108e4bde3f708b4767bfdd43e1c1d682856e4c7d6d25c8a9f4da1074930`.

This third reproducible stop confirms the blocker remains after the prior validator correction. It does not provide the missing RPC source, and test-only baselines do not satisfy clean replay. Do not alter the revoke migration to be conditional, synthesize the function body, or apply any production change. Continue with authenticated historical-source recovery or an explicitly reviewed forward-baseline decision.

At this same PR head, the focused recovered-migration integration workflow completed successfully, as did the listed approval atomicity, SMM service-role boundary, backend-only boundary, audit-log append-only ACL, migration uniqueness/immutability/collision, MantiGO platform-admin/privacy, and module validation workflows. The web validation job succeeded but the deploy job was skipped. These scoped CI results do not override S04 failure or certify production readiness.

**Production remains read-only. Release remains BLOCKED / NOT CERTIFIED.**


## Follow-up — S04 run 38501518479 on latest documented PR head — 2026-10-14

**Run:** [38501518479](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38501518479)  
**Evidence artifact:** [11866516003](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38501518479/artifacts/11866516003)  
**Result:** `FAIL_BLOCKED`; this workflow is explicitly named “Not Clean Replay”.

The completed job log confirms:

- `source_audit_exit=0`
- `normalized_version_validation_exit=0`
- `ledger_recovered_source_validation_exit=0`
- `disposable_alias_normalization_exit=0`
- `test_baseline_validation_exit=0`
- Temporary provider-onboarding and SMM baselines were injected; they are test-only fixtures, not historical DDL.
- `supabase_init_exit=0`; `supabase_start_exit=1`.
- First failure remains `20260927095000_revoke_unused_security_definer_execute.sql`.
- First error remains `function public.counter_offer_indrive_bid(uuid, uuid, numeric) does not exist (SQLSTATE 42883)`.

This follow-up reproduces the same blocker after preflight succeeds. It is not evidence of clean replay. Preserve the fail-closed decision: do not fabricate the missing function, alter the revoke to be conditional, or change production. Continue trusted-source recovery or request explicit review of the documented forward-baseline proposal.

At the latest checked head `5a14e6484e97bf8a412de635b25949afc8490ae9`, the other reported PR checks completed successfully in their scoped areas; web validation succeeded and deployment was skipped. These do not override the S04 failure.

**Release remains BLOCKED / NOT CERTIFIED. No production changes were made.**
