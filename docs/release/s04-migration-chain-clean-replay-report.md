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

## 2A. Full live-ledger name-stem reconciliation inventory

A separate read-only inventory was generated from all 283 current Supabase ledger rows and the 193 SQL files in the two repository directories. It strips only the leading 14-digit filename prefix and `.sql` suffix to identify candidate name matches; it does not claim content equivalence.

- **131/283** ledger rows have a candidate source with the same name stem.
- **152/283** ledger rows have no same-name-stem source candidate in either inspected directory.
- **62** source files have no same-name-stem ledger entry.
- **49** ledger rows exactly match a source filename's leading 14-digit version.
- The known RC424 alias has ledger version `20261008222845` but source prefix `20261009010000`; retain the earlier exact-statement comparison as distinct evidence.

Machine-readable details (all candidate matches, unmatched rows, source-only stems, and collision groups): [S04 migration ledger name inventory](S04_MIGRATION_LEDGER_NAME_INVENTORY_20261013.json).

These counts are discovery indicators only. In particular, the 152 unmatched ledger rows must not be labeled “not applied”; they remain source-recovery/alias-reconciliation work. This inventory makes clear that a full production-equivalent replay cannot be certified from filename counts or current source presence.

## 2B. RC40 source archive reconciliation

The uploaded `source_RC40.zip` was inspected as a separate historical source candidate. Its companion checksum file matches the archive exactly: SHA-256 `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`.

- Archive contains **39** SQL migration files.
- **12** filenames overlap with `supabase/recovered-migrations/`; SHA-256 comparison found **0 exact content matches** and **12 content mismatches**.
- **27** archive migration filenames are absent from both current migration directories.
- The archive itself has a duplicate timestamp group: five files share `20260920130000`.
- The archive contains `20260920185000_production_credit_control.sql`, which defines `credit_policies`, `credit_accounts`, and `credit_periods`; those tables are present in the live catalog. However, that exact version/name is not in the live ledger. It is a **source candidate only**, not proof of production application and not authorization to reorder or insert it into executable history.
- The archive contains no `CREATE TABLE` migration for `smm_providers` or `smm_provider_credentials`; it does not resolve the first S04 replay failure.

Row-level hashes and missing filenames are recorded in [S04 RC40 archive reconciliation](S04_RC40_ARCHIVE_RECONCILIATION_20261013.json). Do not overlay the RC40 archive onto the current recovered directory: all 12 same-name SQL files differ in content, and the archive has its own timestamp collision.

### RC40 credit-control candidate is not a safe baseline

A read-only query of the production ledger found only `20260920155456 / harden_credit_status_authorization` for the credit-related name search. Its recorded statement is 2,248 bytes with MD5 `82af7a802839a630d5dc4201ce3ce8a1`. The RC40 archive's `20260920190000_harden_credit_status_authorization.sql` is 2,335 bytes with MD5 `9161bd24cfc0c49b1249c00deac33be9`; the statements are **not byte-identical**.

The RC40 `20260920185000_production_credit_control.sql` is also absent from the production ledger at that version/name, and its schema defaults/types differ from the live catalog:

| Field | Live catalog | RC40 archive candidate |
|---|---|---|
| `credit_policies.credit_limit` | `numeric default 0` | `numeric(14,2) default 0` |
| `credit_policies.grace_days` | `integer default 0` | `integer default 7` |
| `credit_policies.suspend_after_days` | `integer default 15` | `integer default 30` |
| `credit_policies.block_new_credit` | `boolean default true` | `boolean default false` |
| Credit account/period amounts | `numeric default 0` | `numeric(14,2) default 0` |

Therefore RC40 is useful evidence of a possible historical implementation, but it is **not** an exact live-schema baseline and cannot safely be injected into the replay to get past the missing credit tables. The existing historical-schema preflight correctly blocks on this unresolved dependency. No credit baseline was synthesized or applied.

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

The S04 workflow was updated to extract the first migration/error from the Supabase startup log, not mislabel a migration failure as a generic startup failure. Its follow-up exact-head run should be treated as pending until completed.

