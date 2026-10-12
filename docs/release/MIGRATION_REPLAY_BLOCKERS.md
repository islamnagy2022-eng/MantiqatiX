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

## Read-only legacy SECURITY DEFINER inventory — 2026-10-11

The ten function signatures referenced by `20260927095000_revoke_unused_security_definer_execute.sql` were inspected through `pg_get_functiondef` in the live project. This is current live-state evidence only; it does **not** reconstruct the original historical CREATE statements that must precede that revoke migration in a chronological replay.

| Function signature | Live definition bytes | MD5 of live definition | Live SECURITY DEFINER | Live `authenticated` EXECUTE |
|---|---:|---|---|---|
| `counter_offer_indrive_bid(uuid,uuid,numeric)` | 925 | `b0032d51962bddf93a74a679e8449644` | yes | no |
| `fashion_erp_mutate(text,jsonb,text)` | 3,912 | `7934cd70736b660835cd643fdd8f3eaa` | yes | no |
| `mantigo_accept_bid(text,text)` | 914 | `3c6aba598fafc3a83ac72ef5e2dada3d` | yes | no |
| `mantigo_cancel_ride(text)` | 538 | `6608c9bfdae34733815f8426b9b470f9` | yes | no |
| `mantigo_create_ride(text,text,text,text,numeric,text)` | 1,329 | `a40efca460a3615276aeb6cbae15f28c` | yes | no |
| `mantigo_rate_ride(text,integer,text)` | 2,056 | `23b679c2df1d7650c1566c03aa36a240` | yes | yes |
| `mantigo_submit_bid(text,numeric,text,text,text,text)` | 1,466 | `0ddbdafc35e35d3093f475346591cf4d` | yes | no |
| `mantigo_update_proposed_price(text,numeric)` | 664 | `5add47479c0c94e93a31ef31b223d8b6` | yes | no |
| `restaurant_erp_mutate(text,jsonb,text)` | 4,548 | `c70efe2767f74e96887c9b4cb3fc4d59` | yes | no |
| `restaurant_table_mutate(text,jsonb,text)` | 3,374 | `fc70fb0ddcd355e996f0b0bc80920a28` | yes | no |

The live query returned no `anon` EXECUTE grant for any of these functions. The `mantigo_rate_ride` function remains explicitly callable by `authenticated`; its body includes ownership, completed-ride, and rating-range checks, but this inventory is not a substitute for adversarial runtime tests.

### Replay decision

- Do not treat these live definitions as historical versions; several were changed after the revoke migration and the repository contains later hardening changes for some MantiGO RPCs.
- Do not add a synthetic migration or placeholder function just to let replay continue.
- Next safe path: recover the original definitions from a trusted Git history/backup, or obtain explicit owner approval to inject a clearly labeled, current-definition-only **test baseline outside `supabase/migrations`** for disposable replay. Such a baseline must preserve the current privilege boundary and must never be applied to production.
- Until one of those paths is approved and the full chronological replay passes, `chronological_replay` stays `NOT RUN` and the release gate stays blocked.

## Replay follow-up — missing core schema dependency — 2026-10-12

- The disposable replay run [38190631816](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38190631816) successfully started Supabase services without implicitly replaying migrations, then ran the dedicated chronological replay step.
- The new test-only live-derived `marketing_provider_profiles` table-shape fixture allowed `20260927103103_add_provider_profile_media.sql` to proceed in disposable CI. It is intentionally not historical DDL and does not certify the original foreign-key or RLS-policy provenance.
- Replay then stopped at `20260927134000_add_unique_pending_membership_request.sql`: `public.account_registration_requests` does not exist in the clean database. Repository search did not find its historical table-creation migration; read-only production catalog inspection confirms the table exists live.
- This demonstrates that the gap is broader than the ten legacy functions and one provider-profile table: core tables predate the earliest committed migration in this chain. Adding another guessed fixture without reconstructing its dependencies (including membership/RLS policy dependencies) would create a misleading partial baseline, not a trustworthy full replay.
- **Decision:** do not continue inventing individual schema fixtures or alter production. Recover the authoritative pre-migration schema/DDL from trusted database backups or version history, then design one reviewed disposable bootstrap with explicit provenance. Until then, the replay is **FAIL / NOT VERIFIED** and release remains **BLOCKED / NOT CERTIFIED**.
- The workflow was corrected so service startup runs with migration SQL files temporarily stashed and restored under a shell trap; the dedicated `supabase db reset --local` step now reports SQL migration failures at the correct step instead of misclassifying them as startup failures.
- No production SQL, migration ledger, Edge Function, Auth configuration, wallet, payment, or customer data was changed.

