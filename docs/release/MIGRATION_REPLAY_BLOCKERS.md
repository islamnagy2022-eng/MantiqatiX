# Migration Replay Blockers — 2026-10-11

## Status

**BLOCKED — do not apply the post-RC424 batch to production.**

The production migration ledger currently ends at `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). A read-only exact comparison of `supabase_migrations.schema_migrations.statements[1]` against `supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql` returned `exactMatch=true`, with both values exactly 7,208 bytes. RC424 source/ledger statement identity is VERIFIED despite the different filename timestamp. Preserve the applied ledger version `20261008222845`; document source filename timestamp `20261009010000` as a legacy alias and do not rename or rewrite applied history.

The full disposable Supabase replay is still BLOCKED at the historical-schema preflight. The latest exact-head attempt [run 38142160896](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38142160896) failed before starting Supabase services or executing the migration chain. The owner has since explicitly approved the documented `public.smm_provider_credentials` snapshot as a baseline for an isolated test/replay environment only; this approval does not authorize production changes.

## Read-only production schema evidence

A read-only catalog query against Supabase project `moyhiluyhjsujhwlyeuu` returned the following definition for `public.smm_provider_credentials`:

| Column | Type | Nullable | Default |
|---|---|---:|---|
| `provider_id` | `uuid` | No | — |
| `api_key_ciphertext` | `text` | Yes | — |
| `configured` | `boolean` | No | `false` |
| `updated_at` | `timestamptz` | No | `now()` |

Constraints and security metadata:
- Primary key: `(provider_id)`.
- Foreign key: `provider_id REFERENCES public.smm_providers(id) ON DELETE CASCADE`.
- Index: `smm_provider_credentials_pkey`, unique B-tree on `provider_id`.
- Owner: `postgres`; RLS enabled; FORCE RLS disabled.
- This table stores encrypted provider credentials. Do not add direct client access or expose its ciphertext.

## Why this does not resolve the blocker

The catalog results establish the current live table shapes and security metadata, but do not recover the original historical creation migrations or prove how production rows were populated. The owner has now approved both production-derived schema snapshots for disposable replay only, resolving the test bootstrap dependency without inventing a provider schema. The baselines remain outside `supabase/migrations` in committed source and are copied into the temporary CI workspace only.

Do not invent a backdated production migration, rewrite applied history, bypass historical migrations, or apply either test baseline to production. The baselines are schema-only and contain no provider records, API URL values, credential ciphertext, or other production rows.

## Required next steps

1. Re-run the complete repository migration chain on disposable Supabase/PostgreSQL from an empty database with both approved schema baselines injected in timestamp order.
2. Verify final schema, constraints, RLS, grants, functions, indexes, and migration ledger against read-only production evidence.
3. Fix the currently failing SMM wallet/provider safety contract, then rerun the exact-head integration suite.
4. Test rollback/data-preservation and staged deployment plans only after clean replay and all acceptance tests pass.

No production schema, data, grants, RLS, secrets, Edge Functions, wallet balances, or payments were changed during this investigation.


## Latest continuation — 2026-10-11

- Recovered the missing post-RC424 SQL integration fixtures referenced by `module-professionalization.yml` into the migration-recovery branch. The previously failing exact-head workflow had stopped at missing fixture files before running SQL; the next run is required to confirm the tests execute rather than merely pass static checks.
- Updated the candidate source for `payment-intent`, `paymob-webhook`, `digital-page-payment-intent`, and `mantigo-payment-intent` from the existing review branch, restoring provider-order correlation, retryable handling of incomplete provider responses, and atomic webhook RPC paths expected by the committed order-binding contract. Added server-side ERP purchase-order create/line functions required by the staged UI. These are source-only changes and have not been deployed.
- Adjusted the financial-journal static validator to accept the actual safe Bearer-token flow: require the Bearer prefix, then validate the extracted token through Supabase Auth. The previous validator incorrectly required a local variable named `token` even though the handler safely passes `authorization.slice(7).trim()`.
- Exact-head GitHub Actions for `0dca6c86f109a6c67d38f34932165e3871b572e8` were queued at the time of this note. Earlier runs showed RC434 and RC437 disposable PostgreSQL integration jobs passing; payment order-binding checks failed before the function-source refresh and must be re-evaluated on the new head.
- The full disposable Supabase replay remains NOT VERIFIED. Run `38135821672` failed while starting Supabase services (Docker image registry/service startup), before the full replay step; a retry was requested. The documented earlier historical migration blocker concerning `smm_provider_credentials` still requires authoritative original DDL and must not be bypassed by pre-seeding a test table or inventing a backdated migration.
- No production migrations, Edge Function deployments, grants/RLS/Auth changes, wallet mutations, payments, or customer-data writes were performed.


## RC424 statement parity confirmation — 2026-10-11

A direct read-only query of the production migration ledger returned the full statement for version `20261008222845`. Its exact text matched the source file `supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql` byte-for-byte: **7,208 bytes in each, exactMatch=true**. This resolves the RC424 source/ledger identity question as a legacy filename timestamp alias. It does not resolve the missing legacy `smm_provider_credentials` creation DDL or prove post-RC424 migrations are applied.


## Applied-ledger source search — 2026-10-11

A read-only search of `supabase_migrations.schema_migrations.statements` for `smm_provider_credentials` returned only:
- `20260927074210 / harden_smm_table_api_privileges`: revokes client privileges on the table; it does not create it.
- `20260929203603 / explicit_deny_policies_for_unexposed_sensitive_tables`: creates a deny-all client policy on the existing table; it does not create it.

Together with the repository migration scan and current catalog evidence, this confirms that the applied migration ledger available to this project does not contain the original table-creation statement. Do not infer that the table was created by either of these migrations. The original DDL must be recovered from an authoritative external/repository-history source or replaced by an explicitly owner-approved, separately versioned schema baseline before replay can proceed.

## Additional ERP authorization review — 2026-10-11

- RC458 review found that the purchase-order status RPC selected `v_role` from any active business membership before branch/organization filtering. A privileged role in one branch could elevate a lower-privilege membership in another branch. The query now selects the transition role only from branch/organization-compatible memberships.
- RC458 integration coverage now includes the cross-branch role-escalation negative case and preserves the existing `PURCHASING` role for scoped receiving.
- Exact-head CI is pending for the latest candidate commit; these changes are not yet marked PASS. Full release remains blocked on the historical SMM DDL and full migration replay.


## Exact-head validation results — commit `831265d188af50281d2faa8aaa407edb3fdbb616`

- Module Professionalization Validation: **PASS**, all 16 jobs completed successfully, including RC434 receiving, RC437 order-line caps, RC458 branch/organization scope, RC436/RC450/RC457 financial journal integration, Paymob atomicity, digital-page payment binding, subscription intent, SMM wallet idempotency, checkout recovery, platform-admin scope, security-definer search path, targeted ads, and matrimony privacy. Evidence: [run 38138919540](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138919540).
- Backend-only Module Boundary: **PASS** [run 38138919560](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138919560).
- MantiGO Open Ride Privacy: **PASS** [run 38138919656](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138919656).
- Pages validation: **PASS** [run 38138922748](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138922748); the deploy job was **SKIPPED** because this is a pull-request validation, not a production deployment.
- Migration version uniqueness, migration history immutability, open-PR migration collision guard, and approval-action audit PostgreSQL integration: **PASS** [runs 38138922783](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138922783), [38138922806](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138922806), [38138922776](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138922776), and [38138922771](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138922771).
- Full disposable migration replay: **BLOCKED**, fail-closed at `Fail closed if the historical schema baseline is missing` [run 38138919577](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38138919577). This is an expected release blocker, not a passing replay.
- These results verify the candidate source/tests at the cited commit only. No migration was applied to production and no Edge Function was deployed. Release remains **NOT CERTIFIED**.


## Owner approval and exact production-derived baselines — 2026-10-11

- Owner instruction: “اعتمد المصدر عندك مصدر فعلي”. Interpreted narrowly as approval to use the observed live `public.smm_providers` schema as an actual source for a **test-only baseline**, not as permission to alter production or rewrite history.
- Read-only catalog introspection confirmed `smm_providers`: UUID PK, unique `name`, the nine observed columns/defaults, RLS enabled, `FORCE RLS` disabled, policy `deny_direct_access_authenticated` (`authenticated`, `USING false`, `WITH CHECK false`), no non-internal triggers, and `service_role` grants limited to `REFERENCES`, `TRIGGER`, `TRUNCATE` in the observed table-grant view.
- Added `supabase/tests/baselines/smm_providers.sql` with the observed schema only; no provider rows or `api_url` values were queried or copied. Existing approved credentials baseline remains schema-only and references the provider table with `ON DELETE CASCADE`.
- Updated `scripts/validate-historical-schema-baseline.mjs` to validate both snapshots, test-only provenance, RLS/policies/grants, dependency order, and to fail closed if guessed production creation migrations or conflicting temporary files appear.
- Updated `.github/workflows/migration-chain-replay.yml` to inject provider baseline `20260927074158` followed by credentials baseline `20260927074159` into the disposable CI workspace only. Neither temporary migration is committed under `supabase/migrations`.
- Prior replay run [38153774338](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38153774338) failed at the old preflight before these latest commits. It is not evidence for or against the updated baseline flow; a new exact-head run must pass before replay is considered verified.
- The latest previously observed module-professionalization run [38153777787](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38153777787) passed the general validator and most integration jobs but **failed `smm-wallet-integration`**. This independent release blocker remains open.
- Production remains untouched. Release remains **BLOCKED / NOT CERTIFIED** until the new full replay and all security/integration/release gates pass.


## SMM gateway safety contract — exact-head run 38154557541

The `smm-wallet-integration` job failed in the source-safety validator on the candidate `supabase/functions/smm-gateway/index.ts`. The RC432 SQL idempotency integration itself passed, and the SMM service-role boundary validator passed; these do not prove provider-call runtime safety.

Failed checks observed in job log (15):

1. Provider call has bounded timeout (`call()` currently invokes `fetch()` without `AbortSignal.timeout`).
2. Network/HTTP ambiguity has a typed non-definitive error.
3. Ambiguous provider outcomes require reconciliation.
4. Ambiguous provider outcomes never auto-refund.
5. Refund branch requires explicit provider rejection.
6. Accepted provider order is persisted conditionally (must only transition from `SUBMITTING`).
7. Provider accepted but local persistence failed is not auto-refunded.
8. Missing provider order ID is treated as ambiguous, not a definitive rejection.
9. Admin UI visibility is derived from backend authorization.
10. Wallet debit RPC ambiguity does not trigger automatic refund.
11. Terminal order statuses cannot be downgraded by provider polling.
12. Wallet RPC results are checked, including boolean `false`.
13. Admin credit uses a stable retry idempotency key.
14. Admin wallet credit validates a finite positive amount.
15. SMM gateway requires a live authenticated session token.

The source presently refunds on any exception thrown after provider submission, including network failures and missing order IDs; it ignores the result of the conditional order update, does not protect terminal states during status polling, and does not enforce a provider-call timeout. These are financially material failure modes. Do not weaken the validator or mark these checks as waived. Implement changes only through an authorized, reviewed source-change path, then add targeted tests for timeout, lost-response ambiguity, missing provider order ID, persistence failure after provider acceptance, refund idempotency, stale status polling, and invalid admin-credit amounts.

Run evidence: [Module Professionalization Validation 38154557541](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38154557541). Exact job: `smm-wallet-integration`; failing step: `Run migration tests inside disposable PostgreSQL service` (SQL RC432 passed before source-safety validation failed).

Production remains untouched. The gateway source has not been changed in this continuation, and SMM runtime safety remains **NOT VERIFIED**.

### Additional source inspection: admin UI authorization mismatch

Read-only inspection of `web/smm.js` confirmed that `load()` directly queries `public.user_memberships` from the browser and sets `isAdmin` when any active membership role is `OWNER`, `ADMIN`, or `SUPER_ADMIN`. This differs from the stricter backend gate in `smm-gateway/index.ts`, which accepts explicit `smm_admins` entries or a platform-scoped `SUPER_ADMIN` membership with `tenant_id=MNTY-PLATFORM`, no `business_id`, `permissions.scope=PLATFORM`, and `permissions.full_control=true`. The backend still checks authorization for admin actions, so this is not evidence that the browser alone can authorize privileged writes; it is an inconsistent client-side visibility/data-access contract that should be removed by deriving admin visibility from a server response such as the authenticated `my_data` response.

Also observed: the UI performs direct browser reads of `smm_services`, `smm_orders`, `smm_wallets`, and `user_memberships`, while the gateway already defines `catalog` and `my_data` routes. Before rollout, reconcile the UI with the gateway contract and verify RLS/tenant scope for each direct read. The current static validator correctly flags the membership lookup, but its `action:'admin_access'` expectation should be reviewed because the gateway's current response contract is `my_data` with an `is_admin` field; tests must assert a consistent real contract rather than a string pattern that does not exist in the implementation.

Do not weaken the backend authorization rule to match the broad client-side role check. The safe direction is to make the UI consume the backend's narrower decision and add tests proving a branch/business-scoped admin is not exposed as a platform admin.

## Repository release-control check — 2026-10-11

Read-only GitHub API inspection returned `main.protected=false` and an empty repository rulesets list. This means the current evidence does not show an enforced branch-protection/ruleset policy for the production branch. Treat this as a release-governance blocker: repository administration must configure required PR reviews, required status checks for the release gates, and restrictions on direct pushes/force pushes before production release. This workflow did not change repository settings. Recheck the active protection/ruleset state after an administrator configures it.

## Live SMM gateway deployment parity — read-only confirmation 2026-10-11

Supabase's read-only Edge Function inventory and source retrieval confirm production `smm-gateway` is ACTIVE at version 6, updated `2026-09-28T07:42:47Z`, deployed source SHA-256 `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`. Its supported action list is `configure_provider`, `sync_services`, `provider_status`, `admin_credit`, `admin_data`, `set_price`, `place_order`, and `order_status`. It does **not** implement the candidate source's `catalog` or `my_data` actions, and it lacks the required timeout/ambiguous-outcome safety constructs. The candidate source in PR #207 is a different implementation and must not be treated as deployed.

Production `erp-purchase-receive` remains ACTIVE at version 1, last updated `2026-09-26T21:54:23Z`; source parity and atomic RPC behavior remain unverified. The current deployment parity gate remains NOT VERIFIED. No Edge Function was deployed or changed during this read-only check.

Do not deploy the candidate gateway simply to resolve parity: its current source fails the SMM wallet/provider safety contract. First resolve the source-safety failures and the UI/backend action-contract mismatch, pass the exact-head tests, then plan a staged rollout with rollback evidence and explicit release approval.

## Supabase Security Advisor snapshot — 2026-10-11 16:20 UTC

Read-only `get_advisors(type=security)` returned 94 advisor entries: 93 WARN and 1 INFO, totaling 133 reported finding instances. The repeated entries are table/function-specific findings and should not be described as 133 confirmed exploitable vulnerabilities without individual review.

Observed categories:
- 90 table-specific `auth_allow_anonymous_sign_ins` warnings: RLS policies on those tables include roles that can include anonymous sessions. Review each policy against intended public-read use and verify `anon` versus Supabase Auth's `authenticated` role semantics; do not blindly revoke public discovery that is intentional.
- 40 `authenticated_security_definer_function_executable` warnings: review each SECURITY DEFINER function's body, caller identity checks, argument trust, `search_path`, and EXECUTE ACL. Presence of the warning alone does not establish a vulnerability, but caller-supplied actor IDs in a privileged function require particular scrutiny.
- 1 `anon_security_definer_function_executable` warning for `public.get_mnty_targeted_advertisements(...)`; this appears to be an intentional public ad-discovery endpoint, and RC451 intentionally preserves its public EXECUTE boundary while hardening its search path. Verify the live search path and function body before clearing the warning.
- 1 `auth_leaked_password_protection` warning: leaked-password protection is disabled and must be enabled/verified as part of the Auth release gate.
- 1 INFO finding: `public.digital_page_payment_events` has RLS enabled without policies; confirm this is intentional deny-by-default behavior and not a missing service workflow policy.

Advisor remediation reference for anonymous RLS findings: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins. SECURITY DEFINER ACL guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable. Leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

No changes were made from this advisor read. The existing release manifest remains fail-closed until the SECURITY DEFINER ACL review, RLS policy audit, leaked-password protection, and live targeted-ad search-path gates are backed by evidence.

## P0 live MantiGO platform-scope finding — read-only function review 2026-10-11

Direct read-only `pg_get_functiondef` inspection of the live database confirms that the applied `public.settle_mantigo_captain_backend` SECURITY DEFINER function authorizes any active membership whose role is in `ADMIN`, `SUPER_ADMIN`, `OWNER`, `BUSINESS_OWNER`, `ACCOUNTANT`, `FINANCE_MANAGER`, or `FINANCE`, without requiring platform scope, then can settle a completed ride in the global MantiGO ledger. The live `public.get_mantigo_admin_financial_report_backend` similarly accepts broad roles from any active membership and returns aggregate data across the full MantiGO financial ledger. Live `public.mnty_can_platform_admin()` delegates to `mnty_can('admin', NULL, NULL, NULL)`, which does not express an explicit platform-only boundary.

This is a concrete cross-tenant/platform-authorization risk, not merely an advisor warning. The repository contains candidate RC449 migration `20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql`, which changes the helper to require an active `MNTY-PLATFORM` `SUPER_ADMIN` membership with `permissions.scope='PLATFORM'` and `permissions.full_control=true`, and applies that boundary to the platform-wide dashboard, financial report, settlement, and config RPCs. The candidate integration coverage exists, but production's migration ledger still ends at RC424, so RC449 is **not proven applied to production**.

Required action: keep release blocked; run the candidate RC449/RC449a and related scope tests in disposable PostgreSQL, review the exact SQL/ACLs, then apply through the approved staged migration pipeline only after full replay and explicit production change approval. Do not hot-edit the live functions in this continuation. Verify after rollout that business-scoped administrators are denied and only the explicit platform administrator can read global reports, change financial config, or settle MantiGO captains.

## Historical function bootstrap blocker — replay run 38154806199

The new disposable replay successfully started Supabase, injected the two approved schema-only SMM baselines in timestamp order, and passed the exact-copy/untracked/no-row-import check. The chronological replay then failed at `20260927095000_revoke_unused_security_definer_execute.sql` because `public.counter_offer_indrive_bid(uuid,uuid,numeric)` does not exist at that point in a clean database. The same migration attempts to revoke execution from nine additional legacy function signatures: `fashion_erp_mutate(text,jsonb,text)`, `mantigo_accept_bid(text,text)`, `mantigo_cancel_ride(text)`, `mantigo_create_ride(text,text,text,text,numeric,text)`, `mantigo_rate_ride(text,integer,text)`, `mantigo_submit_bid(text,numeric,text,text,text,text)`, `mantigo_update_proposed_price(text,numeric)`, `restaurant_erp_mutate(text,jsonb,text)`, and `restaurant_table_mutate(text,jsonb,text)`.

Read-only production inspection confirms `counter_offer_indrive_bid(uuid,uuid,numeric)` exists in the live database as a SECURITY DEFINER function, but `anon` and `authenticated` have no EXECUTE privilege. A search of the production migration ledger's stored statements found no historical statement referencing this function; repository code search found the name only in the early revoke migration, while other legacy definitions are either missing or appear in later-timestamp migrations. Thus the clean replay is exposing an additional historical bootstrap gap, not a problem caused by the SMM table baselines.

Do not create placeholder functions, backdate a production migration, or skip the revoke migration. The safe next step is to recover authoritative creation DDL/history for all ten legacy signatures or obtain explicit approval for a separate **test-only function baseline** sourced from read-only live definitions and isolated to disposable replay. The prior approval covers only the two SMM table schema baselines and must not be silently expanded to privileged function definitions. Once authoritative DDL or explicit approval is available, add a validator for these pre-existing function dependencies and rerun the full chain.

Evidence: [disposable replay run 38154806199](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38154806199). Supabase stopped before `supabase db reset` could complete; no production migration was applied.

### Fail-fast preflight added and verified — run 38155389904

To avoid repeatedly booting Supabase only to hit the same historical dependency gap, `scripts/validate-historical-schema-baseline.mjs` now checks the legacy SECURITY DEFINER function dependencies before service startup. It correctly fails closed and enumerates all ten unresolved function names before `supabase start` or `supabase db reset`. The replay workflow's path filter now includes this validator so future changes to the preflight automatically run the replay gate.

Evidence: [run 38155389904](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38155389904). This is an intentional preflight blocker, not a test-infrastructure failure. The approved SMM table baseline checks remain separate and pass; function-baseline authorization is still not granted.

## Read-only live ACL evidence — legacy SECURITY DEFINER functions (2026-10-11)

A read-only `pg_proc` / `has_function_privilege` query in production (`moyhiluyhjsujhwlyeuu`) inspected the ten function names listed in the chronological replay blocker. All ten exist live and are `SECURITY DEFINER`; the replay failure is because clean chronological source lacks their earlier creation DDL before the historical revoke migration, not because these functions are absent from production.

Live client EXECUTE results:

| Function | `anon` | `authenticated` | `service_role` |
|---|---:|---:|---:|
| `counter_offer_indrive_bid(uuid,uuid,numeric)` | false | false | false |
| `fashion_erp_mutate(text,jsonb,text)` | false | false | false |
| `mantigo_accept_bid(text,text)` | false | false | false |
| `mantigo_cancel_ride(text)` | false | false | false |
| `mantigo_create_ride(text,text,text,text,numeric,text)` | false | false | false |
| `mantigo_rate_ride(text,integer,text)` | false | **true** | false |
| `mantigo_submit_bid(text,numeric,text,text,text,text)` | false | false | false |
| `mantigo_update_proposed_price(text,numeric)` | false | false | false |
| `restaurant_erp_mutate(text,jsonb,text)` | false | false | false |
| `restaurant_table_mutate(text,jsonb,text)` | false | false | false |

All ten have a function-level `search_path` setting. The observed values are `public` or `public, pg_temp`; this query only establishes the current settings and grants, not whether each function body is safe against object-shadowing or authorization flaws.

**Privilege reconciliation (not a confirmed vulnerability):** `public.mantigo_rate_ride(text,integer,text)` reports `authenticated_execute=true`, but the repository contains a later explicit grant in `20261006110000_rc_mantigo_production_completion_v1.sql`, whose comments state that this is an authenticated client flow and that functions verify `auth.uid()` and actor ownership. The production grant is therefore consistent with a documented later client contract, not by itself evidence of an unauthorized exposure. Keep this exception only if the implementation and tests confirm caller identity, rating eligibility, and ride ownership; do not blindly revoke it. The chronological replay blocker remains because this creation/grant is later than the old revoke migration.

**Replay finding:** clean replay remains blocked at `20260927095000_revoke_unused_security_definer_execute.sql`, before later migrations. The prior approval covers only the two SMM table baselines; it does not authorize a test-only baseline containing ten privileged function bodies. Recover authoritative historical creation DDL or obtain explicit owner approval for a separate isolated test-only function baseline. Never copy the live definitions into production migrations or use a replay-only baseline as a substitute for a production remediation plan.

Evidence source: read-only catalog query run on 2026-10-11. No function definitions/bodies, table rows, secrets, or provider data were copied into this document. Production remained unchanged.

### Latest exact-head gate refresh — commit `329b08f353e543250707aaf75e3598bd8a2b5a3d`

- Disposable replay run [38155671578](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38155671578) failed at the fail-closed preflight and did not start Docker/Supabase. The preflight enumerated the ten legacy function dependencies and stopped before any migration execution. This is expected until authoritative history or separately approved test-only function baseline exists.
- Module Professionalization run [38155429958](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38155429958) completed with 15 SMM gateway safety-contract failures; all other jobs in that run passed. This remains a release blocker.
- Pages verification run [38155430108](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38155430108) reported `PRODUCTION_GATE=BLOCKED`; its deploy job was skipped. A green workflow-level conclusion here means the validation job ran successfully, not that production passed or deployed.
- The legacy function baseline does not exist and has not been approved. Do not infer that the baseline path is ready merely because the absent-baseline preflight correctly blocks. If approval is later granted, validate a representative named-parameter function definition against the signature checker before trusting the baseline's positive path.
- No production schema, data, grants, RLS, Edge Functions, Auth settings, wallets, or payments were changed.

## Release scope decision — SMM deferred until after launch (2026-10-11)

The owner has prioritized launching the other MantiqaTix modules first and continuing SMM after the initial production launch. The PR now implements a **UI-level release deferral**:

- `web/app.js` excludes `خدمات التسويق الرقمي SMM` from enabled modules regardless of remote module flags, removes its landing navigation link, and renders a clear under-development message if the workspace route is requested.
- `web/smm.html` is now a static `noindex,nofollow` under-development page. It does not load the SMM JavaScript or Supabase SDK.
- `web/smm.js` and `web/smm.css` remain in source for post-launch development; no SMM implementation is deleted.
- The separate internal `التسويق والإعلان` module remains in launch scope. This decision does not defer the internal marketing module or other platform modules.
- `scripts/validate-smm-deferred-release.mjs` enforces the UI deferral and is wired into Module Professionalization Validation.

**Important boundary:** this is not yet proof that SMM is disabled server-side. The production `smm-gateway` Edge Function is independently addressable, and UI hiding cannot prevent direct API requests. Before the platform is exposed publicly, the release owner must verify that the live gateway rejects SMM operations for the deferred phase, or approve a reviewed server-side disablement with tests. No Edge Function was deployed or changed as part of this UI deferral.

**Launch priority:** continue resolving the non-SMM launch blockers first, but do not certify or expose production while the clean migration chain fails or critical production security/release gates remain unresolved. Current blockers include the missing historical creation DDL for ten legacy SECURITY DEFINER functions before `20260927095000_revoke_unused_security_definer_execute.sql`, the live `authenticated EXECUTE` exception for `mantigo_rate_ride(text,integer,text)`, and absent evidence of enforced `main` branch protection/rulesets. The SMM wallet integration test remains failing in CI; with SMM deferred, track it as a post-launch SMM acceptance gate rather than weakening or deleting its test.

Re-enable SMM only in a separate post-launch change after gateway hardening, migration reconciliation, wallet/payment ambiguity safety, admin-scope checks, and integration tests all pass. Do not flip the UI flag alone to make the feature live.

## Initial launch scope decision — SMM deferred

The owner has now explicitly directed that the **internal Marketing & Advertising module remains in the initial launch scope**, while the separate SMM storefront/provider-order/wallet/admin product remains under development until after launch. Candidate UI evidence on this branch:
- `web/home.js` labels the desktop and mobile SMM links as `خدمات SMM — قيد التطوير`.
- `web/smm.html` is a static holding page and does not load `web/smm.js`.
- `web/app.js` contains the internal Marketing & Advertising workspace separately from the deferred SMM workspace.

The CI split is now committed on this draft branch:
- `.github/workflows/module-professionalization.yml` no longer includes the SMM-only wallet/security job. The non-SMM validators formerly colocated in that job were moved into the core `validate` job.
- `.github/workflows/smm-deferred-validation.yml` runs the SMM wallet idempotency integration and SMM-specific gateway/security checks separately. Its failures remain visible and must not be reported as passes; it is not an initial-launch required check while SMM is deferred.

**Important:** this is not sufficient to certify launch. Production's `smm-gateway` Edge Function was observed active and has not been disabled or changed by this work. The static page does not disable the API. New P0 issue [#212](https://github.com/islamnagy2022-eng/MantiqatiX/issues/212) tracks the required reviewed server-side deny gate and production negative tests. Until this is completed under explicit deployment approval, the SMM API remains a separate production exposure to resolve before launch.

The overall production gate remains **BLOCKED / NOT CERTIFIED** because historical migration replay is blocked by ten legacy function creation dependencies, live migration ledger reconciliation remains incomplete after RC424, and other global acceptance evidence remains unverified. SMM deferral does not waive these gates.


## Correction to `mantigo_rate_ride` ACL interpretation — 2026-10-11

Follow-up source-history review found a later explicit grant in `20261006133000_mantigo_p0_security_audit_notification_hardening.sql`: it first revokes `PUBLIC` and `anon`, then grants `EXECUTE` on `public.mantigo_rate_ride(text,integer,text)` to `authenticated`. The function body verifies `auth.uid()` is present, only permits the owner of a `COMPLETED` ride to rate it, validates the rating range, and prevents changing an existing rating. This explains the live `authenticated_execute=true` result and means the earlier note calling it an apparent exception to the September revoke was incomplete.

Current conclusion: **do not classify this grant alone as a confirmed vulnerability or release blocker**. It appears to be a later intentional, authenticated customer-rating flow. Preserve the live ACL; no production permissions were changed. Include the function in the regular security review to validate its full current definition and ensure the negative tests cover unauthenticated calls, non-owner rides, non-completed rides, invalid rating values, and duplicate/changed ratings. The missing historical creation DDL for the ten functions remains a separate replay blocker.