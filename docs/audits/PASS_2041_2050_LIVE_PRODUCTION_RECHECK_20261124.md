# PASS 2041–2050 — Live Production Recheck — 2026-11-24

**Repository:** `islamnagy2022-eng/MantiqatiX`  
**Main at inspection:** `e86fa555488cf95015d67654d69c6a0f0af8ad2e` (PR #1020 merge)  
**Production Supabase project:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Database:** PostgreSQL 17.6.1.155  
**Overall gate:** **BLOCKED / NOT CERTIFIED**  
**Scope:** read-only GitHub and Supabase inspection; documentation-only follow-up.

## 1. Source and environment reconciliation

- The current application source of truth remains `apps/catalog-frontend/**`; the public Pages root and `/legacy/` rollback route must be preserved. The R7 archive `bizcatalog-manager (11).zip` is a historical reference, not a deployable replacement for current `main`.
- Main now contains RC922 (commit `19c65e716ad440caa0ca314f04bc2d595acb55e2`) and PR #1020 (main commit `e86fa555488cf95015d67654d69c6a0f0af8ad2e`). Older continuity wording that describes RC922 as branch-only is superseded.
- RC922's dedicated PostgreSQL 17 workflow run `45278540531` was inspected directly: its `generate-and-test` job completed successfully, including pinned CLI generation, source validation, RC921/RC922 adversarial behavior, and RC921 concurrency. This is isolated CI evidence only; RC922 is not in the Production ledger.
- The combined status endpoint returned no status records for the latest main commit during this inspection. Do not infer current main CI or deployment success from that empty response.

## 2. Live Production migration state

- Live ledger: **310** rows; latest version `20261110150618`.
- Current repository release contract: **79** exact migration identifiers.
- Fresh SQL comparison against all 79 identifiers: **0/79 present** in the live ledger.
- This is an exact-ledger result, not proof that every intended schema effect is absent; reconcile existing objects, historical aliases, grants, and function bodies before any replay.
- `public.directory_listing_contact_consents` is absent.
- No Production migration, schema, Auth, RLS, GRANT, Storage, Edge, payment, wallet, settlement, or customer-data mutation was performed.

## 3. Platform-root authorization — P0

Read-only live definitions show two distinct legacy paths:

1. `public.is_platform_admin()` is a STABLE invoker SQL function with `search_path=public`; it returns true for any active `user_memberships` row whose role is `ADMIN` or `SUPER_ADMIN`. **57 RLS policies** reference it.
2. `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp`; its body delegates to `public.mnty_can('admin', NULL, NULL, NULL)`. Authenticated callers have EXECUTE, and **5 RLS policies** reference it.

The canonical `private.platform_admins` table exists and contains one row. RLS is enabled, but FORCE RLS is false. Direct SELECT is denied to both `anon` and `authenticated`. Source migrations RC464/RC471 and later registry-backed repairs exist in the repository, but they are not applied to this Production project. Do not patch either helper or its dependent policies in isolation: use the ordered, versioned migration release after backup/restore and exact-schema preflight.


### 3.1 Forward-migration preflight dry-run (read-only)

- RC464 preflight predicates were reproduced with read-only catalog queries and all current dependencies passed: registry RLS enabled; no anon/authenticated SELECT/INSERT/UPDATE/DELETE table grants; registry and helper owner both `postgres` with BYPASSRLS; all four exact SECURITY DEFINER MantiGO RPCs exist; all four exact shared-helper callers exist; and the three expected digital-pages/MantiGO policies are present. Registry FORCE RLS is currently false, which RC464 changes after its preflight.
- RC471 dependency checks passed: the settlement/journal function signature exists, none of its 33 required MantiGO/audit/notification columns is missing, the registry `user_id` column exists, and all four exact helper-dependent SECURITY DEFINER callers are present.
- RC484 preflight predicates also passed: registry RLS and UUID `user_id` column exist; registry/helper owner parity and BYPASSRLS are correct; client table ACLs are clean; exactly 57 dependent policy references across 24 tables were observed. RC484 is the source migration that sets FORCE RLS and replaces `is_platform_admin()` with the registry-backed helper.
- RC485's helper precondition is **not yet ready**: live `is_platform_admin()` is still SECURITY INVOKER, uses `search_path=public`, and does not consult `private.platform_admins`. This is expected until RC484 runs first.
- These are read-only replicas of migration preconditions, not an execution or transactional test of the migrations. Do not apply RC464/RC471/RC484 independently; preserve their dependency order inside the full 79-version, backed-up release. RC485 must follow RC484.

- Historical isolated PostgreSQL CI was independently read back: RC464 platform-admin test job 44803731787 SUCCESS; RC484 registry-backed RLS test job 44598309128 SUCCESS. Both test source migrations in disposable environments, not Production. The older replay job 44598309101 validates a 63-version contract and is not evidence that the current 79-version release chain passes.

## 4. Public directory and consent gate

Fresh aggregate-only Production inventory:

- `public_directory_listings`: **965** rows — 869 PUBLISHED, 87 DRAFT, 9 HIDDEN.
- `directory_source_permission_evidence`: **0** rows.
- `directory_listing_contact_consents`: table absent.
- These database listing statuses are not proof of public-republication rights or owner consent.

The deployed `directory-listings` Edge Function is ACTIVE v18, `verify_jwt=false`, and contains a single-file fail-closed stub. Its GET responds with an empty page and `directoryDisabled=true`; POST returns 503. The current main source after PR #1020 is materially different: it supports a server-flag-gated public read path, uses an explicit field allowlist, removes phone/secondary phone/address/precise map location unless their individual consent scopes are present, discards partial consent pages on lookup failure, and keeps owner claim/consent writes blocked until the consent registry is available. Source-level tests cover these rules.

**Release decision:** keep the deployed v18 fail-closed behavior. Do not deploy or enable the new read path until the source-rights evidence is reviewed and recorded, the consent schema and matching Edge bundle are released in the ordered gate, and deployed-origin positive/negative privacy tests pass. Zero source-permission evidence means PUBLISHED database status cannot be treated as permission for commercial republication.

## 5. Supabase security and performance snapshot

Security Advisor observed 2026-11-24:

- 9 RLS-enabled/no-policy INFO findings.
- 65 authenticated-callable SECURITY DEFINER WARN findings.
- 1 anon-callable SECURITY DEFINER WARN: `get_mnty_targeted_advertisements`. It is the existing public read-only targeted-advertisement RPC and must be reviewed against its source contract; do not blanket-revoke public read capability.
- The 9 no-policy tables have RLS enabled. The inspected `anon`/`authenticated` table SELECT and INSERT privileges were false; these findings are not a reason to invent broad policies.
- Performance Advisor: 28 multiple-permissive-policy WARN findings (targeted policy consolidation only after semantic/RLS tests).
- Health Advisor: no lints.

These are inventory signals, not automatic permission to alter ACLs. Review every SECURITY DEFINER entry point by caller, actor derivation, tenant/business/branch scope, and idempotency before proposing changes.

## 6. Edge deployment inventory

42 Production Edge Functions are ACTIVE. Relevant deployed versions include:

- `directory-listings` v18
- `public-catalog` v9; `public-catalog-directory` v19
- `catalog-admin` v20; `catalog-platform-admin` v23
- `order-create` v8
- `payment-intent` v8; `paymob-webhook` v10
- `subscription-payment-intent` v4; `digital-page-payment-intent` v5
- `financial-journal` v3; `settlement-financial-atomic` v4

Existing release documentation records material drift in multiple payment/order/finance and catalog-admin Edge bundles. Do not deploy individual functions without their matching SQL, ACL, Auth, and webhook contracts.

## 7. Backup, restore, and operator-controlled dependencies

Still **NOT VERIFIED**:

- encrypted off-site Production database backup and independently exported Storage object bytes;
- artifact inventory, checksums, encryption/decryption, and successful retrieval from the off-site target;
- explicit proof of Auth user/session metadata coverage and Vault/key recovery;
- independent restore and rollback rehearsal in disposable PostgreSQL 17;
- measured RPO/RTO and reviewer sign-off.

No connector operation in this pass created or verified these backup artifacts. This dependency requires the project operator's approved backup destination and key-recovery process.


## 9. Unified source-of-truth and R7 archive cross-reference

- The exact owner-supplied operating directive is committed as `docs/MASTER_SOURCE_OF_TRUTH.md`; the authority hierarchy and source classifications are summarized in `docs/SOURCE_OF_TRUTH_MAP_20261124.md`. Historical TODO/continuity/session/audit files remain evidence and append-only history, not competing operating instructions.
- The uploaded R7 ZIP SHA-256 is `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`, matching the previously reviewed artifact in `docs/audits/PASS_1460_1469_R7_ARCHIVE_SECURITY_REVIEW_20261120.md` and `docs/audits/R7_ARCHIVE_SECURITY_REVALIDATION_20261119.md`. Reuse those detailed forensic findings; do not re-run or copy the R7 server/auth/local-JSON/finance implementation.
- R7's own 2026-11-10 release report and 100%/VERIFIED labels are not current production evidence. The archive's dual-authoritative local JSON + Supabase design conflicts with the controlling directive; it remains selective UI/assets reference only. Keep its Android files preserved as reference, not a certified native build.
- One current Advisor anonymous SECURITY DEFINER finding, `public.get_mnty_targeted_advertisements(...)`, was reviewed live: it uses empty `search_path`, schema-qualified relations, returns only seven public ad fields, filters to ACTIVE/APPROVED/in-window ads, targets active Egyptian geo areas, deduplicates to the best location match, and clamps result count to 1–50. Existing mainline documents RC257/RC335/RC381/RC451 define this as the intentional public advertisement-read boundary. Do not revoke anon EXECUTE blindly; preserve the explicit output contract and continue adversarial tests for unsafe URL/content handling.

## 10. Work performed and next sequence

**Completed in this pass:** read-only repository/source review, live Production project identification, migration ledger comparison (0/79), Edge version inventory, aggregate directory/consent inventory, focused P0 platform-admin function/policy inspection, and Supabase Advisor review. RC922 CI run was independently read back as successful.

**Not performed:** no runtime code edit, no migration, no Edge deployment, no Auth/RLS/GRANT mutation, no publication, no financial operation, and no Pages deployment.

**Next ordered work:**

1. Obtain operator-owned encrypted database + Storage exports, validate checksums/retrieval and Auth/Vault coverage.
2. Restore the artifacts into a disposable PostgreSQL 17 environment; exercise rollback and record measured RPO/RTO.
3. Reconcile all 79 migration identifiers against physical schema, function definitions, policies, grants, and historical aliases; run the full 79-version forward replay.
4. Release registry-backed platform-admin repairs and directory consent/schema changes only as coordinated, reviewed bundles with adversarial PostgreSQL/JWT tests.
5. Bring the exact dependent Edge bundles into parity, then run deployed-origin privacy, authorization, and payment/webhook tests.
6. Keep directory public discovery gated until source-republication permissions are evidenced; keep Li2Lak Paymob/payment expansion, wallets, settlements, and accounting deferred until their independent server-side contracts pass.

**Closeout:** documentation candidate only; no production change. **FULL PLATFORM: BLOCKED / NOT CERTIFIED.**

## 11. Post-merge continuation — PR #1023 and PR #1021

**Current main:** `be7989b0587d96d5418c9446042c60dcd4e32158`.

- PR #1023 merged as `5ef35e5f9b0d90e05cf3e76558f614c63e194b8a`. The current-main public directory handler applies the doctor source-rights contract to slug/detail GET, legacy list GET and cursor-paginated GET. It requires a current approved exact source-host/source-name match, explicit doctor-profile and commercial republication scopes, valid dates and no revocation. Unknown/missing listing types fail closed. Claiming and contact consent do not substitute for source permission.
- PR #1023 exact-head CI passed Deno/type checking, doctor publication/import/output contracts, contact-consent PostgreSQL/source checks, backend-only and MantiGO privacy suites, RC425 Paymob atomicity, module Platform Admin/Legal PostgreSQL suites, catalog build, employee RBAC PostgreSQL and dashboard browser E2E.
- PR #1021 merged as `be7989b0587d96d5418c9446042c60dcd4e32158`; the master source authority map and this audit are in main.
- Latest main forward migration replay run `45373530649` passed the exact 79-version chain on disposable PostgreSQL/Supabase. RC921/RC922 behavioral and concurrency suite passed. No Production migrations were applied by this CI.
- Fresh read-only Production recheck after the merges: 310 migration rows through `20261110150618`; 0/79 exact required IDs in ledger; 568 PUBLISHED doctor listings; source permission registry 0 rows; contact-consent tables absent. Live directory-listings remains ACTIVE v18 and is intentionally fail-closed. No live schema/data/Edge/Auth/RLS/GRANT/feature-flag mutation occurred.
- Platform Admin P0 remains: is_platform_admin() remains tenant-role-derived, mnty_can_platform_admin() delegates to tenant RBAC, registry FORCE RLS remains false, and 56 public + 1 storage policy still reference the old helper. Issue #867 remains open.
- Current Pages run `45373530610` had public-only validation succeeded while full V6 Preview validation remained in progress at checkpoint. Earlier Catalog Pilot deployment `45372125371` completed its deployed-origin browser tests successfully. These are separate checkpoints.
- Full Production remains **BLOCKED / NOT CERTIFIED** pending operator-controlled encrypted DB + Storage backup, Auth/Vault recovery, independent PostgreSQL 17 restore/rollback with measured RPO/RTO, physical schema/79-migration reconciliation, coordinated Platform Admin and directory consent/source-rights migrations + Edge parity, and deployed-origin adversarial tests.