## 5. Recovered migrations and semantic discrepancies

Files under `supabase/recovered-migrations/` are archival candidates, not an executable migration directory. Their existence is not proof of application.

A read-only comparison of all **33** recovered archive files against the live migration ledger found **33/33 exact filename-version/name matches**. SQL content comparison found **22/33 byte-for-byte matches**; the remaining **11/33** matched after normalization that removes SQL comments and statement delimiters and normalizes formatting. This supports archival content correspondence, but does not make these files executable migrations or prove any unapplied migration is safe to replay. The separate source-chain preflight found no duplicate file copies between the executable and recovered directories.

The existing semantic reconciliation record documents unresolved source-versus-ledger differences for RC169, RC172, RC199, RC206, and RC207. In particular, RC199 may create a policy already introduced by a later ledger statement when replayed in repository filename order, and the RC207 repository source omits a function replacement present in the recorded ledger statement. These discrepancies prevent claiming a production-equivalent rebuild.

## 6. Files changed by this S04 continuation branch

- `scripts/audit-migration-chain-s04.mjs` — expanded source audit across both directories; keeps executable migration uniqueness separate from archival inventory, reports invalid names, duplicate executable versions, recovered-only collisions, cross-directory version overlaps, conflicting same-name copies, required RC source presence, and SHA-256 values.
- `.github/workflows/s04-migration-chain-clean-replay.yml` — adds a push trigger limited to this isolated `s04/ledger-reconciliation-20261013` branch so the source audit and disposable replay can be rechecked without merging PR #218.
- `docs/release/S04_MIGRATION_LEDGER_NAME_INVENTORY_20261013.json` — row-level live ledger/source name-stem candidates and unmatched records.
- `docs/release/S04_RC40_ARCHIVE_RECONCILIATION_20261013.json` — checksum-verified RC40 archive inventory, exact filename overlaps, content hashes, missing candidate sources, and credit-control mismatch evidence.
- `docs/release/s04-migration-chain-clean-replay-report.md` — adds ledger name-stem and RC40 archive reconciliation results.
- `docs/SESSION_LOG.md` — append-only execution evidence.

The two JSON reports are read-only evidence. No historical migration SQL or production ledger was rewritten. The branch's updated S04 workflow run [38338010686](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38338010686) was QUEUED at the latest check; no result is claimed for the updated audit script on this branch.

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


## 8. Exact-head CI replay result — 2026-10-13

The isolated S04 workflow completed on tested commit `d8cc0c71f06baeae64221d4cf6a675436d05df5c` (run [38338075186](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38338075186)) with **failure**, not pass. The source audit returned exit code 1 because the executable migration directory still contains the five duplicate version groups listed above. Supabase CLI initialization succeeded, but local stack startup/replay stopped at the first SQL migration:

- First failing migration: `20260927074200_harden_smm_table_api_privileges.sql`
- PostgreSQL error: `relation "public.smm_provider_credentials" does not exist` (`SQLSTATE 42P01`)
- Later migrations were not executed in this run.

The failure matches the earlier authoritative clean-replay finding; it does not establish that any candidate migration was applied in production. Evidence artifact: [S04 run 38338075186](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38338075186).

### SMM schema source leads checked

Repository search found `supabase/tests/rc456_smm_service_role_fixture.sql`, which defines `public.smm_providers` and `public.smm_provider_credentials` for disposable integration testing. Its own header explicitly says it is a test fixture and does not synthesize the missing historical migration baseline. It is therefore useful for schema-shape comparison, but **not** a valid substitute for the authentic historical DDL or a replay prerequisite. No production migration was added or changed to work around the failure.

**Disposition:** S04 remains `BLOCKED / NOT CERTIFIED`. The next valid unblock is authoritative recovery/reconciliation of the historical SMM table-creation source plus reviewed resolution of executable migration-version collisions. Do not skip the failing migration, promote the test fixture into production history, or infer application from current table existence.
