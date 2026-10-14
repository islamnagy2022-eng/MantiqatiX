# Cross-Branch Historical Source Recovery Audit — 2026-10-14

## Status

**BLOCKED / NOT CERTIFIED.** This report records source-search evidence only. It does not approve a production change, merge, deployment, or new disposable baseline.

## Repositories and branches examined

- Focus branch: `recovery/verified-rc425-441-sources-20261014` (PR #248).
- Additional recovery branch: `fix/replay-marketing-project-baselines-20261013`.
- Main at the reviewed baseline: `0650db959a460885941d65ad1feabcdd89ae58f1`.
- Supplied archive: `source_RC40.zip`, SHA-256 `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`.

## Findings

### 1. SECURITY DEFINER creation history

The tracked migration `20260927095000_revoke_unused_security_definer_execute.sql` revokes client execution from ten legacy functions, including `public.counter_offer_indrive_bid(uuid,uuid,numeric)`, but repository search did not locate their original creation migration. Read-only live catalog evidence confirms the function currently exists in production; that current definition is not proof of historical source.

The divergent recovery branch contains `supabase/tests/baselines/legacy_security_definer_functions.sql`, a live-derived test fixture at temporary replay version `20260927074160`. Its own header explicitly states that it is **not recovered historical DDL** and is intended for disposable replay only. No separate approval for this privileged function-body fixture was established in the evidence reviewed for PR #248. Prior SMM table-baseline approval must not be extended implicitly.

### 2. Credit and marketing schema history

The recovery branch also contains test-only compatibility fixtures for `credit_accounts`, `credit_periods`, and marketing project objects. The supplied RC40 archive and the repository searches performed for this continuation did not recover canonical creation DDL for the relevant missing dependencies. The live catalog and synthetic fixtures are not a substitute for historical provenance.

### 3. Branch divergence

GitHub comparison reported `fix/replay-marketing-project-baselines-20261013` as 634 commits ahead and 3 behind `main`. Do not merge or transplant that branch wholesale into PR #248; its broad, divergent change set requires independent review.

### 4. PR #248 exact-head CI evidence

For head `5beb4aac30393617a246a99932e95857651be4ab`, the following runs were completed successfully:

- [RC462 malformed platform-admin permission regression](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886995)
- [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509887047)
- [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886965)
- [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886928)
- [Module professionalization validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886932)
- [Backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509887018)
- [MantiGO open-ride privacy boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886943)
- [Approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509887057)

The Pages workflow validated but skipped its deploy job because the production gate remained blocked. These focused successes do **not** prove complete chronological migration replay, tenant isolation, payment/finance E2E, backup restoration, Auth security configuration, or deployed Edge Function parity. The full replay remains NOT VERIFIED.

## Safe next steps

1. Continue searching for canonical historical SQL in trusted source history, approved backups, or deployment artifacts.
2. If unavailable, request narrowly scoped explicit approval before adding each further live-derived baseline to disposable CI; approval for one object does not authorize another.
3. Keep every compatibility fixture outside `supabase/migrations/`, with no production rows, and inject it only into a fresh disposable database.
4. Do not alter the historical revoke migration, create placeholder functions, skip migrations, merge PR #248/#218, or deploy while release gates are open.
5. Continue tracking the live SMM gateway fail-closed containment, MantiGO global-scope authorization, full replay, tenant isolation, payment/finance E2E, Auth settings, and backup/restore as independent production blockers.

## Production boundary

No production schema, migration ledger, RLS, grants, Auth settings, Edge Functions, secrets, wallet balances, payment records, or customer data were changed as part of this source-search continuation.


## Fresh live-state refresh — 2026-10-14

Read-only Supabase inventory was rechecked after the cross-branch search:

- The applied migration ledger still ends at `20261008222845 / rc424_atomic_digital_page_payment_webhook`. Candidate RC425–RC462 and later migrations are not thereby proven applied; do not infer they are live.
- The deployed `smm-gateway` is now **ACTIVE version 10**, `verify_jwt=true`, source SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`.
- Unlike the older version evidence, the currently retrieved version 10 source includes `SMM_INITIAL_LAUNCH_DEFERRED=true` and checks this hard gate before authenticating/routing any POST action. The helper defaults to `SMM_DEFERRED`/503 unless both enablement and post-launch approval flags are exactly `true`. Since the source constant is hard-coded true, the deployed handler is statically fail-closed in this version. This is source inspection, **not a live negative HTTP test**; the latter remains unverified because no function invocation test was run in this continuation.
- The function's source also includes a 15-second provider request timeout, safe provider endpoint validation, redirect rejection, and bounded JSON parsing. These are source-level observations, not a complete SMM wallet/provider acceptance test.
- PR #248 head `5beb4aac30393617a246a99932e95857651be4ab` has focused passing CI evidence recorded above. A documentation-only audit commit `3f228e979546ab920ccd790abd92e5b87f51aef8` was added to the PR branch and verified by fetching the exact file back. No workflow runs or combined statuses were returned for that documentation commit at the time of check, so it has no new exact-head CI certification.

This updates the prior SMM deployment observation: the currently fetched live function is v10, not the previously documented v8/v6 snapshots. The broader production release remains blocked by unresolved historical replay provenance and other unverified acceptance gates.


## Security-advisor refresh — 2026-10-14 05:11 UTC

Read-only Supabase security advisors were queried for project `moyhiluyhjsujhwlyeuu`. Findings below are triage signals, not proof that every flagged policy is exploitable; policy expressions and function bodies must be reviewed before changing grants or RLS.

- **RLS enabled with no policy (1):** `public.digital_page_payment_events`. This normally means API roles have no policy-authorized rows; inspect intended service/backend access and payment-event processing before adding any policy. Remediation guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- **SECURITY DEFINER callable by anon (1):** `public.get_mnty_targeted_advertisements(...)`. Review whether public invocation is intentional, ensure location/targeting inputs cannot expose restricted campaign data, and add appropriate bounds/rate controls if needed. Do not revoke blindly before tracing public ad delivery. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- **SECURITY DEFINER callable by authenticated (40):** advisor flagged 40 functions. Audit each function's internal authorization, tenant/business/platform scope, actor-ID binding, and financial side effects. This warning alone does not establish a vulnerability; do not bulk-revoke EXECUTE because some functions may be intended authenticated RPCs. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- **Anonymous-role policy warnings (90 tables):** advisor output flags policies on 90 tables/storage objects as applying to anonymous users. These may reflect role targeting rather than a confirmed bypass; inspect each policy's USING/WITH CHECK expressions, especially finance, payment, tenant, CRM/marketing, notification/push, SMM wallet/orders, and ride tables. Prioritize verifying that any policy meant for signed-in users excludes `anon`; do not mass-edit policies without negative tests. Guidance: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins
- **Leaked-password protection disabled (1):** Supabase Auth advisor reports compromised-password checks are disabled. The product's current primary sign-in flow is email OTP, so verify actual Auth configuration and whether password sign-in is enabled before selecting remediation; do not change Auth settings in production during this audit. Guidance: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Deployment-workflow clarification

The workflow for documentation commit `d49ba7707b7e7aae839615038cfe9baeda6595f5` completed with overall conclusion `success`, but the job-level evidence shows `validate = success` and `deploy = skipped`. Therefore this is **not** evidence of a new production deployment or release certification. Existing exact-head focused tests are useful but do not close chronological migration replay, tenant-isolation, payment/finance E2E, backup/restore, Edge Function contract, or Auth configuration gates.

No production SQL, RLS/grant changes, Auth setting changes, Edge Function deployment, or financial writes were performed during this refresh. Release remains **BLOCKED / NOT CERTIFIED**.


## Focused live authorization-source review — 2026-10-14

A read-only catalog query confirmed these live SECURITY DEFINER RPC grants and source configuration:

| RPC | `anon` EXECUTE | `authenticated` EXECUTE | Live authorization observation |
|---|---:|---:|---|
| `get_mnty_targeted_advertisements(...)` | Yes | Yes | Public ad-discovery path; function filters to active/approved/in-date ads and clamps limit to 1–50. Still requires a reviewed public-data contract; do not revoke anon blindly. |
| `get_mantigo_admin_financial_report_backend(...)` | No | Yes | Live body checks `auth.uid() = p_admin_user_id`, then accepts generic active membership roles such as OWNER/ADMIN/OPERATIONS and aggregates across the entire `mantigo_financial_ledger` without a platform-scope guard. **P0 cross-scope financial disclosure risk.** |
| `settle_mantigo_captain_backend(...)` | No | Yes | Live body checks caller ID and a broad active membership role list, then mutates platform-wide ledger/journal/audit state; no `mnty_can_platform_admin()` call in the live definition. **P0 cross-scope financial mutation risk.** |
| `accept_mantigo_bid_backend(...)` | No | Yes | SECURITY DEFINER; per-function authorization must be reviewed before classifying the advisor warning as exploitable. |

The source-only candidate `supabase/migrations/20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql` already exists on this recovery branch and replaces the two MantiGO global RPC guards with `mnty_can_platform_admin()`, requiring an active `SUPER_ADMIN` membership in `MNTY-PLATFORM` with explicit platform scope/full-control permissions. Its original boolean cast is hardened by the separate RC462 candidate to avoid malformed permission strings throwing. However, **the live migration ledger still ends at RC424**; RC449/RC462 are not proven applied in production. Do not claim these fixes are live.

The RC449 source has a static/integration contract in `scripts/validate-mantigo-platform-admin-scope.mjs` and `supabase/tests/rc449_mantigo_platform_admin_integration.sql`. Next verification must run these against a disposable database with tenant OWNER/ADMIN/OPERATIONS_MANAGER denial cases and explicit platform SUPER_ADMIN allow cases, then rerun chronological migration replay from a clean database. Do not apply RC449/RC462 directly to production to bypass the migration chain.

This live function-definition review strengthens the release decision: **P0 remains open until scope enforcement is proven in the actual production definitions or safely applied through the reviewed migration pipeline, with negative tests and evidence.** No production changes were made.


## RLS policy spot-check — marketing and anonymous-session semantics

A read-only `pg_policies` review of finance, notifications, push, SMM-wallet, storage, and marketing tables refined the 90 Supabase `auth_allow_anonymous_sign_ins` notices:

- Several reviewed policies explicitly target role `authenticated` and check `auth.uid()`; the advisor notices are therefore not equivalent to 90 grants to the raw database role `anon`. The notices are consistent with Auth anonymous sessions being enabled, which can assume the `authenticated` database role. Some tables have explicit `auth.jwt()->>'is_anonymous'` guards and others do not. Keep this as a real configuration/policy review gate, not a claim that all 90 tables are exploitable.
- **Confirmed scope defect in the live policy text:** `marketing_leads` policy `CRM managers view marketing leads` accepts any active membership with role SUPER_ADMIN/ADMIN/OWNER/MANAGER/BUSINESS_OWNER and does not bind that membership to the lead's business/tenant. The equivalent `CRM managers view marketing providers` policy also lacks business/tenant matching. These allow broad cross-tenant visibility for qualifying members unless another control outside these policies intervenes.
- Existing source-only candidate `supabase/migrations/20261010210000_rc452_marketing_crm_tenant_scope.sql` replaces these policies with business/tenant membership matching and explicit platform-scope SUPER_ADMIN handling, and restricts provider-profile ownership changes to the owner's membership scope. This is **candidate source, not production state**; the live migration ledger remains RC424.
- The `marketing_services_admin_manage` policy also uses a broad active membership role check without an explicit tenant/business scope. It requires a separate reviewed correction or proof that this table is intentionally platform-global; RC452 does not by itself close that policy.
- Reviewed examples for `payment_intents` and `wallet_transactions` are tenant-bound to `um.tenant_id = row.tenant_id`; `mantigo_financial_ledger`, `notifications`, `push_subscriptions`, `smm_wallets`, and `smm_wallet_transactions` owner-read policies bind rows to `auth.uid()`. These spot-checks are not a complete tenant-isolation certification.

Remediation priority: review the live Auth anonymous-sign-in setting without changing the configured email-OTP flow; add disposable-database negative tests for anonymous-session access and cross-tenant marketing reads/writes; verify RC452 and the MantiGO scope candidates in clean chronological replay before any production change.


## Latest exact-head CI refresh — 2026-10-14 05:13 UTC

The current PR #248 head was rechecked after the latest documentation update:

- Current head: `b7b656f40acbf4aa8c0f24b306da929403491a08`.
- [RC462 isolated PostgreSQL malformed-permission regression](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440025): **PASS**. This proves the RC441+RC462 disposable fixture denies malformed-string and boolean-false permissions without an exception, and permits the exact valid boolean true case in that fixture. It does not prove RC462 is deployed to production.
- [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440010): **PASS**.
- [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440017): **PASS**.
- [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440015): **PASS**.
- [Module professionalization](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440058), [backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440093), [MantiGO open-ride privacy](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440004), and [approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440016): **PASS**.
- [Pages/deployment workflow](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38515440062): validation **PASS**, deployment **SKIPPED** by the release gate.

These checks are now attached to the exact current PR head, but they are focused CI checks. They do not close the live P0 MantiGO authorization issue, live marketing RLS scope issue, chronological migration replay, real tenant-isolation E2E, payment/finance E2E, Auth configuration, backup/restore, or deployed function parity. The PR remains Draft and unmerged. No production changes were made.

## Security follow-up — RC526 shared marketing catalogue and exact-head CI

Implementation commit under test: `099240b92bc66b4772a01a9d0d7c24a1ba8140e3` (2026-10-14).

- Restored `supabase/migrations/20261010210000_rc452_marketing_crm_tenant_scope.sql` byte-for-byte to the version on `main`; do not edit applied/established migration files.
- Added forward-only candidate `supabase/migrations/20261015010000_rc526_marketing_services_platform_scope.sql`. Because `marketing_services` is a shared catalogue without tenant/business key columns, its write policy now requires an active `SUPER_ADMIN` membership in `MNTY-PLATFORM`, `scope=PLATFORM`, and exact `full_control=true`. Anonymous Auth sessions are denied writes. Public reads of active catalogue services remain controlled by the separate public-read policy.
- Extended the disposable PostgreSQL RC452 integration fixture to apply RC526 and assert tenant-manager write denial, anonymous-session write denial, and platform-admin write success. Fixed a test-fixture delimiter defect discovered from CI logs; no production schema was changed.
- Exact-head checks on commit `099240b92bc66b4772a01a9d0d7c24a1ba8140e3`:
  - [Marketing CRM tenant/business scope + RC526 PostgreSQL integration](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874768): **PASS**.
  - [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874944): **PASS**; confirms the prior RC452 migration is restored and RC526 is forward-only.
  - [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581875083): **PASS**.
  - [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874632): **PASS**.
  - [RC462 malformed-permission regression](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874688): **PASS**.
  - [MantiGO open-ride privacy](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874798), [approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874493), [backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874505), and [module professionalization](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874674): **PASS**.
  - [Pages/deployment workflow](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38581874542): validation **PASS**, deploy **SKIPPED** by the release gate.
- These are candidate migration/source and disposable-fixture results only. RC526 is **not applied to production**. The live migration ledger still needs fresh verification; the known chronological replay gaps and P0 MantiGO financial authorization risks remain release blockers. No production database, Auth configuration, Edge Function, financial records, or deployment was changed.

## Exact-head CI confirmation — 2026-10-14 14:36 UTC

PR #248 head verified through the GitHub API: `553a53121bc6326f9846eccb066c03cb7c261b5b`. All listed checks below completed successfully on that exact head:

- [Marketing CRM tenant/business scope and RC526 PostgreSQL integration](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069949): **PASS** (both source validator and disposable PostgreSQL integration).
- [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069956): **PASS**.
- [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069848): **PASS**.
- [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069972): **PASS**.
- [RC462 malformed-permission PostgreSQL regression](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582070295): **PASS**.
- [MantiGO open-ride privacy](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582070369), [approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069806), [backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582070026), and [module professionalization](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069955): **PASS**.
- [Pages/deployment workflow](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38582069912): validation **PASS**, deployment **SKIPPED** by the release gate.

The earlier failed run on commit `be9bab11bbf25792bd512c893646b7338808585a` is superseded by the corrected latest head; the failure exposed an attempted edit to the established RC452 migration and SQL fixture defects. RC452 was restored to match `main`, and the shared-catalogue change was moved into the forward-only RC526 migration. Do not count the failed run as a current-head failure, but retain it as remediation history.

**Release remains BLOCKED / NOT CERTIFIED.** These passing checks validate focused source contracts and isolated PostgreSQL behavior, not production application of RC526/RC462/RC449, clean chronological migration replay, the live P0 MantiGO financial authorization findings, full tenant-isolation E2E, payments/finance E2E, Auth configuration, backup/restore rehearsal, or deployed function parity. No production changes were made.

## Read-only MantiGO SECURITY DEFINER contract — 2026-10-14

The read-only SQL contract in `scripts/verify-mantigo-high-risk-definers.sql` was improved on the recovery branch:

- Signature matching now normalizes PostgreSQL's argument-type spacing instead of using `pg_get_function_identity_arguments`, which includes argument names and caused valid functions to be incorrectly reported as `MISSING`.
- The contract explicitly allows an empty `search_path` only for the five RPC/guard functions covered by RC449, provided source review confirms non-system references are schema-qualified. This avoids treating the hardened `SET search_path = ''` pattern as a false failure after a future approved migration.
- Executed the equivalent read-only grant/search-path check against live production. All 11 expected SECURITY DEFINER signatures matched, had `anon EXECUTE = false`, `authenticated EXECUTE = true`, and passed the current search-path contract. This is a privilege/search-path check only; it is **not** authorization certification.
- A separate fresh live function-definition query still confirms production `mnty_can_platform_admin()` delegates to `mnty_can('admin', NULL, NULL, NULL)`, and live financial report/settlement RPCs still use broad active-membership role checks. The P0 MantiGO cross-scope authorization risk remains **OPEN** because RC449/RC462 are candidate migrations and the live migration ledger still ends at RC424.

No production SQL was changed. The read-only contract's live result does not close the P0 gate.

## Fresh production read-only check — MantiGO guard still unapplied

Read-only Supabase verification on 2026-10-14 after the passing candidate CI confirms the live project remains behind the recovery branch:

- The production migration ledger still ends at `20261008222845 / rc424_atomic_digital_page_payment_webhook`; RC449, RC462, and RC526 are not shown as applied.
- Live `public.mnty_can_platform_admin()` still delegates to `public.mnty_can('admin', null, null, null)` and has `search_path = public, pg_temp`, not the explicit platform-scope implementation in RC449/RC462.
- Live `get_mantigo_admin_financial_report_backend` still authorizes broad active membership roles (including tenant OWNER/ADMIN/OPERATIONS) and aggregates the platform-wide `mantigo_financial_ledger` without calling `mnty_can_platform_admin()`.
- Live `settle_mantigo_captain_backend` still authorizes broad active membership roles and reaches platform-wide settlement without calling `mnty_can_platform_admin()`.
- Both finance RPCs deny `anon` EXECUTE but allow `authenticated` EXECUTE. This does not cure the authorization gap inside the functions.

These are catalog/function-definition observations, not a live exploit attempt. They reaffirm the **P0 release blocker**. Do not apply RC449/RC462/RC526 or any other migration until the full chronological replay and reviewed migration bundle pass, and a separately approved production migration window exists. No production changes were made.


## Exact-head CI refresh — 2026-10-14 16:08 UTC

The latest PR #248 head `49cb770b8922368f6cd82fa218deb200ea607bb6` was checked through the GitHub Actions API. The following focused checks completed successfully on that exact head:

- [Marketing CRM tenant scope](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302436): **PASS**, including disposable PostgreSQL tenant-scope integration and source validation.
- [MantiGO platform-admin scope hardening](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302438): **PASS**, disposable PostgreSQL behavioral job.
- [RC462 malformed-permission regression](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302603): **PASS**, malformed string denies without exception; boolean false denies; explicit boolean true allows.
- [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302902): **PASS**.
- [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302777): **PASS**.
- [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302963): **PASS**.
- [MantiGO open-ride privacy boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302914): **PASS**.
- [Approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595303051): **PASS**.
- [Backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302532): **PASS**.
- [Module professionalization validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302617): **PASS**.
- [Pages/deployment workflow](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595302542): validation **PASS**, deployment **SKIPPED** by the release gate.

These results certify only the listed candidate source checks and disposable PostgreSQL tests. They do not certify a clean chronological replay, nor do they change the live production migration ledger. The production P0 MantiGO financial authorization gap remains open until the reviewed forward-only migration bundle is replayed, approved, and applied in a separately authorized window. The historical dependencies for the clean replay also remain unresolved. PR #248 remains open and Draft; do not merge or deploy based on these focused passes.

No production database, Auth, Edge Functions, secrets, customer records, financial records, or deployed website were changed by this verification.


## Follow-up exact-head CI — 2026-10-14 16:12 UTC

The report-only commit `7fc56cf676efdfa3c54bb6a3183a03fc39949bda` was checked after GitHub Actions completed. All relevant focused checks on that exact head succeeded:

- [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926000): **PASS**.
- [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926196): **PASS**.
- [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926202): **PASS**.
- [RC462 malformed-permission regression](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926256): **PASS**.
- [Marketing CRM tenant scope](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926009): **PASS**.
- [MantiGO platform-admin scope hardening](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926667): **PASS**.
- [MantiGO open-ride privacy boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595925970): **PASS**.
- [Approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926071): **PASS**.
- [Backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926628): **PASS**.
- [Module professionalization](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926028): **PASS**.
- [Pages/deployment workflow](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38595926080): validation **PASS**, deployment **SKIPPED** by the release gate.

The successful run set confirms focused candidate tests only. It does not resolve the missing historical dependency source, certify chronological replay, or close the read-only live P0 MantiGO authorization finding. PR #248 remains Draft and unmerged. No production changes were made.


## Additional read-only ledger-source search — 2026-10-14 17:48 UTC

A targeted read-only query searched the production `supabase_migrations.schema_migrations.statements` arrays for:

- creation SQL for `public.counter_offer_indrive_bid` (including `CREATE FUNCTION` and `CREATE OR REPLACE FUNCTION` forms);
- `CREATE TABLE` statements for `public.credit_accounts`;
- `CREATE TABLE` statements for `public.marketing_project_participants`.

All three searches returned zero matching migration rows. This confirms that the queried production migration statement arrays did not provide the missing original DDL. It does **not** prove the objects were never created or that no trusted backup/repository artifact contains their source. The live function/catalog remains distinct from historical source provenance.

Consequently, no historical baseline was fabricated, no migration was skipped, and no SQL was applied. Next source recovery should focus on a trusted database backup/export or an authoritative deployment/repository artifact that contains the original migration body. If that cannot be found, request a separate, narrowly scoped approval for a clearly labelled disposable-only baseline; do not put such a fixture under `supabase/migrations/` or imply it is recovered history.


## Additional historical-source cross-check — 2026-10-14 20:50 +03:00

A targeted read-only cross-check was performed against the two S04 replay branches, `fix/s04-replay-normalization-20261013` and `s04/migration-chain-clean-replay-20261013`, and the divergent `fix/replay-marketing-project-baselines-20261013` branch.

- The revoke migration `supabase/migrations/20260927095000_revoke_unused_security_definer_execute.sql` has the same blob SHA `8d3fb7330680056b45b4992d298ce1363f069e9d` on all three branches. It still references `public.counter_offer_indrive_bid(uuid,uuid,numeric)` without its original creation DDL being recovered in those branches.
- The test-only `supabase/tests/baselines/legacy_security_definer_functions.sql` exists on the divergent marketing-baseline branch with blob SHA `ed4270f8fbfa2881fbfd6b251161ec4cbe7fd2c7`, but is absent from both S04 replay branches. Its header identifies it as a live-derived disposable fixture, explicitly not historical creation DDL. This does not close provenance or authorize importing it into PR #248.
- Targeted GitHub code search for `counter_offer_indrive_bid`, `credit_accounts`, and `20260927074160` did not find an authoritative creation migration. The `credit_accounts` search only surfaced a later policy-alteration migration, not a CREATE TABLE source.

This narrows the next action: preserve the historical revoke migration unchanged and keep the replay gate blocked until an approved historical source or a separately approved test-only baseline is available. Do not transplant the divergent branch wholesale; it remains a separate, large change set requiring independent review.

No production changes were made during this source cross-check.
