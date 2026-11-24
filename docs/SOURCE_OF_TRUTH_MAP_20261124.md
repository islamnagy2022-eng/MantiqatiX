# MantiqatiX — Unified Source of Truth Map
**Checkpoint:** 2026-11-24  
**Operating directive:** [MASTER_SOURCE_OF_TRUTH.md](./MASTER_SOURCE_OF_TRUTH.md)  
**Canonical repository:** `islamnagy2022-eng/MantiqatiX`  
**Production Supabase:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`

## Authority order
1. **Operating rules:** `docs/MASTER_SOURCE_OF_TRUTH.md` — exact owner-supplied instruction, controlling development method, priorities and release boundaries.
2. **Application source:** GitHub `main`; at this checkpoint `ec40a52cee475b550e89974fac2669f82ff873d2`.
3. **Production identity, authorization and business data:** the connected `MANTIQATIX FINAL` Supabase project. The paused `MantiqatiX-DEMO` project is not production and must never be merged into the production data path.
4. **Database release state:** live `supabase_migrations.schema_migrations` plus exact source migrations and physical schema/ACL/RLS reconciliation. A missing migration version is not by itself proof that all physical effects are absent.
5. **Runtime Edge state:** the deployed Supabase Edge Function bundle/version and settings, compared with the exact current-main source and its schema dependencies. Main source alone does not prove deployment.
6. **Public web deployment:** `.github/workflows/pages.yml` is the deployment contract; `apps/catalog-frontend/**` is the canonical catalog website source. The isolated `apps/aistudio-v6/**` candidate/preview is not a reason to replace the live root without its own release and route decision.
7. **Historical feature archive:** uploaded `bizcatalog-manager (11).zip` (2026-11-11; SHA-256 `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`) is R7 reference material only. Do not deploy it, copy its `server.ts`, auth, finance, local JSON, Supabase client or migrations wholesale. Its own manifest claims a dual-authoritative local-JSON/Supabase architecture which conflicts with this directive.
8. **Historical reports and execution ledgers:** `docs/MASTER_PRODUCTION_TODO.md`, `docs/PROJECT_CONTINUITY.md`, `docs/SESSION_LOG.md`, pass reports and archive reports are evidence/history. They do not override the master operating directive; reconcile superseded facts at the current checkpoint and preserve historical evidence.

## Source status matrix
| Source | Status | Allowed use / rule |
|---|---|---|
| GitHub `main` | **CURRENT / CANONICAL** | Application code and current migrations; verify each commit and exact-head CI. |
| Production Supabase `MANTIQATIX FINAL` | **LIVE / AUTHORITATIVE** | Identity, permissions, tenant data and persisted business state; inspect read-only until approved release gates pass. |
| Supabase DEMO project | **ISOLATED / NOT PRODUCTION** | Synthetic preview only; never copy its data into Production. |
| `apps/catalog-frontend/**` | **CURRENT PUBLIC CATALOG SOURCE** | Primary website source; preserve current root, existing routes and rollback route. |
| `apps/aistudio-v6/**` | **ISOLATED CANDIDATE / PREVIEW** | Use for vertical-slice integration after exact backend contracts and security gates; not automatic production replacement. |
| Deployed Edge Functions | **LIVE RUNTIME SOURCE** | Compare bundle, version, JWT setting, secrets-by-name and schema/RPC contract with main. Deploy only coordinated bundles. |
| Supabase migration ledger | **LIVE HISTORY** | Compare all required IDs and physical effects; never blindly replay or rewrite historical versions. |
| R7 ZIP | **HISTORICAL / REFERENCE ONLY** | Selective UI/assets only after per-feature mapping and security review; preserve archive intact. |
| R7 RELEASE_REPORT / MASTER_TODO / manifests | **UNVERIFIED CLAIMS** | Do not carry forward 100%/VERIFIED statuses as production evidence. |
| This operating directive | **CONTROLLING INSTRUCTION** | One workflow and priority order across sessions; historical notes are append-only evidence. |

## Verified checkpoint (2026-11-24)
- Main: `751367f7ea6a7290e5c62bbff5f1979ee456dc20`; recent merged changes include separate business-logo/app-icon handling, official navbar logo restoration, RC922, contact-consent-gated directory discovery and RC923 catalog Anonymous Auth guards. The 80-version chronological replay passed in disposable PostgreSQL 17 (116 migrations applied), and deployed-origin Pages/Playwright checks passed in run `45393984388`.
- Production DB: ACTIVE_HEALTHY PostgreSQL 17.6.1.155, 310 migration rows through `20261110150618`; 80 required release migration identifiers, 0 exact IDs present in the live ledger at this check. This requires physical-object/alias reconciliation before any migration execution.
- Platform Admin: live `is_platform_admin()` still derives global authority from active tenant ADMIN/SUPER_ADMIN roles (57 policy references); live `mnty_can_platform_admin()` still delegates to a null-scope tenant helper (5 policy references). Registry-backed forward migrations are source-only.
- Directory: 965 records (869 PUBLISHED / 87 DRAFT / 9 HIDDEN); zero source-rights evidence rows and no contact-consent table. Deployed `directory-listings` v18 is intentionally fail-closed.
- R7 archive forensic source review: [PASS 1460–1469](./audits/PASS_1460_1469_R7_ARCHIVE_SECURITY_REVIEW_20261120.md) and [R7 archive security revalidation](./audits/R7_ARCHIVE_SECURITY_REVALIDATION_20261119.md). The R7 archive is the same SHA-256 listed above; known source-level findings include client-controlled role/session state, local JSON treated as authoritative, browser-client service-role key fallback reference, weak/default session and Paymob secrets, and unauthenticated state/token/finance route patterns. These are archive source findings, not proof of a live production compromise.
- RC923 is a source-only forward migration; its full-chain PostgreSQL 17 test passed (run `45393984396`, 116 migrations, seven direct RPC denials). It remains unapplied to Production pending physical-object/alias reconciliation and final release controls.
- RC923 test evidence: [PASS 2071–2080](./audits/PASS_2071_2080_RC923_FULL_REPLAY_20261124.md). GitHub Pages deployed-origin root/legacy/preview/asset smoke and Playwright Browser E2E passed in run `45393984388`.
- Production release: **BLOCKED / NOT CERTIFIED** until encrypted database + Storage exports, Auth/Vault coverage/recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO, exact 80-version/physical-object reconciliation, coordinated DB/Edge parity and deployed-origin adversarial tests pass.

- PR #1027 exact-head CI passed: Doctor Incremental Import Contract, Directory Contact Consent, RC425 Paymob, MantiGO privacy, Backend-only, Module Professionalization (Platform Admin/Legal/Privacy PG suites), Primary Catalog build/RBAC/Browser E2E and Pages validation. The PR deploy job was skipped, as required for pull_request events.
- Fresh Production snapshot after #1027: 310 migration ledger rows through 20261110150618; 0/80 exact required IDs; 965 directory rows (869 PUBLISHED, 568 PUBLISHED doctors, 567 unclaimed); source-rights registry 0 rows; contact-consent tables absent; private Platform Admin registry 1 row.
- Fresh Security Advisor (2026-11-24 10:35Z): 9 RLS-enabled/no-policy INFO; 1 anon-callable SECURITY DEFINER (intentional public ad discovery); 65 authenticated-callable SECURITY DEFINER; 90 anonymous-session policy findings; leaked-password protection disabled; performance 132 unindexed FKs, 375 RLS initplan, 66 unused indexes, 28 multiple permissive policies; Health Advisor empty.
- Direct policy/ACL reconciliation: 21 policies include anon/public role (19 anon, 2 public); six explicit deny-all policies; 13 anon SELECT policy definitions, of which eight public-schema tables currently have direct anon SELECT grants. One high-priority surface remains marketing_provider_profiles (all 19 columns, including owner_user_id/settings/profile_image_path, under ACTIVE-only policy); digital pages and legal docs also expose full base-table projections and remain tracked in #928. Storage public read is scoped to mantiqatix-profile-media; no anon write RLS policy was found.
- Latest main push run 45393984388 passed deployed-origin Pages smoke and Playwright Browser E2E: root/history/refresh, directory fallback, 390px/1440px marketing routing, progressive pagination, owner dashboard desktop/mobile, guest access denial, employee/branch scope and merchant QR flows.

## Workflow rule
Use `DISCOVER → IMPLEMENT → TEST → FIX → VERIFY → INTEGRATE → NEXT TASK`. Start from the first current incomplete P0/P1 item. Never infer release completion from archive status labels, local UI, empty tables, source-only fixes, historical CI or unverified deployment claims. Keep production read-only until the explicit backup, replay, authorization, payment and release gates are satisfied.
