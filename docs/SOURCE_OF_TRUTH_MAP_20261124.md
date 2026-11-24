# MantiqatiX — Unified Source of Truth Map
**Checkpoint:** 2026-11-24  
**Operating directive:** [MASTER_SOURCE_OF_TRUTH.md](./MASTER_SOURCE_OF_TRUTH.md)  
**Canonical repository:** `islamnagy2022-eng/MantiqatiX`  
**Production Supabase:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`

## Authority order
1. **Operating rules:** `docs/MASTER_SOURCE_OF_TRUTH.md` — exact owner-supplied instruction, controlling development method, priorities and release boundaries.
2. **Application source:** GitHub `main`; at this checkpoint `e86fa555488cf95015d67654d69c6a0f0af8ad2e`.
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
- Main: `e86fa555488cf95015d67654d69c6a0f0af8ad2e`; recent merged changes include separate business-logo/app-icon handling, official navbar logo restoration, Pages deployment stabilization, RC922, and contact-consent-gated directory discovery.
- Production DB: ACTIVE_HEALTHY PostgreSQL 17.6.1.155, 310 migration rows through `20261110150618`; 79 required release migration identifiers, 0 exact IDs present in the live ledger at this check. This requires physical-object/alias reconciliation before any migration execution.
- Platform Admin: live `is_platform_admin()` still derives global authority from active tenant ADMIN/SUPER_ADMIN roles (57 policy references); live `mnty_can_platform_admin()` still delegates to a null-scope tenant helper (5 policy references). Registry-backed forward migrations are source-only.
- Directory: 965 records (869 PUBLISHED / 87 DRAFT / 9 HIDDEN); zero source-rights evidence rows and no contact-consent table. Deployed `directory-listings` v18 is intentionally fail-closed.
- R7 archive forensic source review: [PASS 1460–1469](./audits/PASS_1460_1469_R7_ARCHIVE_SECURITY_REVIEW_20261120.md) and [R7 archive security revalidation](./audits/R7_ARCHIVE_SECURITY_REVALIDATION_20261119.md). The R7 archive is the same SHA-256 listed above; known source-level findings include client-controlled role/session state, local JSON treated as authoritative, browser-client service-role key fallback reference, weak/default session and Paymob secrets, and unauthenticated state/token/finance route patterns. These are archive source findings, not proof of a live production compromise.
- Production release: **BLOCKED / NOT CERTIFIED** until encrypted database + Storage exports, Auth/Vault coverage/recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO, exact 79-version/physical-object reconciliation, coordinated DB/Edge parity and deployed-origin adversarial tests pass.

## Workflow rule
Use `DISCOVER → IMPLEMENT → TEST → FIX → VERIFY → INTEGRATE → NEXT TASK`. Start from the first current incomplete P0/P1 item. Never infer release completion from archive status labels, local UI, empty tables, source-only fixes, historical CI or unverified deployment claims. Keep production read-only until the explicit backup, replay, authorization, payment and release gates are satisfied.
