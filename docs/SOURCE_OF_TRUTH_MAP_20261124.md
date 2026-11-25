# MantiqatiX — Unified Source of Truth Map
**Checkpoint:** 2026-11-25 — main `a2dba687848998da0dff3d40e6db44c578a85692`; RC926 merged source-only in PR #1097. Exact-head 83-version replay and RC479/RC926 tests passed.  
**Operating directive:** [MASTER_SOURCE_OF_TRUTH.md](./MASTER_SOURCE_OF_TRUTH.md)  
**Canonical repository:** `islamnagy2022-eng/MantiqatiX`  
**Production Supabase:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`

## Authority order
1. **Operating rules:** `docs/MASTER_SOURCE_OF_TRUTH.md` — exact owner-supplied instruction, controlling development method, priorities and release boundaries.
2. **Application source:** GitHub `main`; current checkpoint `00a8d369ccc8d5b1fb6ef29db87178c65ebddd27` (the application source is canonical; current runtime parity is tracked in the latest Edge audit).
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
- Main: `53b8be3784790e56775f16bb51c9c3477cfeb536` (RC925 source merge plus confirmed-user positive compatibility integration tests); recent merged changes include separate business-logo/app-icon handling, official navbar logo restoration, Pages deployment stabilization, contact-consent-gated directory discovery, RC924 Legal agreement participant authorization, and RC925 fail-closed confirmed-identity guards for all seven direct catalog RPCs.
- RC925 `20261124150000` is merged in PR #1069 (source-only) at `a0a31dab110ac519f8528cbefe74c0eefb727a7c`. All seven direct catalog RPCs now require `(auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'false'`, denying both anonymous=true and a missing/null claim. Exact-head static validation, missing-claim adversarial PG17 test, and full 82-version chronological replay passed in run `45477345349`; catalog build and dashboard browser E2E passed in `45477345161`. PR #1071 added positive `is_anonymous=false` compatibility coverage to all seven RPCs; all exact-head workflows passed and the change merged as `53b8be3784790e56775f16bb51c9c3477cfeb536`. Production remains at 310 rows through `20261110150618`; RC925 is not applied.
- Production DB: ACTIVE_HEALTHY PostgreSQL 17.6.1.155, 310 migration rows through `20261110150618`; 82 required release migration identifiers, 0 exact IDs present in the live ledger at this check. RC923 and RC924 are not applied. PR #1066's exact 81-version strict gate and 117-migration chronological PostgreSQL 17 replay passed in isolated CI run `45465702093`; no Production migration was executed. This still requires physical-object/alias reconciliation before any Production release.
- Platform Admin: live `is_platform_admin()` still derives global authority from active tenant ADMIN/SUPER_ADMIN roles (57 policy references); live `mnty_can_platform_admin()` still delegates to a null-scope tenant helper (5 policy references). Registry-backed forward migrations are source-only.
- Directory: 965 records (869 PUBLISHED / 87 DRAFT / 9 HIDDEN); zero source-rights evidence rows and no contact-consent table. Deployed `directory-listings` v18 is intentionally fail-closed.
- R7 archive forensic source review: [PASS 1460–1469](./audits/PASS_1460_1469_R7_ARCHIVE_SECURITY_REVIEW_20261120.md) and [R7 archive security revalidation](./audits/R7_ARCHIVE_SECURITY_REVALIDATION_20261119.md). The R7 archive is the same SHA-256 listed above; known source-level findings include client-controlled role/session state, local JSON treated as authoritative, browser-client service-role key fallback reference, weak/default session and Paymob secrets, and unauthenticated state/token/finance route patterns. These are archive source findings, not proof of a live production compromise.
- RC923 and RC924 are source-only forward migrations. RC924 is merged under PR #1064; its ordered RC482 → RC924 dedicated PostgreSQL 17 suite passed (`45458313302` and current PR run `45465701993`). The unified exact 81-version strict gate and full 117-migration chronological replay passed on PR #1066 (`45465702093`). This is isolated CI evidence only; the Production ledger still does not record RC923/RC924, and the coordinated Production release remains blocked.
- Production release: **BLOCKED / NOT CERTIFIED** until encrypted database + Storage exports, Auth/Vault coverage/recovery, independent PostgreSQL 17 restore/rollback and measured RPO/RTO, exact 81-version/physical-object reconciliation, coordinated DB/Edge parity and deployed-origin adversarial tests pass.

- PR #1027 exact-head CI passed: Doctor Incremental Import Contract, Directory Contact Consent, RC425 Paymob, MantiGO privacy, Backend-only, Module Professionalization (Platform Admin/Legal/Privacy PG suites), Primary Catalog build/RBAC/Browser E2E and Pages validation. The PR deploy job was skipped, as required for pull_request events.
- Fresh Production snapshot after #1027: 310 migration ledger rows through 20261110150618; 0/80 exact required IDs; 965 directory rows (869 PUBLISHED, 568 PUBLISHED doctors, 567 unclaimed); source-rights registry 0 rows; contact-consent tables absent; private Platform Admin registry 1 row.
- Fresh Security Advisor (2026-11-24 10:35Z): 9 RLS-enabled/no-policy INFO; 1 anon-callable SECURITY DEFINER (intentional public ad discovery); 65 authenticated-callable SECURITY DEFINER; 90 anonymous-session policy findings; leaked-password protection disabled; performance 132 unindexed FKs, 375 RLS initplan, 66 unused indexes, 28 multiple permissive policies; Health Advisor empty.
- Direct policy/ACL reconciliation: 21 policies include anon/public role (19 anon, 2 public); six explicit deny-all policies; 13 anon SELECT policy definitions, of which eight public-schema tables currently have direct anon SELECT grants. One high-priority surface remains marketing_provider_profiles (all 19 columns, including owner_user_id/settings/profile_image_path, under ACTIVE-only policy); digital pages and legal docs also expose full base-table projections and remain tracked in #928. Storage public read is scoped to mantiqatix-profile-media; no anon write RLS policy was found.
- Latest main push run 45376506890 passed catalog build, employee RBAC PostgreSQL and dashboard Browser E2E. Pages run 45376507114 had validation and public-only gates pass; deployed-origin legacy catalog/dashboard/mobile/QR checks were still running at the checkpoint.

## Workflow rule
Use `DISCOVER → IMPLEMENT → TEST → FIX → VERIFY → INTEGRATE → NEXT TASK`. Start from the first current incomplete P0/P1 item. Never infer release completion from archive status labels, local UI, empty tables, source-only fixes, historical CI or unverified deployment claims. Keep production read-only until the explicit backup, replay, authorization, payment and release gates are satisfied.


## Additional live audit evidence — 2026-11-24
- [PASS 2111–2120](./audits/PASS_2111_2120_RC924_LIVE_PRODUCTION_RECHECK_20261124.md), [PASS 2121–2130](./audits/PASS_2121_2130_RC485_RC923_LIVE_CATALOG_RPC_RECHECK_20261124.md), [PASS 2131–2140](./audits/PASS_2131_2140_RC479_RC488_RC489_LIVE_PRODUCTION_RECHECK_20261124.md), [PASS 2141–2150](./audits/PASS_2141_2150_RC472_RC473_DIRECTORY_LIVE_RECHECK_20261124.md), [PASS 2151–2160](./audits/PASS_2151_2160_LIVE_EDGE_BUNDLE_RECHECK_20261124.md), [PASS 2161–2170](./audits/PASS_2161_2170_CURRENT_81_MIGRATION_PHYSICAL_EFFECT_RECHECK_20261124.md), [PASS 2171–2180](./audits/PASS_2171_2180_HISTORICAL_MIGRATION_ALIAS_AND_PARTIAL_EFFECT_RECONCILIATION_20261124.md), [PASS 2181–2190](./audits/PASS_2181_2190_PAYMENT_MANTIGO_MEDICAL_RPC_CONTRACT_RECHECK_20261124.md), and [PASS 2191–2200](./audits/PASS_2191_2200_EDGE_TRANSITIVE_LOCAL_IMPORT_CLOSURE_20261124.md) preserve the read-only checks.
- The focused physical-effect report is a timestamped 81-version pre-RC925 snapshot; current main has 82 required source versions. The sample is not exhaustive.
- Physical sample: 18 relations, 12 indexes, 17 columns and 15 function families checked; 5 relations, 9 indexes, 15 columns and 11 function families absent; 4 function families present but contract-blocked.
- Three exact byte aliases: RC424 → `20261008222845`; marketing contact duplicate → `20261027041411`; directory source-rights evidence → `20261101140105`. No Production SQL replay or ledger repair occurred.
- Nine launch-critical Edge deployments differ from main; local import traversal found no cycles, but external dependency resolution and bundle parity remain NOT VERIFIED.
- High-risk payment/wallet contracts [PASS 2211–2220](./audits/PASS_2211_2220_RC425_RC432_LIVE_CONTRACT_RECHECK_20261124.md): RC425 table/RPC absent; RC426 finalizer absent; RC427 index absent; RC428–RC430 processors absent; RC431 search_path drift; RC432 idempotency index/admin credit absent and legacy debit/refund routines use search_path=public.
- ERP, subscription-claim, journal and global MantiGO admin contracts [PASS 2221–2230](./audits/PASS_2221_2230_RC434_RC441_LIVE_CONTRACT_RECHECK_20261124.md): RC434–RC439 physical/RPC effects absent; RC438 legacy status RPC present but path/ACL blocked; RC441 functions present but old scope/path contract remains. RC440 is a dynamic historical migration and requires timestamp-correct interpretation.
- Approval audit, CRM, matrimony and journal evidence [PASS 2231–2240](./audits/PASS_2231_2240_RC442_RC451_LIVE_CONTRACT_RECHECK_20261124.md): direct approval_actions DML remains granted; CRM policies exceed row/business source scope; matrimony private profile SELECT is not owner-only and lifecycle RPCs are absent; journal service-role boundary remains incomplete; RC451 targeted ads public read stays PASS and anon-enabled.
- CRM tenant-scope and internal campaign evidence [PASS 2241–2250](./audits/PASS_2241_2250_RC452_RC453_CRM_CAMPAIGNS_LIVE_RECHECK_20261124.md): RC452 manager policies remain broader than source scope; RC453 campaign tables, four indexes, and five RPCs are absent. The RC453 workflow is internal planning, not automated external ad publishing.
- Fresh physical read-back [PASS 2201–2210](./audits/PASS_2201_2210_PHYSICAL_OBJECT_RECHECK_20261124.md): 76 curated contracts refreshed at 35 present / 41 absent; 22 matched function entries include 9 non-empty search paths and require separate body/ACL/scope review.

- Current-main Pass 2291–2300 — RC446, RC456, RC463 and RC525 [report](./audits/PASS_2291_2300_RC446_RC456_RC463_RC525_LIVE_RECHECK_20261124.md): MantiGO open-ride, SMM service-role grants, trigger ACL/search_path and digital-page global product scope.
- Current-main Pass 2301–2310 — RC464–RC470 [report](./audits/PASS_2301_2310_RC464_RC470_LIVE_EFFECT_RECHECK_20261124.md): platform registry root, orders/history, branch scope, commission, digital-page claims and webhook repair.
- Current-main Pass 2311–2320 — RC471–RC478 [report](./audits/PASS_2311_2320_RC471_RC478_LIVE_EFFECT_RECHECK_20261124.md): MantiGO global admin, directory claim/consent, payment processing and ride privacy.
- Current-main Pass 2321–2330 — Qadam + RC479–RC483 [report](./audits/PASS_2321_2330_QADAM_RC479_RC483_LIVE_EFFECT_RECHECK_20261124.md): seed idempotency evidence, public provider/page reads, Legal registry and atomic CMS grants.
- RC485–RC496 catalog, SMM bootstrap, confirmed-session, Storage, settlement and MantiGO bid state [PASS 2271–2280](./audits/PASS_2271_2280_RC485_RC496_AUTH_STORAGE_FINANCE_RECHECK_20261124.md): catalog registry/price serialization absent; first-user SMM bootstrap still live; restrictive Auth guards absent; settlement remains membership-derived; accepted-bid uniqueness/OFFERED gate incomplete.
- RC921–RC925 medical, agreement and catalog identity [PASS 2281–2290](./audits/PASS_2281_2290_RC921_RC925_MEDICAL_AGREEMENTS_CATALOG_RECHECK_20261124.md): medical provider state is legacy; agreement participant correlation and confirmed-session boundary are wrong; seven catalog RPCs still lack the fail-closed RC925 body.

## Final 82-migration read-back — 2026-11-24
- [82-source crosswalk](./release/REQUIRED_82_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261124.md): 82/82 required migration sources have current live read-back and an explicit PASS/PARTIAL/BLOCKED disposition. This is not an all-pass release.
- Current-main [PASS 2271–2280](./audits/PASS_2271_2280_RC485_RC496_AUTH_STORAGE_FINANCE_RECHECK_20261124.md) and [PASS 2281–2290](./audits/PASS_2281_2290_RC921_RC925_MEDICAL_AGREEMENTS_CATALOG_RECHECK_20261124.md) are authoritative for RC485–RC496 and RC921–RC925.
- [PASS 2331–2340](./audits/PASS_2331_2340_RC113_RC117_CONTROL_CENTER_EMPLOYEE_LIVE_RECHECK_20261124.md) and [PASS 2341–2350](./audits/PASS_2341_2350_RC102_RC106_ORDER_PROVIDER_SCOPE_LIVE_RECHECK_20261124.md) hold renumbered RC113–RC117 and RC102–RC106 reports.
- 76-object sample: 35 present / 41 absent; presence is not semantic parity. Live ledger: 310 rows through 20261110150618; 0/82 exact source IDs.
- Main checkpoint: `9e6c62e25614d020eb07b6361dba6eb1c5ac8257`. No Production writes occurred.
- Migration-history reconciliation update: **3 exact source aliases confirmed / 0 formal ledger repairs applied** (RC424→20261008222845; marketing-contact `20261027100000`→`20261027041411`; directory-source-rights `20261101150000`→`20261101140105`). Five partial baselines are now machine-classified (subscription, ERP, journal, directory, generic payments); RC451 remains a separate forward repair. See `migration_alias_resolution_check` and `historical_partial_baseline_reconciliation_20261124` in `production-migration-reconciliation.json`.

## Latest platform-root read-back — 2026-11-24
- [PASS 2361–2370](./audits/PASS_2361_2370_PLATFORM_ROOT_LIVE_RECHECK_20261124.md) records fresh read-only Production evidence: registry RLS ON/FORCE RLS OFF; membership-derived `is_platform_admin()`; legacy `mnty_can_platform_admin()`; 57 policies / 24 tables and 5 policies / 3 tables; seven catalog RPCs without explicit `is_anonymous=false` guard.
- [Coordinated release gate](./release/PLATFORM_ROOT_COORDINATED_RELEASE_20261124.md) maps RC464/RC471/RC484/RC485/RC923/RC925 dependencies and requires the full canonical 82-version chronology, exhaustive physical/ACL/RLS reconciliation, encrypted backup/restore and DB-to-Edge E2E before Production approval.
- No Production mutation was performed; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Latest Edge runtime parity — 2026-11-24
- [PASS 2371–2380](./audits/PASS_2371_2380_EDGE_RUNTIME_SOURCE_PARITY_20261124.md) confirmed nine launch-critical Edge entrypoint mismatches, two public-catalog entrypoint matches, three additional runtime differences and the intentionally fail-closed `directory-listings` v18 stub.
- Entry-point parity does not certify the complete compiled bundle, external imports or runtime dependencies. No individual Edge deployment is permitted before DB/RPC/ACL parity and deployed-origin E2E.
- Production Edge functions remain unchanged; `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Latest Edge ↔ RPC ↔ migration contract — 2026-11-24
- [PASS 2381–2390](./audits/PASS_2381_2390_EDGE_RPC_PRODUCTION_DEPENDENCY_RECHECK_20261124.md) records a fresh read-only Production inventory: 17 required migration IDs absent; subscription claim and ERP line-receive RPCs absent; five journal columns and the purchase-order-line table absent; journal service-role EXECUTE denied; settlement business scope incomplete.
- [Edge/RPC dependency matrix](./release/EDGE_RPC_PRODUCTION_DEPENDENCY_MATRIX_20261124.md) maps each deployment slice to its exact source migrations, Edge entrypoints, RPCs and ACL requirements.
- HIGH payment-integrity blocker: deployed Paymob HMAC-SHA512 signs order.id but not merchant_order_id; deployed webhook v10 selects by the unsigned field and lacks stored provider_order_id equality checks for standard/digital-page/subscription flows. A valid signed event may be misbound to a different pending row if the selector is altered and amount/currency match. No exploitation is known. Current main rejects this by checking stored provider_order_id against signed order.id before each processor. A sandbox altered-selector replay test is mandatory before release.
- All SQL and Edge checks were read-only. No Production migration, ACL, payment, settlement or function deployment occurred. FULL_PLATFORM_GATE remains BLOCKED / NOT CERTIFIED.

## Backup/restore evidence gate — 2026-11-24
- [PASS 2391–2400](./audits/PASS_2391_2400_BACKUP_RESTORE_CAPABILITY_READBACK_20261124.md) records the Supabase project/branch read-back. Organization plan is confirmed **Free** by \`get_organization\` on 2026-11-25; Free has no automatic daily backups per current Supabase guidance. Backup inventory/latest owner-created export remains unavailable; no separate populated restore target or retrievable export has been demonstrated.
- [Owner-controlled drill](./release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md) details database/Auth/schema export, separate Storage object bytes, Vault/secret recovery, disposable PostgreSQL 17 restore, checksum validation, rollback and RPO/RTO evidence.
- No backup was created, no restore was performed and no Production mutation took place. P6 remains **BLOCKED / NOT VERIFIED**.

## Paymob CI source guard — 2026-11-24
- PR #1090 merged at `46714e919d959e49afe5efa64e2fcd2f94a982d7`; the validator now checks signed order binding before standard, digital-page and subscription processor RPCs and is wired into RC425/RC428 CI.
- Full HTTP altered-selector replay remains pending in an isolated sandbox; deployed Production webhook remains behind current main.


## Uploaded AI Studio R7 archive review — 2026-11-25
- [PASS 2411–2420](./audits/PASS_2411_2420_R7_AI_STUDIO_ARCHIVE_SOURCE_AND_SECURITY_REVIEW_20261125.md) inspects `bizcatalog-manager (11).zip` against current `main` and the connected Production Supabase identity.
- The archive is a separate root Express/Vite implementation, not a drop-in update to `apps/catalog-frontend`; its manifest/server use Supabase ref `moyhiluyhjsujhwlyweuu`, which does not match Production `moyhiluyhjsujhwlyeuu`.
- R7 claims a local authoritative JSON database alongside Supabase and contains static fallback secrets for Paymob HMAC, session signing and backup encryption. Its shared client module also selects the service-role key, although no import of that module was found in the archive.
- Preserve the ZIP as a reference only. Do not import wholesale or point it at Production. Current `main` and Supabase remain canonical; any reuse must be an incremental, reviewed port with exact-head tests.


## 2026-11-25 — RC926 strict provider-profile identity boundary

- Preserved the R7 ZIP review (PASS 2411–2420) and continued RC926 as PASS 2421–2430 on a branch based on latest main `b90155040bdbd72d4472f1f7bd964d988b82ac0f`.
- Production read-only evidence confirms direct anon SELECT remains on `marketing_provider_profiles`, with a permissive active-row base-table policy and no restrictive RC479 confirmed-Auth policy. RLS + FORCE RLS are enabled.
- RC926 adds a new forward-only migration requiring explicit `is_anonymous=false`, revoking direct anon SELECT and preserving authenticated/service-role SELECT grants and owner DML policy definitions.
- The first full replay showed the schema-only checkpoint did not contain the provider row assumed by the test. The integration now seeds an idempotent synthetic profile and uses the existing synthetic Auth user from the disposable replay prerequisite. Exact-head PostgreSQL 17 full replay, strict 83-version gate and RC926 static validator passed in run `45520980163`; targeted RC479 anonymous-Auth PostgreSQL suite passed in run `45520979889` on PR head `d2e265f581a39b80ca8bdbbf472b68b84a098ac2`.
- No historical migration edited; no Production SQL/GRANT/RLS/Auth/Storage/Edge/Payment mutation. Overall gate remains BLOCKED / NOT CERTIFIED.


## RC926 exact-head verification and merge — 2026-11-25
- PR #1097 merged source-only at `a2dba687848998da0dff3d40e6db44c578a85692`.
- Exact PR head `d2e265f581a39b80ca8bdbbf472b68b84a098ac2`: strict 83-version release validator and PostgreSQL 17 chronological restore/replay passed in run `45520980163`; the same run validates RC926's strict provider-profile confirmed-identity guard.
- Targeted RC479 anonymous-Auth PostgreSQL regression passed in run `45520979889`. All workflow runs associated with the exact PR head completed successfully.
- These are source/disposable-CI results only. The live Supabase migration ledger, grants/policies and Edge runtime were not changed. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains in force.
