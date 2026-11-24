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
- `public.migration_release_registry` and `private.migration_release_registry` are absent.
- No Production migration, schema, Auth, RLS, GRANT, Storage, Edge, payment, wallet, settlement, or customer-data mutation was performed.

## 3. Platform-root authorization — P0

Read-only live definitions show two distinct legacy paths:

1. `public.is_platform_admin()` is a STABLE invoker SQL function with `search_path=public`; it returns true for any active `user_memberships` row whose role is `ADMIN` or `SUPER_ADMIN`. **57 RLS policies** reference it.
2. `public.mnty_can_platform_admin()` remains SECURITY DEFINER with `search_path=public, pg_temp`; its body delegates to `public.mnty_can('admin', NULL, NULL, NULL)`. Authenticated callers have EXECUTE, and **5 RLS policies** reference it.

The canonical `private.platform_admins` table exists and contains one row. RLS is enabled, but FORCE RLS is false. Direct SELECT is denied to both `anon` and `authenticated`. Source migrations RC464/RC471 and later registry-backed repairs exist in the repository, but they are not applied to this Production project. Do not patch either helper or its dependent policies in isolation: use the ordered, versioned migration release after backup/restore and exact-schema preflight.

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

## 8. Work performed and next sequence

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