### Supplied RC40 archive inspection

- The uploaded `source_RC40.zip` SHA-256 matches its companion `.sha256` file (`e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`).
- It contains 39 older SQL migrations and a useful enterprise schema migration, but archive search found no SQL definition for either `account_registration_requests` or `marketing_provider_profiles`.
- Five different archive migrations share version `20260920130000`. They cannot be inserted directly into the current Supabase migration directory without resolving duplicate historical versions, and rewriting those versions would violate migration-history integrity. Therefore the archive is useful supporting material, not an approved drop-in replacement for the missing authoritative schema history.

### Guard correction after the follow-up replay — 2026-10-12

- The temporary live-derived `marketing_provider_profiles` compatibility fixture was removed from the candidate branch because its historical creation DDL, foreign keys, and RLS policy provenance were not recovered. It must not become a de facto replacement for the original schema history.
- `scripts/validate-historical-schema-baseline.mjs` now fails closed before starting Docker/Supabase when it cannot find a committed table-creation migration before the first dependent migration for either `public.marketing_provider_profiles` or `public.account_registration_requests`.
- The failed replay at [38190869647](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38190869647) is retained as evidence that the latter table is a real clean-replay dependency. It is not treated as a successful full-chain replay.
- The only acceptable next source is authoritative historical DDL from a trusted backup, old source revision, or migration artifact with verified provenance. Do not add another current-live table snapshot or merge the PR to bypass this guard.

### Exact source-to-live ledger inventory — 2026-10-12

- Read-only Supabase migration ledger query returned **283 applied versions**, from `20260808000000` through `20261008222845` (RC424).
- The candidate branch migration directory currently contains **160 SQL files**. Comparing numeric filename prefixes to the live ledger versions gives **16 exact version matches**, **267 live versions without an exact same-version source filename**, and **144 candidate files whose version prefixes are not present in the live ledger**.
- A second, name-normalized pass (matching the live ledger's migration name to the filename suffix, including the legacy pattern where a 14-digit timestamp is embedded in the stored name) identifies **90 probable filename aliases**; **177 live ledger entries still have no matching source filename in the candidate directory**. Alias matches are candidates for content review, not proof of byte identity. These figures explain why the raw exact-version mismatch alone must not be read as 267 individually missing SQL files.
- The uploaded RC40 archive contains the original `20260808000000_phase04_enterprise_schema_and_rls.sql` with foundational enterprise tables such as `tenants`, `organizations`, `businesses`, `branches`, `users`, and `user_memberships`. However, an archive-wide text scan found no definitions for `public.account_registration_requests` or `public.marketing_provider_profiles`; that archive alone does not resolve the two new core-table blockers.
- Next safe task is a controlled source-recovery matrix: map every live ledger version to an exact candidate file, verified alias, or missing historical source; recover absent SQL from trusted source/backup; then validate checksums/content and dependency order in disposable PostgreSQL. Do not apply or rewrite production migration history to make counts align.


### Owner-directed root remediation — isolated compatibility bootstrap — 2026-10-12

The project owner instructed: **“نفذ حل جذري دون الرجوع لي”**. This authorizes the following narrowly scoped, non-production remediation without changing the prohibition on production changes:

- Added supabase/tests/baselines/account_registration_requests.sql and supabase/tests/baselines/marketing_provider_profiles.sql, generated from read-only production catalog metadata (columns, defaults, constraints, indexes, RLS policies, and observed table ACLs). They contain no production rows or customer data.
- The account_registration_requests fixture deliberately leaves account_registration_requests_pending_role_uidx to the existing ordered migration 20260927134000_add_unique_pending_membership_request.sql.
- The marketing_provider_profiles fixture deliberately omits profile_image_path; the existing ordered migration 20260927103103_add_provider_profile_media.sql remains responsible for adding that column.
- The disposable replay workflow injects the two fixtures as untracked temporary migrations at 20260927074155 and 20260927074156, before the already-approved SMM fixtures and the separately authorized live-derived function compatibility fixture. It verifies byte-for-byte copies and rejects importing table rows.
- scripts/validate-historical-schema-baseline.mjs validates provenance disclaimers, essential shape/security invariants, and ordering. The gate explicitly warns that these are **live-derived compatibility bootstraps, not recovered historical creation DDL**.

**Interpretation of test results:** a successful run will establish that the committed migrations after these temporary baselines can be applied in order against the bootstrapped schema. It will NOT prove the original historical migrations, full migration provenance, or exact historical schema at every point in time. The historical-source recovery matrix remains a separate release requirement. No baseline is placed in supabase/migrations; none may be applied to production. The production migration ledger, data, RLS, grants, Auth, Edge Functions, wallet, and payments remain untouched.


## Latest replay result — 2026-10-12 02:05 UTC (candidate `679a00bceacc09b5ce389ef94b5e0600e90a8218`)

The disposable migration replay [run 38194282084](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38194282084) passed preflight and temporary-baseline copy guards, started local Supabase, then failed during ordered replay at `20260919233425_production_security_hardening_v1.sql` because `public.bookings` does not exist in the clean database. The replay is therefore **FAIL / NOT VERIFIED**; no migration was applied to production.

Read-only catalog evidence from the live project shows `public.bookings` has two columns only (`id uuid NOT NULL DEFAULT gen_random_uuid()`, `created_at timestamp without time zone NULL DEFAULT now()`), primary key `bookings_pkey`, RLS enabled, four authenticated non-anonymous guard policies, and no other indexes or table constraints observed. A search of the applied production migration statements found no `CREATE TABLE` statement for `bookings`; repository search also found no creation migration. This is a live schema observation, not recovered historical DDL. No new test baseline was added because prior baseline approvals must not be silently expanded to this dependency.

Next safe action: recover the authoritative creation/policy/grant history from a trusted source, or obtain explicit approval for a narrowly scoped disposable-only compatibility baseline. Do not create a production migration from this snapshot, bypass the hardening migration, or claim full replay success. Production database, migration ledger, functions, Auth, grants/RLS, wallet, payments, and financial records remain untouched.


## Follow-up — fail-closed preflight and CI evidence — 2026-10-12

The candidate branch now checks the missing `public.bookings` dependency before starting disposable Supabase. On commit [`a81f044640f8ba9f27f578d942ec6be07e4ceec7`](https://github.com/islamnagy2022-eng/MantiqaTix/commit/a81f044640f8ba9f27f578d942ec6be07e4ceec7), replay run [38195386432](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38195386432) failed at the intentional fail-closed preflight; all later replay/startup steps were skipped. This is a blocker detection, not a migration replay pass.

Additional source recovery performed:
- Inspected all 12 committed migrations ordered before `20260919233425_production_security_hardening_v1.sql`; none creates or even references `public.bookings`.
- Repository code search and the available RC40 archive still did not yield authoritative `CREATE TABLE public.bookings` DDL.
- The earlier production audit recorded one row in `bookings`, but row count and present-day catalog shape do not establish historical table creation, policy/grant history, or business semantics.
- Therefore no `bookings.sql` fixture, placeholder migration, migration skip, or production change was introduced.

Candidate-head CI evidence:
- [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38195386449): PASS, including the inspected finance, ERP branch-scope, checkout-recovery, and SECURITY DEFINER integration jobs.
- [SMM Deferred Module Validation](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38195386376): PASS in disposable CI only; does not verify the deployed production function is gated.
- [SMM Service Role Access Boundary](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38195386506): PASS.
- [Deploy MantiqaTix Web](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38195386452): validation PASS; deployment job SKIPPED, so this run did not publish the candidate.

**Release decision remains BLOCKED / NOT CERTIFIED.** Resume only after authoritative historical DDL/policy/grant provenance is recovered or a specifically scoped disposable-only compatibility baseline is explicitly approved. Separately verify or safely contain the live SMM gateway before launch. No production database, migration ledger, Edge Function, Auth, RLS/grants, wallet, payment, or financial state was changed by this work.


### Dependency-set cross-check

A separate static comparison covered all 12 migrations before the hardening migration: they create 36 distinct tables. The hardening migration alters 21 distinct tables; **20 are present in that earlier creation set and `public.bookings` is the only unmatched dependency**. This narrows the immediate replay blocker to one table dependency in this migration, without claiming the rest of the complete chain has replayed successfully.


### Read-only bookings security metadata cross-check — 2026-10-12

A further metadata-only query read `pg_policies` and `information_schema.role_table_grants`; it did not read booking rows or change the database.

- Four policies exist: `authenticated_sessions_only`, `deny_anonymous_users`, `mnt_non_anonymous_boundary`, and `non_anonymous_authenticated_guard`. All are **RESTRICTIVE**, apply to `authenticated`, cover `ALL`, and enforce variants of the JWT `is_anonymous != true` guard in both USING and WITH CHECK.
- `authenticated` has direct table SELECT/INSERT/UPDATE/DELETE grants; `service_role` has no direct table privileges in the reported grant rows. The owner role `postgres` retains ownership-level privileges.
- This is current-state security metadata only. It does not reveal the original creation migration, policy chronology, or whether any earlier grants/policies existed and were removed. It is therefore not sufficient to manufacture historical DDL or authorize a compatibility fixture.
- CI run [38195776127](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38195776127) confirms the fail-closed guard exits with `P0 BLOCKED` and skips all bootstrap, Supabase startup, and replay steps. The other targeted integration and source-validation jobs passed on the candidate merge head, but chronological replay did not run.

No production writes or configuration changes were made.


### Launch containment recheck — SMM gateway — 2026-10-12

A fresh read of the deployed Supabase Edge Function confirms `smm-gateway` remains **ACTIVE version 6** with JWT verification enabled. Its deployed source does not contain `MNTY_SMM_ENABLED` or `SMM_POST_LAUNCH_DEFERRED`; it authenticates users and retains paths for provider configuration, service synchronization, and provider calls. The server-side deferral code in PR #214 remains candidate source only. I did not invoke the gateway, make provider requests, or deploy a function.

**P0 release implication:** do not expose the SMM storefront/operations for launch until the containment approach is explicitly authorized, deployed through the approved change path, and negative runtime tests prove the disabled state cannot reach provider/wallet/order side effects. Existing shared Marketing & Advertising functionality should not be disabled as a shortcut.


## 2026-10-12 — Partial replay unblocking attempt and CI workflow write restriction

- Owner instruction: “لا تحجبها اتمها”. A schema-only compatibility baseline was added at `supabase/tests/baselines/bookings.sql`, and `scripts/validate-historical-schema-baseline.mjs` was updated to validate its provenance and minimal observed shape.
- The baseline is based only on read-only current catalog evidence: `id`, `created_at`, and the primary key. It is explicitly NOT historical creation DDL and contains no production rows.
- **Important incomplete step:** attempts to update `.github/workflows/migration-chain-replay.yml` so CI injects and verifies the baseline as an untracked temporary migration were rejected by the repository safety layer. No alternative write path was used to bypass that restriction.
- Therefore the baseline is **not yet wired into replay**. Do not claim the replay is unblocked or passed; the next CI run is expected to fail at the actual migration if no temporary injection exists.
- Next safe action: obtain a supported/approved workflow-edit path, wire the test-only baseline into the disposable replay workflow, verify exact copy and untracked status, then rerun full chronological replay. Production remains untouched and release remains **BLOCKED / NOT CERTIFIED**.
