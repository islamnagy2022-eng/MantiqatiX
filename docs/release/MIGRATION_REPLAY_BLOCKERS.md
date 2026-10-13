# Migration Replay Blockers — 2026-10-11

## Status

**BLOCKED — do not apply the post-RC424 batch to production.**

The production migration ledger currently ends at `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). A read-only exact comparison of `supabase_migrations.schema_migrations.statements[1]` against `supabase/migrations/20261009010000_rc424_atomic_digital_page_payment_webhook.sql` returned `exactMatch=true`, with both values exactly 7,208 bytes. RC424 source/ledger statement identity is VERIFIED despite the different filename timestamp. Preserve the applied ledger version `20261008222845`; document source filename timestamp `20261009010000` as a legacy alias and do not rename or rewrite applied history.

The full disposable Supabase replay is still BLOCKED at the historical-schema preflight. The latest exact-head attempt [run 38142160896](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38142160896) failed before starting Supabase services or executing the migration chain. The owner explicitly approved both documented `public.smm_providers` and `public.smm_provider_credentials` live-derived snapshots as baselines for an isolated disposable test/replay environment only; the provider baseline must be injected first to satisfy the credentials foreign key. This approval does not recover original historical creation DDL and does not authorize production changes.

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


### Exact-head replay result after bookings baseline preflight fix — 2026-10-12

- Candidate commit `fe7436659b3b4ba798464f3ae5a831724b78abfe` passed the fail-closed preflight and started disposable Supabase successfully.
- Full replay run [38196631233](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38196631233) then **FAILED** at `20260919233425_production_security_hardening_v1.sql`, statement 20: `alter table public.bookings enable row level security`, SQLSTATE `42P01` (`public.bookings` does not exist).
- This confirms the new baseline passes the validator but is not injected by the current workflow. The replay has not passed. Attempts to edit the workflow were rejected by the repository safety layer; do not use indirect or alternate paths to bypass that restriction.
- Next step requires a supported, approved workflow-edit path to inject the clearly labelled schema-only baseline as a temporary migration in disposable CI, then verify byte-for-byte copy, ordering, untracked status, and run the complete chain again. This does not establish historical DDL provenance.
- No production changes were made. Release remains **BLOCKED / NOT CERTIFIED**.


### SMM deferred-gate source review — 2026-10-12

Read-only review of draft PR [#214](https://github.com/islamnagy2022-eng/MantiqaTix/pull/214) at `fix/smm-server-side-launch-deferral-20261011` confirms its added `MNTY_SMM_ENABLED` check is placed after OPTIONS and before authentication/action dispatch. The draft also replaces `web/smm.html` with a static deferred notice that does not load client scripts. The targeted CI run is source validation only; it does not deploy or verify the production Edge Function.

The same candidate `supabase/functions/smm-gateway/index.ts` still contains critical unsafe behavior behind the disabled-by-default gate:
- Provider `fetch()` has no explicit timeout/abort bound, and non-2xx responses are handled only as generic exceptions.
- `place_order` refunds the wallet for every caught provider exception, including ambiguous outcomes such as timeout/connection loss or a successful provider acceptance followed by a local persistence failure. A missing provider order ID is also thrown into this same refund path.
- The post-provider order update and order-event insert results are not checked before returning success, so local persistence failure can leave provider acceptance and local state inconsistent.
- Order creation, debit, provider submission, and refund are not guarded by a demonstrated stable idempotency/reconciliation protocol in this handler.
- `order_status` does not apply an explicit transition matrix before writing a new status, and provider errors are not separated from confirmed terminal outcomes.

**Decision:** the server-side gate is a useful containment change only while `MNTY_SMM_ENABLED` remains unset or not equal to `true`. Do not enable the gate or treat PR #214 as order-flow certification until bounded provider calls, typed ambiguous outcomes, no automatic refund on ambiguous execution, confirmed-rejection-only refund semantics, checked conditional persistence, idempotency/reconciliation, and terminal-state transition tests are implemented and pass. Deploying the draft is not authorized by this review.

No production function, environment variable, wallet, order, database, or customer data was changed.


### Exact-head continuation — 2026-10-12 (latest CI)

- Latest PR-head check set for commit `e4018b4d339f8b227287b80d7673d886e41eedaf`: [Module Professionalization Validation](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38197456387) passed, [SMM Deferred Module Validation](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38197456405) passed, and [SMM Service Role Access Boundary](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38197456430) passed. The SMM wallet/provider source contract in the current reconciliation candidate checks bounded 15-second provider calls, typed ambiguous outcomes, no automatic refund for unknown outcomes, explicit-rejection-only refund handling, conditional persistence, missing provider-ID ambiguity, backend-derived admin access, terminal-status protection, and idempotent wallet references. This supersedes earlier observations of the older PR #214 draft source; it does not establish that the newer candidate has been deployed.
- The latest [Disposable Supabase Migration Chain Replay](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38197456355) still fails at the ordered replay step. Preflight, existing baseline injection/copy checks, and disposable Supabase startup passed. The workflow still does not inject `supabase/tests/baselines/bookings.sql`; the chain consequently lacks `public.bookings` before `20260919233425_production_security_hardening_v1.sql`. The source validator recognizes the test baseline, but the workflow wiring is incomplete.
- An attempted supported workflow-file update was rejected by the repository safety layer. No alternate write path was used. The remaining action is to obtain an approved path for the narrowly scoped workflow change, then rerun exact-head replay.
- The Pages `deploy` job was skipped on PR validation; no deployment occurred. PR #207 remains a draft and production remains **BLOCKED / NOT CERTIFIED**. No production database, migration ledger, Edge Function, wallet/payment data, or Auth settings were changed.


### Replay remediation ordering correction — 2026-10-12

The current candidate-head run [38197868766](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38197868766) again passed preflight, existing fixture injection/copy checks, and disposable Supabase startup, then failed during chronological replay. The workflow still does not inject `supabase/tests/baselines/bookings.sql`.

**Ordering requirement:** the temporary `bookings` compatibility migration must sort before `20260919233425_production_security_hardening_v1.sql`. The currently injected fixture filenames dated `20260927074155` and later are too late for this dependency. Any proposed temporary name must be unique and earlier than the hardening migration, with its placement checked against the earlier migration set. The workflow must copy the fixture byte-for-byte, assert the temporary file is untracked, keep it out of committed migration history, and restore/remove all temporary files on success or failure.

This is still a minimal live-derived compatibility shape, not recovered historical DDL. A green replay would only prove the remaining ordered migrations execute against that disposable bootstrap; it would not certify historical provenance or production readiness. A request for an approved workflow-edit path was recorded in PR #207; no workflow bypass, production mutation, merge, or deployment was performed. Release remains **BLOCKED / NOT CERTIFIED**.


### Exact-head continuation — 2026-10-12 (run 38198668539)

- On candidate commit `5ba320b30c11d2248f32a1de3365fb322b544ef0`, the latest [Disposable Supabase Migration Chain Replay](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38198668539) again passed preflight, existing fixture-copy checks, and disposable service startup, then failed at statement 20 of `20260919233425_production_security_hardening_v1.sql`: `public.bookings` is missing. The local migration ledger and replay-completion verification were skipped.
- Read-only inspection of `supabase/migrations` found no filename beginning `20260919233424`. That is a possible unique timestamp for a temporary disposable-only copy of `supabase/tests/baselines/bookings.sql`, immediately before the dependent migration; verify uniqueness and all earlier dependencies in the approved workflow change. This is a naming candidate only, not a committed migration or historical DDL.
- Exact workflow gap: both the “Inject approved live-derived compatibility baselines into disposable replay only” and “Verify temporary baselines are exact schema-only copies” steps omit `bookings.sql`, its temporary path, its `cmp -s` check, and its `git ls-files` untracked assertion. The startup step stashes/restores migration files; ensure any new temporary fixture is also restored/removed on all exits.
- The workflow edit remains blocked by the repository safety layer. Do not bypass it through another API or file. Request an approved workflow-edit path; then run full replay and inspect subsequent failures. Production remains untouched, PR #207 remains draft, and release remains **BLOCKED / NOT CERTIFIED**.


### Live SMM and latest CI re-verification — 2026-10-12

- PR #207 head `f1f5a410c86fedd3590b159a64091b6144a481d8`: Module Professionalization Validation, SMM Deferred Module Validation, and SMM Service Role Access Boundary completed successfully. These are candidate-source validations only.
- Latest replay run [38199476737](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38199476737) again failed at statement 20 of `20260919233425_production_security_hardening_v1.sql` because `public.bookings` is absent. The Pages validation job passed but its deploy job was skipped; no deployment is inferred.
- Read-only live Supabase Edge Function inspection reconfirmed `smm-gateway` is ACTIVE v6 with source hash `ea4de98886b739ed5ce83c7f5909671fd00481a8f488849ffe58567e58be6cd6`. The deployed source has no `MNTY_SMM_ENABLED` fail-closed gate, no bounded provider timeout, and no typed ambiguous-outcome handling; it retains an automatic refund catch path and broad active OWNER/ADMIN/SUPER_ADMIN membership authorization. Candidate CI does not change this live state.
- Findings were added to PR #214 for traceability. No production Edge Function, environment variable, database, wallet, payment, Auth, or repository protection setting was changed. Keep SMM order flow unavailable for launch until approved containment/deployment and live negative side-effect tests are complete. Release remains **BLOCKED / NOT CERTIFIED**.


### Fresh production read-only security and migration-ledger snapshot — 2026-10-12

- Supabase Security Advisor was re-read at `2026-10-12T03:30:03Z`. It returned 133 counted findings across categories: one RLS-enabled/no-policy INFO; one anon-executable SECURITY DEFINER function; 40 authenticated-executable SECURITY DEFINER functions; repeated anonymous-sign-in setting warnings; and one leaked-password-protection warning. The 133 count is an aggregate of advisor entries and is not a count of distinct confirmed exploitable vulnerabilities. Triage each finding by exact function signature, intended audience, caller checks, and grants; do not blanket-revoke functions without compatibility and caller-contract tests.
- The INFO finding specifically identifies `public.digital_page_payment_events` as RLS-enabled with no policies. Verify whether this is intentionally deny-all (and test expected service-role/backend access) before changing policy; do not add broad client policies merely to silence the advisor.
- The anon-executable SECURITY DEFINER finding specifically identifies `public.get_mnty_targeted_advertisements(p_country_code character varying, p_governorate_code character varying, p_center_code character varying, p_lat double precision, p_lon double precision, p_ad_space_id character varying, p_limit integer)`. Review the function's public-data purpose, input validation, row-level filtering, search_path, and execute grants; no grant change was made during this read-only check.
- The live migration ledger currently lists 283 applied versions, with latest `20261008222845 / rc424_atomic_digital_page_payment_webhook`. This does not prove post-RC424 candidate migrations were applied. No production migrations were applied by this continuation.
- The migration replay run on the latest documentation commit was cancelled, so it provides no new pass/fail result. The most recent completed replay remains the earlier failure at missing `public.bookings`. Re-run only after an approved workflow change is available.

No production DDL, grants, RLS policies, Auth settings, wallet/payment records, or Edge Functions were changed. Release remains **BLOCKED / NOT CERTIFIED**.


### Targeted catalog verification — SECURITY DEFINER grants and payment-event table — 2026-10-12

- Read-only catalog query confirms `public.get_mnty_targeted_advertisements(...)` is `SECURITY DEFINER`, has `search_path=public, pg_temp`, and EXECUTE is granted to both `anon` and `authenticated`. Its body returns approved, active advertisements filtered by country/geographic targeting and bounded to 1–50 results. Anonymous access may be intentional for public ad delivery; do not revoke without product-owner intent and anonymous ad-render regression tests. Still review input validation, returned URLs/content, data minimization, and all referenced-table access.
- Read-only catalog query confirms `public.claim_digital_page_payment_intent_backend(uuid,uuid,text,text)` is `SECURITY DEFINER`, has the same configured search_path, and is executable by `authenticated` but not `anon`. The signature accepts `p_user_id`; source-level caller-identity enforcement and abuse/race tests remain necessary, so a grant result alone is not certification.
- `public.digital_page_payment_events` is owned by `postgres`, RLS enabled, no policies, and FORCE RLS disabled. Explicit table-privilege checks returned no SELECT/INSERT privilege for `anon`, `authenticated`, or `service_role`. This appears deny-by-default for direct API roles, but the intended backend write/read path and owner/security-definer behavior must be tested before adding policies or grants. No grants or policies were changed.


### Exact-head replay blocker — settlement function signature drift — 2026-10-12

- Exact-head disposable replay [run 38249984205](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38249984205) correctly failed closed in the historical-schema preflight before starting Supabase services. The preflight identified that `20260920095706_production_security_definer_execute_lockdown_v4.sql` revokes EXECUTE on `public.create_settlement_backend(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar)`, but no earlier committed migration defines that 10-argument overload.
- The earlier `20260920071316_phase28_financial_backend_authority.sql` source defines a 9-argument overload with a different parameter list. A read-only live catalog query against project `moyhiluyhjsujhwlyeuu` confirmed the live function has the 10-argument signature, returns `jsonb`, is SECURITY DEFINER, and has `search_path=public`. This confirms signature drift between committed replay history and the live catalog; it does not recover when or how the 10-argument version was introduced.
- The validator now blocks this dependency before Docker/Supabase startup rather than letting a full replay fail mid-chain. The targeted exact-head workflow also reports success for migration immutability/version uniqueness, marketing CRM tenant scope, marketing campaign backend, MantiGO privacy, SMM deferred UI boundary, SMM service-role boundary, backend-only module boundary, approval audit atomicity, and the general module suite. Pages validation succeeded but its deploy job was skipped; no production deployment occurred.
- Do not rewrite the applied migration, silently add a guessed historical function body, or broaden prior SMM table-baseline approval into privileged function approval. Recover authoritative historical creation DDL/history, or obtain explicit approval for a separately versioned, live-derived **test-only** function fixture with clear provenance and no production application. Then rerun full ordered replay and inspect all subsequent blockers.
- No production SQL, grants, RLS, Auth configuration, wallet/payment records, or Edge Functions were changed. Release remains **BLOCKED / NOT CERTIFIED**.

### Emergency SMM production containment — 2026-10-12

- Read-only inspection of the deployed Supabase Edge Function showed `smm-gateway` version 6 was active and did not contain the repository's current fail-closed `MNTY_SMM_ENABLED` guard. The deployed source also had a broader admin-role check than the current candidate source. This was a production security mismatch; UI deferral alone was not sufficient.
- Decision: because SMM is deferred from initial launch, deploy an emergency deny-all response for this gateway until the authorization, wallet idempotency/reconciliation, provider outcome, and runtime negative tests are release-certified.
- Deployed `smm-gateway` version 7 with `verify_jwt=true`. The deployed handler returns HTTP 503 `SMM_POST_LAUNCH_DEFERRED` for every non-OPTIONS request and contains no database, wallet, or provider calls. The deployed source was read back after deployment and confirmed to match the emergency deny-all handler.
- Impact: SMM catalog/order/admin operations through this gateway are intentionally unavailable until a reviewed, fail-closed replacement is released. Existing order records are not modified by this handler. This is a containment step, not a permanent SMM release.
- Re-enable only after code review of the exact candidate source, required environment defaults, server-side role/tenant authorization, idempotent wallet debit/refund and reconciliation paths, negative runtime tests against the deployed version, and an approved deployment. Do not simply restore the prior version 6.
- This deployment changed only the `smm-gateway` Edge Function; no SQL migrations, wallet records, payment records, grants, or RLS policies were changed.

### Latest autonomous continuation — 2026-10-12 (run 38251331236)

- Exact-head replay run [38251331236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38251331236) on commit `9cd22a9d08f99a564e61f5c267670684bcff8ee4` passed the historical preflight, approved SMM schema-only baseline injection/copy checks, and disposable Supabase startup, then **failed** during ordered migration replay at `20260920155456_harden_credit_status_authorization.sql`: relation `public.credit_accounts` does not exist (SQLSTATE `42P01`). The local migration ledger and replay-completion verification were skipped.
- Repository search found no committed `CREATE TABLE credit_accounts` source before the policy/function migrations that depend on `credit_accounts` and `credit_periods`. A read-only production catalog inspection confirmed both tables currently exist, with RLS enabled and FORCE RLS enabled, and exposed their column/constraint metadata; no rows or customer/financial values were queried.
- This is a new historical dependency gap after earlier replay blockers. Do not invent historical DDL, pre-seed production, or modify financial tables in production. The safe next step is to recover authoritative creation DDL from repository history/backup/source-of-truth, or separately authorize a schema-only disposable baseline with provenance and inject it through the approved workflow path. Workflow edits must not be routed through alternate APIs if the repository safety layer rejects them.
- Latest-head checks: migration version uniqueness, migration history immutability, SMM deferred-module validation, SMM service-role boundary, marketing CRM tenant scope, marketing campaign backend, MantiGO privacy, approval-action audit atomicity, backend-only module boundary, and module professionalization completed successfully. The Pages workflow validation passed but its deploy job was skipped; no deployment is implied.
- Live `smm-gateway` readback currently reports version `8`, ACTIVE, `verify_jwt=true`, source hash `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. The read-back source contains an `MNTY_SMM_ENABLED` fail-closed check before action dispatch and bounded provider calls, but the environment flag and negative runtime side-effect behavior were not independently verified in this check. Do not infer SMM is safely disabled merely from function status/version; confirm flag state and runtime denial before launch.
- PR #207 remains open and unmerged. Production migration ledger remains at RC424 based on the last verified snapshot. No production database, financial records, Auth configuration, grants, RLS, or migration history was changed during this continuation. Release remains **BLOCKED / NOT CERTIFIED**.


### Latest exact-head replay verification — 2026-10-12 12:54 UTC

- Replay run [38251784703](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38251784703) on exact PR head `5cf80e82bf5261e7fbe93893f22826dfbf7fca55` passed preflight and disposable Supabase startup, then failed again at `20260920155456_harden_credit_status_authorization.sql` with `relation "public.credit_accounts" does not exist (SQLSTATE 42P01)`. The local ledger and completion verification steps were skipped.
- Latest exact-head checks for migration-history immutability, migration-version uniqueness, SMM deferred module, SMM service-role boundary, marketing campaign backend, marketing CRM tenant scope, MantiGO privacy, approval audit atomicity, backend-only module boundary, and module professionalization passed. The web workflow's validation passed, but its `deploy` job was skipped; this is not a deployment.
- Repository code search still returns only policy references to `credit_accounts`/`credit_periods`, not an authoritative earlier table-creation migration. Production catalog metadata previously confirmed the tables exist live with RLS and FORCE RLS enabled, but that is not historical provenance.
- Next safe action: recover authoritative DDL from a trusted source or obtain separate explicit approval for schema-only, live-derived **disposable replay** fixtures and add them only through the approved replay workflow. No guessed DDL, migration-history rewrite, production schema change, or production financial data access is authorized by this finding.
- Release remains **BLOCKED / NOT CERTIFIED**. No production database or application deployment was performed by this replay.


### Follow-up on exact-head replay — 2026-10-12 12:58 UTC

- The replay rerun [38252224065](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38252224065) on commit `47acf8c8d3e94d3805973f0fea5112778d00ba11` reproduced the same failure at `20260920155456_harden_credit_status_authorization.sql`: `public.credit_accounts` is absent in the empty disposable database. The candidate migration defines `get_credit_status` and references both `credit_accounts` and `credit_periods`; it does not create either table.
- A second repository search found no authoritative `CREATE TABLE credit_accounts` migration or commit in the indexed source. The later migration `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` also assumes both tables and their named policies already exist. Therefore this is a historical schema provenance gap, not something safe to fix by editing the failing function or skipping the migration.
- Exact-head module validation, migration uniqueness/history checks, migration-collision guard, deferred-SMM checks, service-role boundary, marketing/CRM checks, MantiGO privacy, and approval-audit atomicity passed. The web workflow validation passed, but the deploy job was skipped.
- No credit schema baseline was added: prior owner approval covered the SMM provider tables only. Continue by locating trusted source-of-truth DDL/history; otherwise request narrowly scoped authorization for a schema-only disposable replay fixture with documented provenance. Do not apply that fixture to production.
- PR #207 remains open and unmerged. Release remains **BLOCKED / NOT CERTIFIED**.


### Source-archive reconciliation — 2026-10-12

- A trusted source artifact supplied with this work, `source_RC40.zip`, contains `supabase/migrations/20260920185000_production_credit_control.sql`. It defines `credit_policies`, `credit_accounts`, and `credit_periods`, including their foreign keys, constraints, generated balance columns, RLS/FORCE RLS, and the restrictive `authenticated_sessions_only` policy. This is authoritative source DDL evidence that was missed by the repository's indexed search; it is not production row data.
- The ordering conflict remains real: the currently replayed chain executes `20260920155456_harden_credit_status_authorization.sql` **before** the source archive's credit-control migration at `20260920185000`. The function migration references `credit_accounts` and `credit_periods` before they exist, so simply finding the later migration does not make the current chain replayable.
- The archive's matching authorization migration is named `20260920190000_harden_credit_status_authorization.sql`, whereas the candidate chain uses the same logical migration at `20260920155456`. This timestamp/content divergence must be reconciled against the migration immutability contract and the RC40 archive's provenance before changing the chain. Do not silently rename/rewrite an existing migration or create a guessed earlier migration.
- Safe next step: compare the RC40 archive's migration manifest/history with the current branch and determine the smallest reviewable, immutable-history-compatible repair. If the chain requires an isolated replay fixture, it must be a schema-only fixture sourced from this exact archived DDL, injected into disposable CI only, clearly distinguished from an applied production migration, and validated against the later credit-control migration's idempotency and policy assumptions.
- Exact-head replay at `233dc51f80e7bb502ef3fc226bc8c14e72106130` still fails on `public.credit_accounts` missing; see [run 38253982522](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38253982522). Web validation passed but deploy was skipped in [run 38253982516](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38253982516). Production was not changed. Release remains **BLOCKED / NOT CERTIFIED**.


## Latest exact-head replay result — 2026-10-12

The latest candidate head `3003a6186d937580cba37fe92c313d6760ffe111` was checked through GitHub Actions. Core/module, privacy, migration immutability, migration-version uniqueness, SMM deferred-module validation, and related validators passed. The full disposable replay did **not** pass: [run 38254637974](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38254637974) eventually started the local Supabase stack after Docker registry rate-limit retries, then failed while applying `20260920155456_harden_credit_status_authorization.sql` with PostgreSQL `42P01: relation "public.credit_accounts" does not exist`. That migration also references `public.credit_periods`.

A fresh read-only production catalog check confirmed that both relations exist in the live database. The observed schema includes:

- `credit_accounts`: primary key `id`; unique `(tenant_id, business_id)`; foreign keys to `tenants`, `businesses`, and `credit_policies`; non-negative approved/outstanding amount checks; status constraint; index `(tenant_id, status)`.
- `credit_periods`: primary key `id`; unique `(credit_account_id, period_start, period_end)`; foreign keys to `credit_accounts` and `tenants`; period date-order, non-negative amount/day, and status checks; index `(tenant_id, due_date, status)`.
- Both live tables have RLS enabled and FORCE RLS enabled. Read-only privilege checks returned no direct SELECT privilege for `anon`, `authenticated`, or `service_role`. Existing tenant/finance read policies are present; preserve their exact expressions when comparing the final schema.

**This is new replay evidence, not authorization to create a baseline.** The explicit approval recorded for test-only baselines currently covers the SMM provider tables only; it does not cover `credit_accounts` or `credit_periods`. Do not add these tables to the disposable replay by guessing their DDL, and do not apply any baseline or reconstructed migration to production. First recover their original creation source from an authoritative repository/history artifact. If that cannot be recovered, obtain explicit approval for a schema-only baseline derived from read-only catalog metadata, restricted to isolated disposable replay.

The current release remains **BLOCKED / NOT CERTIFIED**. No production schema, migration ledger, grants, RLS, Auth settings, Edge Functions, wallet balances, payments, or customer data were changed during this check.


## RC40 archive source recovery — 2026-10-12

The uploaded `source_RC40.zip` was checked locally against its accompanying `source_RC40.zip.sha256`; SHA-256 matched exactly: `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`. The archive contains original SQL sources:

- `supabase/migrations/20260920185000_production_credit_control.sql` — creates `credit_policies`, `credit_accounts`, and `credit_periods`, including generated `available_amount` / `outstanding_amount`, constraints, tenant foreign keys, RLS/FORCE RLS, and the `authenticated_sessions_only` restrictive policy.
- `supabase/migrations/20260920190000_harden_credit_status_authorization.sql` — defines `get_credit_status` after those tables exist.

This recovers authoritative table-creation source from the supplied archive; it does **not** by itself resolve the candidate replay. The current candidate has a ledger-alias-named function migration at `20260920155456_harden_credit_status_authorization.sql`, which sorts before the original table-creation migration at `20260920185000`. The live ledger records the earlier alias, so do not rename or rewrite applied production history to make the fresh replay pass.

A second gap also needs reconciliation: the RC40 archive does not contain creation statements for the live `credit_accounts_finance_read` and `credit_periods_finance_read` policies, while a later candidate migration alters those policies. Recover their original migration source if available; otherwise request explicit approval before using a production-derived policy/schema snapshot in disposable replay. Do not silently fabricate or inject unapproved policy definitions.

Recommended next step: create a reviewed, **test-only** replay compatibility plan that preserves all live migration versions and production state, uses the verified RC40 table DDL as the schema source, and explicitly handles the 15:54/18:50 ordering mismatch plus the missing finance-policy creation source. Validate it on disposable PostgreSQL only; do not add a backdated deployable migration or apply any baseline to production.


### Live/source precision mismatch — 2026-10-12

The RC40 archive is integrity-verified, but its credit DDL is **not an exact live-schema snapshot**. The archive declares `numeric(14,2)` for `credit_policies.credit_limit`, `credit_accounts.approved_limit/outstanding_amount`, and `credit_periods.billed_amount/paid_amount`; read-only production catalog metadata reports `numeric(18,2)` for all five columns. The two generated amount columns match the observed expressions, but the precision discrepancy means the RC40 migration cannot be treated as a byte-for-byte or schema-exact substitute for the live baseline.

Therefore, preserve RC40 as historical source evidence, not as a certified production schema snapshot. The replay fix must not silently narrow live numeric capacity. Either recover the exact historical migration/source that matches production, or obtain explicit approval for a disposable-only compatibility baseline generated from the read-only live catalog and policy metadata. No such credit-schema baseline has been injected, and no production change was made.


## Exact-head replay confirmation — 2026-10-12 14:57 UTC

Candidate head `59bc6126540c1436627cf5274e22ccfd15711ed0`, run [38266427713](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38266427713), again reached and failed on the same first unresolved credit dependency. The disposable Supabase stack recovered from initial public image-registry rate limits and applied migrations up to `20260920155456_harden_credit_status_authorization.sql`; PostgreSQL then returned `42P01: relation "public.credit_accounts" does not exist`. The function also references `public.credit_periods`.

This is confirmed on the latest exact candidate head. The main migration directory and production migration ledger contain no authoritative creation migration for these three credit tables. RC40 source contains historical DDL but has `numeric(14,2)` where live catalog evidence reports `numeric(18,2)` for the five credit amount fields. It also does not establish the original creation statements for the live `credit_accounts_finance_read` and `credit_periods_finance_read` policies.

**Do not resolve this by editing the already-applied migration, backdating production DDL, skipping the migration, or injecting an unapproved credit schema snapshot.** The outstanding decision is limited to whether a schema-only, live-derived compatibility baseline for `credit_policies`, `credit_accounts`, and `credit_periods`, including verified constraints and policy definitions, may be generated and injected into the disposable replay workspace only. It must remain outside committed production migrations and contain no production rows or secrets. Until the source is recovered or that disposable-only baseline is explicitly approved and verified, the chronological replay and release gate remain BLOCKED.

Latest exact-head non-replay CI has passed for migration immutability/version uniqueness, module professionalization, SMM deferral and service-role boundary, marketing campaign/CRM, backend-only module boundary, approval audit atomicity, and MantiGO open-ride privacy. Pages validation succeeded but did not deploy. These checks do not waive the failed full replay or the separate live SMM P0.


## Credit migration source recovery — 2026-10-12

A read-only review of the uploaded `source_RC40.zip` archive recovered two original source files that are absent from the current candidate migration directory:

- `supabase/migrations/20260920185000_production_credit_control.sql` creates `credit_policies`, `credit_accounts`, and `credit_periods`, including generated balances, checks, tenant/business foreign keys, RLS/FORCE RLS, and the restrictive `authenticated_sessions_only` policy.
- `supabase/migrations/20260920190000_harden_credit_status_authorization.sql` defines the credit-status authorization function after those tables.

The candidate currently contains `20260920155456_harden_credit_status_authorization.sql`, which is ordered before the recovered table-creation file and causes the clean replay failure at `public.credit_accounts`.

**This is source recovery, not authorization to inject a credit baseline or to restore the archive blindly.** The archived DDL uses `numeric(14,2)` for five credit amounts, while the read-only live catalog reported `numeric(18,2)`; the archive also does not include the live `credit_accounts_finance_read` and `credit_periods_finance_read` policy creation statements. Therefore the archive alone is not a schema-accurate live snapshot.

Safe next step: reconcile the recovered source with live catalog evidence and the candidate migration-history rules, then make a candidate-only chronological migration correction that preserves applied history and matches the required live precision/policies. Until that is verified by a clean replay, keep the replay gate blocked. No production change was made.


## Exact-head replay attempt and RC461 gate update — 2026-10-12

- Latest documentation head at this check: `881c6fef1ba5c91eb98fe60bb8d472be2d01713f`.
- The exact-head migration replay workflow was cancelled while bootstrapping the disposable Supabase stack. Logs show registry throttling (`toomanyrequests: Rate exceeded`) during image pulls; no SQL migration error was emitted in this attempt, so it is **not** a replay pass and does not supersede the earlier confirmed missing-`credit_accounts` failure.
- The current replay workflow's temporary baselines cover legacy businesses/products/orders, registration requests, marketing provider profiles, SMM providers/credentials, bookings, legacy security-definer functions, and the 10-argument settlement function. It does **not** inject a credit schema baseline. Keep it that way unless the owner explicitly approves a credit baseline for disposable replay.
- The RC40 archive contains the original credit table DDL and intended later hardening function migration. The archive alone is not an exact live-schema snapshot: five amount columns are `numeric(14,2)` in the archive while the live catalog reports `numeric(18,2)`, and the archive does not create the two finance-read policies altered by a later committed migration. Do not blindly restore or adapt it using live-derived schema definitions without the missing source/policy provenance being resolved.
- RC461 restaurant workspace hardening: the integration job passed, including inactive-business and inactive-branch rejection. All 16 jobs in module professionalization passed. Migration version uniqueness, migration history immutability, open-PR collision guard, SMM deferral/service-role boundaries, marketing/CRM tenant scope, MantiGO privacy, approval audit atomicity, and Pages validation passed on the prior code head. Pages deploy was skipped.
- Live production remains unchanged. The read-only catalog check shows no RC459/RC460/RC461 versions in the live migration ledger; do not infer that their UI/function code is deployed. The live Edge Function list does not include `restaurant-workspace-mutate` or `restaurant-menu-save`.
- Release gate remains **BLOCKED / NOT CERTIFIED** pending reliable disposable replay, credit migration provenance/ordering resolution, and approved production rollout gates. No production schema, data, function, auth, grant/RLS, wallet, or payment changes were performed.

## Exact-head replay failure and release containment refresh — 2026-10-12 15:18 UTC

- Candidate head checked: `25c1a6ea509effd5c36aa6320b0995b0c3de895c`; PR #207 has been returned to **Draft** because its mergeability is not evidence of release readiness.
- Exact-head replay [run 38268915969](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38268915969) reached chronological SQL replay and failed at `20260920155456_harden_credit_status_authorization.sql`: PostgreSQL reports `relation "public.credit_accounts" does not exist` while the function also references `public.credit_periods`. This confirms the credit dependency/order defect on a fresh database. Registry rate limiting occurred during service startup, but replay proceeded and then failed on SQL; this is not an infrastructure-only failure.
- Core exact-head checks passed: migration version uniqueness, migration history immutability, open-PR collision guard, marketing campaign backend, MantiGO privacy boundary, SMM service-role boundary, SMM deferred module validation, backend-only module boundary, approval audit atomicity, marketing/CRM tenant scope, and module professionalization. These passes do not waive chronological replay or production gates.
- Read-only live Supabase inspection reconfirmed `smm-gateway` is ACTIVE v8 with `verify_jwt=true`, SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. The deployed source does not contain the candidate `MNTY_SMM_ENABLED` fail-closed gate. SMM is deferred in the browser only; server-side containment remains unverified and mandatory before launch.
- Read-only migration-ledger inspection still reports latest applied version `20261008222845` / `rc424_atomic_digital_page_payment_webhook`. RC459/RC460/RC461 are not present in the live ledger, and the live Edge Function inventory does not contain `restaurant-workspace-mutate` or `restaurant-menu-save`.
- Credit recovery remains deliberately unresolved: RC40 contains the original credit table DDL, but its five amount columns use `numeric(14,2)` while the live catalog reports `numeric(18,2)`; the archive also omits the two finance-read policy creation statements later altered by a committed migration. No credit baseline, guessed policy, placeholder function, or rewritten applied migration history was introduced.
- **Decision:** keep PR #207 Draft and production status **BLOCKED / NOT CERTIFIED**. Next safe path is to recover authoritative provenance for credit-table types and policy creation, correct candidate migration ordering without changing applied history, then obtain a successful full replay. Production SMM containment requires its own approved deployment and live negative tests. No production database, Edge Function, auth, grants/RLS, wallet, payment, or repository protection settings were changed.


## Exact-head continuation — 2026-10-12 (UTC)

- Exact-head disposable replay run [38268209701](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38268209701) successfully started the local Supabase stack and began applying migrations. The runner first encountered Docker Hub rate-limit responses, retried, and then proceeded; this run is **not** merely a startup cancellation.
- The replay definitively fails at `20260920155456_harden_credit_status_authorization.sql` with PostgreSQL `42P01: relation "public.credit_accounts" does not exist`. The same function references `public.credit_periods`. The migration is timestamped before the recovered archive's `20260920185000_production_credit_control.sql`, so the current chain lacks the required table-creation migration at the point of use.
- The source archive contains `20260920185000_production_credit_control.sql` and `20260920190000_harden_credit_status_authorization.sql`, but the recovered DDL is not accepted as a drop-in fix yet: its five credit amount columns use `numeric(14,2)` while read-only live catalog evidence reports `numeric(18,2)`, and a later committed migration alters `credit_accounts_finance_read` / `credit_periods_finance_read` policies whose creation statements have not been recovered. Do not simply restore these files, reorder applied history, or synthesize missing policy definitions without resolving provenance and compatibility.
- Read-only Supabase inspection reconfirmed production `smm-gateway` is ACTIVE version 8, `verify_jwt=true`, source SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. Its deployed source does not contain `MNTY_SMM_ENABLED` / `SMM_POST_LAUNCH_DEFERRED`; the candidate branch source does contain the guard, but the candidate has not been deployed. Treat live SMM containment as **NOT VERIFIED / P0 OPEN**.
- The candidate PR contains RC459–RC462 restaurant/menu and platform-admin changes, including RC461 tests. Production must not receive those migrations/functions until the full chain and rollout preconditions are satisfied.
- No production database, Edge Function, wallet, payment, Auth, grants, or RLS changes were performed. Current release status remains **BLOCKED / NOT CERTIFIED**.

### Next safe actions

1. Recover authoritative original credit-table and finance-policy creation DDL from repository history, the release archive provenance, or another source that can be verified; compare constraints, generated columns, precision, RLS, grants, and policies to live catalog evidence.
2. If authoritative source cannot be recovered, prepare a separately reviewed forward-repair proposal; do not silently insert a live-derived credit baseline into disposable replay or modify already-applied migration history.
3. Once provenance is resolved, rerun the full clean replay and all exact-head integration jobs. Only after passing, prepare a separately approved SMM containment deployment and negative runtime verification.


## Exact-head replay investigation — 2026-10-12 15:47 UTC

- Rechecked the current PR #207 head `23995409c81b521d1c8cd7eee77069ebc4967b06`. Exact-head replay run [38272815290](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38272815290) failed in job [replay-all-migrations](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38272815290).
- The runner logged repeated Docker Hub `toomanyrequests: Rate exceeded` responses and retried; it then proceeded far enough to run the migration chain. Therefore the final failure is not explained solely by registry throttling.
- The decisive PostgreSQL error is `42P01: relation "public.credit_accounts" does not exist` at `20260920155456_harden_credit_status_authorization.sql`; the function body also references `public.credit_periods`. This confirms the known chronological replay blocker persists on the latest observed PR head.
- Targeted repository code search found the later migration `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` alters `credit_accounts_finance_read` and `credit_periods_finance_read`, but did not locate their authoritative creation statements. No trustworthy repository commit search result recovered the missing source.
- No credit baseline or guessed policy was added. Do not treat this run as a pass, and do not move forward with a production migration or deployment while the schema provenance and clean replay are unresolved.
- Other checks associated with the same PR head completed successfully, including module professionalization, migration version uniqueness, migration history immutability, migration collision guard, marketing/CRM tenant scope, SMM service-role boundary, SMM deferred validation, backend-only boundary, privacy boundary, marketing campaign backend, and approval audit atomicity. These results do not waive the replay failure.
- **Decision remains: BLOCKED / NOT CERTIFIED.** Next work item is authoritative recovery of credit DDL/policy provenance from historical refs/objects or the original release source, then an explicit compatibility review before any migration-chain repair. SMM production containment remains a separate P0 because deployed v8 was previously confirmed without the candidate fail-closed guard; recheck live state before any release decision.


## Read-only production catalog comparison — 2026-10-12

A new read-only catalog query confirms that the credit source discrepancy is broader than numeric precision:

- Live `credit_accounts` / `credit_periods` amount columns use `numeric(18,2)`; the recovered RC40 archive uses `numeric(14,2)` for the corresponding amount columns.
- Live `credit_policies.block_new_credit` defaults to `true`, whereas the archive source defaults it to `false`.
- Live `credit_policies.suspend_after_days` defaults to `15`, whereas the archive source defaults it to `30`.
- Live `credit_policies.grace_days` defaults to `0`, whereas the archive source defaults it to `7`.
- Live catalog confirms permissive finance-read policies named `credit_accounts_finance_read` and `credit_periods_finance_read`, alongside multiple restrictive anonymous-session policies. The exact policy definitions exist in the live catalog, but their authoritative creation migration has not been recovered in the candidate source. A later committed migration alters the finance-read policies, so restoring the archive file alone would not make the chain complete or faithfully reproducible.

These are observed schema/default differences, not authorization to copy live definitions into a synthetic replay baseline. Keep production read-only and release blocked until the source of truth is recovered or a separately reviewed, explicit forward-repair migration is prepared with proven semantics and full clean-replay coverage.

The live Supabase Edge Function read was also repeated: `smm-gateway` remains ACTIVE v8 with `verify_jwt=true` and SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`. The returned deployed source still does not contain the candidate `MNTY_SMM_ENABLED` / `SMM_POST_LAUNCH_DEFERRED` guard. This remains an independent P0 launch blocker; no deployment was performed.


## Continued source-provenance investigation — 2026-10-12 18:45 UTC

Additional bounded recovery work was completed without changing production:

- Scanned the provided `source_RC40.zip` archive (883 entries) across every included SQL migration for the exact policy names `credit_accounts_finance_read` and `credit_periods_finance_read`, and for direct `CREATE TABLE public.credit_accounts/credit_periods` statements outside the known credit-control filenames. This scan did not recover authoritative creation statements for the two finance-read policies.
- Repository code search also found the later migration `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` altering those policies, but no creation source. Commit search queries for credit table/policy creation returned no historical commit evidence through the connected GitHub search interface. These are bounded negative-search results, not proof that no source exists elsewhere.
- The recovered archive's `20260920185000_production_credit_control.sql` remains incompatible with a blind restoration: observed live column precision and policy defaults differ, and the policy provenance is still missing. No guessed schema, policy, or test-only credit baseline was created.
- Fresh read-only production inspection reconfirmed migration ledger head `20261008222845 / rc424_atomic_digital_page_payment_webhook`. `smm-gateway` remains ACTIVE v8, `verify_jwt=true`, deployed-source SHA-256 `c16d88610845d8dbab5ee40f366452a40e9cc021df487d45ebcd8077199ee40f`; the deployed source still lacks the candidate `MNTY_SMM_ENABLED` fail-closed gate.

### Decision and next safe step

The source-recovery path is not yet sufficient to safely repair chronological replay. Continue by inspecting historical repository refs and the release artifact's provenance metadata for the original credit DDL and finance-policy creation source. If no authoritative source is found, prepare a separately reviewed forward-repair proposal with explicit schema/default/policy semantics and an isolated clean-replay test; do not mutate applied history or infer production policy semantics silently.

**Status remains BLOCKED / NOT CERTIFIED.** No production migration, Edge Function deployment, Auth/RLS/GRANT change, wallet operation, payment, or financial data mutation was performed.


## RC40 archive chronology cross-check — 2026-10-12

A checksum-verified scan of the user-provided release artifact found a more precise explanation for the credit replay failure, while also confirming that the archive is not safe to restore blindly:

- `source_RC40.zip` SHA-256 is `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`, matching the supplied `source_RC40.zip.sha256` file.
- The archive contains `supabase/migrations/20260920185000_production_credit_control.sql`, which creates `credit_policies`, `credit_accounts`, and `credit_periods`, followed by `20260920190000_harden_credit_status_authorization.sql`.
- The current PR #207 branch instead contains `20260920155456_harden_credit_status_authorization.sql`, which references `credit_accounts` and `credit_periods` before either table exists in the clean replay sequence. The branch does **not** contain the archive's `20260920185000_production_credit_control.sql` or its `20260920190000` hardening filename. The latest exact-head run [38278645907](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38278645907) fails at that earlier hardening migration with PostgreSQL `42P01`.
- This establishes a concrete source/chronology divergence between the supplied RC40 artifact and the current candidate branch. It does not establish that the archived credit migration is compatible with current production: the already-recorded live-vs-archive differences in amount precision, policy defaults, and finance-read policy provenance remain unresolved.

### Required handling

Do not merely copy or rename the archive migration, reorder timestamped history, or introduce a test-only credit baseline. Preserve both source histories as evidence; reconcile the intended release lineage and review all table constraints, generated columns, defaults, RLS, grants, and policy definitions first. Then make a reviewed candidate-only repair and rerun the entire empty-database chronological replay. Production remains untouched and the release remains **BLOCKED / NOT CERTIFIED**.

## Fail-fast guard verification and structural schema drift — 2026-10-12

The follow-up exact-head workflow on PR #207 now stops before starting disposable Supabase. Run [38279683915](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38279683915) failed at **“Fail closed if the historical schema baseline is missing”** with the explicit message that no approved isolated compatibility baseline exists for `public.credit_accounts` before `20260920155456_harden_credit_status_authorization.sql`. All later replay steps were skipped. This is the intended fail-closed behavior of the new preflight guard, but the workflow is still red and is **not** a successful migration replay.

A fresh read-only live catalog snapshot found further differences between the RC40 table-creation SQL and the current production schema:

- The current read-only live catalog confirms that `credit_accounts.available_amount` and `credit_periods.outstanding_amount` are generated stored columns with the same expressions shown in the RC40 creation migration. This point is **not** a schema difference; the earlier statement that these live columns were ordinary nullable numeric columns was incorrect and is superseded by this correction.
- The archived migration sets `credit_accounts.credit_policy_id` foreign-key deletion behavior to `ON DELETE RESTRICT`; the live catalog reports the default `NO ACTION` behavior.
- The amount precision and credit-policy default differences recorded above remain present. Live finance-read policy definitions are visible in the catalog, but their authoritative creation source remains unlocated.

This strengthens the conclusion that the archived creation migration is not an exact representation of the live schema. The guard correctly prevents a synthetic baseline from hiding this gap. No migration, policy, grant, production object, or financial record was changed.

**Next safe step:** continue source-lineage recovery for the live table definitions and finance-read policy creation, then propose a reviewed candidate-only repair with explicit treatment of generated-vs-ordinary columns, defaults, constraints, and policies. Do not remove the guard merely to turn CI green. Status remains **BLOCKED / NOT CERTIFIED**.


## Evidence correction — generated credit columns — 2026-10-12

A subsequent fresh read-only catalog query corrected the generated-column observation in the preceding section: live `credit_accounts.available_amount` and `credit_periods.outstanding_amount` are both `GENERATED ALWAYS` columns with expressions matching RC40. Therefore, generated-column status is not a demonstrated RC40/live difference. The remaining observed differences still requiring authoritative reconciliation include numeric precision (live `numeric` without typmod vs RC40 `numeric(14,2)`), credit-policy defaults (`grace_days`, `suspend_after_days`, `block_new_credit`), and the foreign-key delete action for `credit_accounts.credit_policy_id`. The finance-read policies are present in the live catalog, but the source that originally created them is still not established. This correction is based on metadata only; no data or schema was changed.

## Production migration-ledger and archive lineage cross-check — 2026-10-12

A read-only query of `supabase_migrations.schema_migrations` confirms the live ledger contains `20260920155456 / harden_credit_status_authorization`, but does **not** contain a credit-table creation migration named `20260920185000 / production_credit_control`. The live catalog nevertheless contains all three credit tables. This proves a ledger/source gap; by itself it does not identify whether the objects originated from an out-of-band change, a different release artifact, or an omitted migration.

A scan of the supplied RC40 ZIP (41 SQL migrations) found only one file creating these tables: `20260920185000_production_credit_control.sql`. Its own hardening migration is timestamped `20260920190000_harden_credit_status_authorization.sql`, while the current candidate's `20260920155456_harden_credit_status_authorization.sql` references `credit_accounts` and `credit_periods` earlier in chronological replay. The archive therefore demonstrates a different migration chronology from the current candidate; it is evidence for lineage recovery, not authority to rewrite the applied ledger.

The latest catalog comparison also confirms the generated stored expressions match RC40. Remaining observed differences include live numeric columns without the archive's `numeric(14,2)` typmod, live `credit_policies.grace_days=0`, `suspend_after_days=15`, and `block_new_credit=true` defaults versus RC40's `7`, `30`, and `false`; and the live `credit_accounts.credit_policy_id` FK has default `NO ACTION` rather than RC40's explicit `ON DELETE RESTRICT`. Live finance-read RLS policies exist, and a later candidate migration alters them to authenticated; their original creation source has not been recovered.

**Safe conclusion:** do not add the archive migration directly to the current history or fabricate a baseline. Recover the intended canonical release artifact and decide, with review, whether the correct remedy is to restore a missing earlier migration, make a forward-only migration, or align a separately approved disposable fixture. No production schema, data, policy, grant, or migration ledger was changed.

## Latest rerun and evidence status — 2026-10-12

The latest workflow for the current PR #207 head, [run 38280424261](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38280424261), again failed only at **“Fail closed if the historical schema baseline is missing”**; all Docker/Supabase startup and replay steps were skipped. The migration-history immutability, migration-version uniqueness, cross-PR collision, approval-audit atomicity, marketing backend/CRM, SMM deferred-source, SMM service-role, backend boundary, and MantiGO privacy checks reported success in this run set. Module Professionalization Validation was still queued at the time of this note, so no final result is claimed for that job. The web workflow's deployment step remains skipped.

This is consistent with the unresolved source/chronology mismatch documented above. It is not a green replay and does not authorize production release.

## Expanded dependency guard result — 2026-10-12

The dependency preflight was tightened to include `credit_policies`, which is required by the foreign key in `credit_accounts` and was also missing from the candidate's earlier chronological creation history. The exact-head run [38280663419](https://github.com/islamnagy2022-eng/MantiQatiX/actions/runs/38280663419) now fails with the specific message: `no approved isolated compatibility baseline exists for public.credit_policies before 20260920155456_harden_credit_status_authorization.sql`. It stops before Docker/Supabase startup, as intended. This is a more complete dependency diagnosis, not a replay fix.

Do not create this baseline automatically from inferred schema. If a test-only compatibility fixture is later explicitly approved, it must cover the complete dependency chain and be provenance-marked, isolated to disposable replay, and tested for exact live-derived shape without pretending to recover historical DDL.


## Owner approval — disposable credit schema compatibility baseline — 2026-10-13

The owner approved a **new live-derived compatibility schema for disposable CI replay only** after the missing historical credit DDL could not be recovered from the inspected Git history, migration ledger, or RC40 archive. This approval does not make the fixture historical DDL, does not authorize production changes, and does not resolve why the production ledger lacks the original creation migration.

Three fixtures have now been added under `supabase/tests/baselines/`:
- `credit_policies.sql`
- `credit_accounts.sql`
- `credit_periods.sql`

The disposable replay workflow injects temporary, untracked copies at versions `20260920155450`, `20260920155451`, and `20260920155452`, immediately before the dependent `20260920155456_harden_credit_status_authorization.sql`. The fixtures include the observed column types/defaults, generated stored amount columns, constraints, indexes, and RLS enabled/forced state. The later committed `20260920211717_security_definer_surface_reduction_and_finance_rls.sql` remains responsible for creating finance-read policies; those policies are intentionally not duplicated in the baseline. Extra restrictive policies seen in the current live catalog are not inserted because their creation lineage is not represented in the applied ledger.

The validator now checks explicit approval/provenance wording, required schema shape, generated columns, RLS, no-data constraints, timestamp ordering, temporary-file collision avoidance, and the presence of the ordered finance-policy migration. The workflow verifies exact fixture copies and that temporary migration files remain untracked.

**Interpretation:** a passing replay with these fixtures will prove that the current candidate migrations can replay after a clearly disclosed live-derived compatibility starting point. It will **not** prove historical migration fidelity, explain the production ledger gap, or certify production parity. A fresh exact-head CI run and all other release gates remain required. Production database, migration ledger, financial data, grants, RLS, Auth, secrets, and deployed functions remain unchanged.

## Exact-head replay continuation — 2026-10-13

- Reviewed branch head `5170eb2c0d50efaca16af401ddc4959cdc8386c7` and workflow run [38347614461](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38347614461). The credit-baseline preflight, temporary fixture injection, exact-copy/untracked/no-row-import guard, disposable Supabase startup, and the three credit compatibility migrations all passed.
- The chronological replay then failed at `20260920211717_security_definer_surface_reduction_and_finance_rls.sql`, statement 2: `relation "public.payment_provider_events" does not exist`. The failing statement attempts to create `payment_provider_events_finance_read`.
- Repository search did not locate an authoritative earlier `CREATE TABLE public.payment_provider_events` migration. Later index/policy references and historical row-count notes do not establish its column definitions, constraints, grants, or RLS posture.
- No owner-approved schema-only baseline exists for this financial event table. Therefore no fixture, policy, or guessed constraint was added. The migration replay remains **FAIL / NOT CERTIFIED** pending authoritative creation DDL or explicit owner approval for a separate disposable-only schema fixture grounded in read-only catalog evidence.
- Added a fail-closed preflight to `scripts/validate-historical-schema-baseline.mjs` so this missing dependency is reported before Docker/Supabase startup rather than after a costly partial replay. The preflight does not create or alter any database object. Commit: `ebafdf51e3142d66b13e02e716c6228732972bf6`.
- The three credit baselines were reviewed for the observed column types/defaults, generated stored columns, PK/unique/FK/check constraints, indexes, and ENABLE/FORCE RLS. They contain schema DDL only and no INSERT/COPY of production or financial rows. Their temporary migration copies are injected only by the disposable CI workflow and checked for exact byte copies and untracked status. They intentionally do not add policies whose source history is not established.
- Production database/schema, applied migration ledger, financial records, grants, RLS, Auth settings, and deployed functions were not changed. PR #207 remains draft/unmerged. The current candidate still cannot claim a successful full chronological replay or production readiness.

### Fail-closed guard execution — 2026-10-13

- On candidate source commit `143827aedb746092c7c256d6c71f0cd8087c2878`, replay workflow [38348273334](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38348273334) executed the updated validator successfully as a negative test: it reported the missing `public.payment_provider_events` creation dependency and stopped before baseline injection or Supabase startup.
- The run's PR merge ref was `9ae5f5cd1e913d7e02dc140ef611d400604be585`; this is CI's synthetic merge commit, not a branch commit and not a production revision.
- The guard is intentionally a blocker, not a passing replay. No financial-table baseline was synthesized or approved in this work. Full chronological replay, final schema parity, and release certification remain **NOT VERIFIED / BLOCKED**.

### Credit baseline type reconciliation — 2026-10-13

- During the required type-level review, the committed credit fixtures were found to declare amount columns as `numeric(18,2)`, while the existing read-only catalog reconciliation in this document records live amount columns as unconstrained `numeric` (no precision/scale typmod). The fixture and its validator had therefore contradicted the recorded evidence.
- Corrected `credit_policies.credit_limit`, `credit_accounts.approved_limit`, `credit_accounts.outstanding_amount`, `credit_accounts.available_amount`, `credit_periods.billed_amount`, `credit_periods.paid_amount`, and `credit_periods.outstanding_amount` to use unconstrained `numeric`; updated the validator to require that shape rather than accepting `numeric(18,2)`.
- The fixtures retain their generated stored expressions, declared FK/unique/check constraints, indexes, and ENABLE/FORCE RLS statements. This correction only aligns type declarations with the documented catalog evidence; it does not recover historical creation DDL or prove full parity. A new exact-head CI run is required.
- Relevant source commits: `717f5d96c22c18de2c44d89899b2b4da5b4e598a`, `2ca649ca3c719939c514fb3895319d2f682e817a`, `67c4c9233af67e904b282fed71190d1d7fe161af`, `d8877ed750015006880e3775a9e7aba5b8479ce5`, `8a6ad601ee73b5cee45e3a73a94ac0d4abd72add`, and validator commit `d36f66117bd45b489d01ddc70b3555590c79de8f`.

### Credit-type correction verification — 2026-10-13

- Candidate source commit `42e13ccbf2aec909ec22c6b735cdcc3799b58e15` ran replay workflow [38348433595](https://github.com/islamnagy2022-eng/MantiqaTix/actions/runs/38348433595).
- The validator passed the credit-baseline checks with unconstrained `numeric` amount types and then failed closed at the documented `payment_provider_events` historical dependency before Supabase startup. This confirms the new type checks accept the corrected fixture shape; it does **not** constitute a full replay pass.
- The replay remains **BLOCKED / NOT CERTIFIED** until authoritative creation DDL for `payment_provider_events` is recovered or the owner separately approves a properly evidenced disposable-only schema contract. Do not use a guessed table shape to proceed.
## 2026-10-13 — Read-only catalog recovery and next replay dependency

### payment_provider_events schema evidence

The previous preflight stopped at 20260920211717_security_definer_surface_reduction_and_finance_rls.sql because no earlier repository migration creates public.payment_provider_events. A fresh read-only catalog query against project moyhiluyhjsujhwlyeuu on 2026-10-13 recovered its current schema shape:

- Columns in order: id varchar NOT NULL, tenant_id varchar NOT NULL, provider varchar NOT NULL, event_type varchar NOT NULL, payment_intent_id varchar NULL, external_event_id varchar NOT NULL, status varchar NOT NULL DEFAULT 'RECEIVED', signature_verified boolean NOT NULL DEFAULT false, payload_hash varchar NULL, raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb, processed_at timestamptz NULL, error_message text NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP.
- Constraints: primary key (id); unique (provider, external_event_id); payment_intent_id references payment_intents(id) ON DELETE SET NULL; tenant_id references tenants(id) ON DELETE RESTRICT.
- Existing secondary indexes: idx_payment_provider_events_payment_intent_id and idx_payment_provider_events_tenant_id; the chronological RC256 migration is responsible for creating these indexes during replay.
- Current security metadata: RLS enabled and FORCE RLS enabled. The existing payment_provider_events_finance_read policy is SELECT-only for authenticated, scoped by active tenant membership and the OWNER/ADMIN/FINANCE/ACCOUNTANT/FINANCE_MANAGER role set. The ordered historical policy migration remains the only source for that policy; the fixture intentionally contains no policy or grants.
- A read-only privilege query returned ACL postgres=arwdDxtm/postgres, authenticated=rm/postgres, service_role=Dxtm/postgres; anon has no SELECT/INSERT, authenticated has SELECT but no INSERT, and service_role has no SELECT/INSERT/UPDATE/DELETE table privileges according to has_table_privilege. This is a separate P0 payment-webhook runtime concern because the repository/live webhook source reads this table and the write path must be verified against actual privileges/RPCs before launch. Do not grant privileges in production as part of replay work; establish the intended least-privilege write boundary and a separately authorized rollout plan.
- No table rows, provider payloads, event IDs, credentials, or other production data were queried or copied.

### Disposable-only fixture

Added supabase/tests/baselines/payment_provider_events.sql as a read-only-catalog-verified compatibility fixture. It defines the observed columns and constraints, enables and forces RLS, and intentionally excludes policies/grants and all data. CI copies it byte-for-byte to 20260920211716_test_only_live_derived_payment_provider_events_baseline.sql in the disposable workspace only, immediately before the ordered finance-read policy migration. The validator checks the fixture's documented provenance, critical shape, RLS/FORCE RLS, absence of policies/grants/data-import statements, timestamp order, and the policy migration's expected role contract. This is not recovered historical DDL and is never for production use.

### Credit typmod correction

A fresh read-only information_schema.columns query on the same project returned numeric_precision=18 and numeric_scale=2 for all seven amount/generated columns across credit_policies, credit_accounts, and credit_periods. The earlier candidate edit changing these to unconstrained numeric was incorrect and has been reverted in all three fixtures and the validator. Current source now requires numeric(18,2), matching the latest live catalog evidence. This correction supersedes the interim type claim in the 2026-10-13 execution trail; no production change was made.

### Evidence status

- Verified by read-only live catalog queries: current table columns/defaults, constraints, indexes, RLS/FORCE RLS, finance-read policy, and table ACL as described above.
- Implemented in branch: catalog-verified disposable baseline, fail-closed schema/policy validation, and exact-copy/untracked/no-data CI injection guard.
- NOT VERIFIED yet: exact-head CI result for the latest source changes; complete chronological replay; final schema parity; webhook service-role write success in production; end-to-end payment/idempotency behavior.
- Release remains BLOCKED / NOT CERTIFIED.

## 2026-10-13 — Settlement attempts replay blocker

Exact-head replay run 38349796102 (candidate 5221973aad1cb37ebd411e6d896c57732da111d3) passed preflight and disposable-only baseline injection, then failed in 20260920211717_security_definer_surface_reduction_and_finance_rls.sql while creating settlement_attempts_finance_read: ERROR: relation "public.settlement_attempts" does not exist (SQLSTATE 42P01).

Read-only catalog evidence on project moyhiluyhjsujhwlyeuu recovered the current settlement_attempts shape: id, tenant_id, obligation_id, provider, destination_id, amount, currency, status, external_reference, failure_code, failure_message, created_at, updated_at; PK(id); CHECK(amount > 0); FKs to payout_destinations, financial_obligations and tenants with ON DELETE RESTRICT; UNIQUE(obligation_id, external_reference); index idx_settlement_attempts_obligation on (obligation_id, created_at DESC); RLS enabled and forced; current finance-read policy SELECT-only for authenticated roles OWNER/ADMIN/FINANCE/ACCOUNTANT/FINANCE_MANAGER. The observed index/creation source was not found in tracked migration history, so it is represented only in the disposable compatibility fixture.

Implemented supabase/tests/baselines/settlement_attempts.sql and validator checks. CI injects it as 20260920211715_test_only_live_derived_settlement_attempts_baseline.sql before the existing payment_provider_events fixture and historical policy migration. Fixture deliberately omits policy/grants/data and is not historical DDL. No production change.

Latest candidate head after this work: 6b481ca4ea8d1b8d8855871db49b2ca262ad1801. Replay run 38350384105 is pending/in progress; its outcome is NOT VERIFIED. Release remains BLOCKED / NOT CERTIFIED.

## 2026-10-13 — Missing SMM bootstrap function during chronological replay

Replay run 38350577917 passed the preflight and disposable baseline guards, then failed on migration 20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql with `ERROR: function public.smm_bootstrap_first_admin() does not exist (SQLSTATE 42883)`. The migration only revokes EXECUTE; the function is not created by tracked earlier migration history.

Read-only live catalog evidence confirms the function exists in production as SECURITY DEFINER, RETURNS trigger, search_path public, with ACL postgres-only. Added schema/function-definition-only fixture `supabase/tests/baselines/smm_bootstrap_first_admin.sql`, injected at temporary replay version 20260927033924 only, before the historical revoke migration. The fixture is never invoked and includes no trigger creation or standalone data mutation. Validator checks exact signature, body contract, SECURITY DEFINER/search_path, version order and historical revoke statement. This does not recover historical provenance or unfreeze SMM feature development.

Candidate head after this change: ee839091a7494300a85eb094595549f136c47ac2. Exact-head replay run 38350836940 is pending; full replay remains NOT VERIFIED. Release remains BLOCKED / NOT CERTIFIED.

## RC40 source archive check — settlement and SMM function provenance

The uploaded `source_RC40.zip` was inspected locally (883 archive entries; SQL/source/document files searched for `settlement_attempts` and `smm_bootstrap_first_admin`). The only occurrence was in `supabase/migrations/20260921154500_phase18_phase19_webhook_and_rls_hardening.sql`, which conditionally adds the restrictive `authenticated_sessions_only` policy to an existing `settlement_attempts` table and creates indexes including `idx_payment_provider_events_payment_intent_id`. It does **not** create `settlement_attempts`; no `smm_bootstrap_first_admin` function definition exists in that archive. This corroborates that the current table/function creation lineage is absent from the supplied RC40 archive. The RC40 migration is not copied into the candidate history because it contains a broader set of policy/index operations and its application state/source provenance must be reconciled separately. The catalog-derived fixtures remain disposable-only compatibility scaffolding, not recovered historical DDL.

## 2026-10-13 — Registration baseline was later than first dependency

Run 38350881761 advanced through the SMM bootstrap fixture and then failed at 20260927065247_mnty_atomic_registration_review.sql because public.account_registration_requests did not exist (SQLSTATE 42P01). The earlier compatibility fixture version 20260927074155 was too late; the previous validator incorrectly treated 20260927134000_add_unique_pending_membership_request.sql as the first dependency.

Corrected the chronology by splitting the existing owner-approved live-derived registration fixture:
- Schema/constraints/indexes/RLS only: `supabase/tests/baselines/account_registration_requests_schema.sql`, injected as temporary `20260927065246_test_only_live_derived_registration_schema_baseline.sql` before 27065247.
- Policies/grants only: `supabase/tests/baselines/account_registration_requests.sql`, injected as temporary `20260927074155_test_only_live_derived_registration_security_baseline.sql` after the atomic review RPC migration. The pending unique index remains owned by 20260927134000.

The validator now checks provenance, table constraints, RLS/no-policy/no-grant for the schema fixture, the separate policy/grant contract, and temporary version collisions/order. No production changes were made. Candidate code head 14cae3a824dbac5e2da85ad90d05b1c303a460b4; exact-head replay is not yet verified. Release remains BLOCKED / NOT CERTIFIED.

## 2026-10-13 — Missing approval_requests policy dependency

Run 38351334323 passed the baseline preflight and all disposable fixture guards, then failed at 20260927140500_remove_anonymous_sensitive_policy_access_v2.sql with `ERROR: policy "approval_requests_scoped_read" for table "approval_requests" does not exist (SQLSTATE 42704)`.

Read-only live catalog evidence confirms the policy exists on public.approval_requests as SELECT TO authenticated, scoped to active tenant membership and requester/OWNER/ADMIN/SUPER_ADMIN/MANAGER visibility. Repository search finds only the ALTER POLICY statement; the supplied RC40 archive has no policy-creation source. Added `supabase/tests/baselines/approval_requests_scoped_read.sql` as a policy-only, live-derived compatibility fixture at temporary version 20260927140499 before the historical ALTER POLICY migration. Validator verifies its security contract, absence of earlier tracked creation, no table DDL/grants/data, and timestamp ordering. This fixture is not historical policy provenance and is never for production.

Candidate head after code changes: e7fcd20f5c9a125d2a99590cb56a688086ab95cb. Exact-head replay result NOT VERIFIED. Release remains BLOCKED / NOT CERTIFIED.


## 2026-10-13 — Missing commission finance-read policy dependency

The latest disposable chronological replay run `38351761328` progressed beyond the SMM bootstrap function after the trigger-function compatibility baseline was actually injected at `20260927033924`. It then failed at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` with:

```
ERROR: policy "commission_transactions_finance_read" for table "commission_transactions" does not exist (SQLSTATE 42704)
At statement: 17
alter policy commission_transactions_finance_read on public.commission_transactions to authenticated
```

Read-only production `pg_policies` evidence for `public.commission_transactions` confirms the policy is `SELECT TO authenticated`, constrained to an ACTIVE membership in the same tenant and roles `OWNER, ADMIN, MANAGER, FINANCE, ACCOUNTANT, FINANCE_MANAGER`. Repository search found the historical ALTER statement but no earlier committed policy-creation source.

### Safe diagnostic fix in PR #207

- Added `supabase/tests/baselines/commission_transactions_finance_read.sql`, a policy-only, catalog-derived fixture with explicit test-only provenance. It contains no table DDL, grants, trigger, or data writes.
- Added a validator contract requiring the live-derived source note, tenant and user scope, ACTIVE membership, the exact finance role set, absence of a prior committed policy creator, a unique temporary version, and ordering before the historical ALTER.
- Updated the replay workflow to inject an exact copy only into the disposable database at temporary version `20260927140498`, verify exact-copy/untracked status, and include it in the no-data-write guard. The fixture must never be applied to production.
- This diagnoses one more missing historical policy dependency; it does not recover canonical history or certify the replay.

Current exact-head CI after these changes: pending at commit `9c09ac5ba2e92b867acd71099b866b62315e854e` when this note was written. The next replay result must be read from that exact head; no pass is inferred.

No production schema, data, migration ledger, RLS, grants, Auth, wallet, or payment state was changed. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — Second missing finance policy dependency

Replay run `38352389561` verified the commission policy fixture and progressed further, then failed at statement 17 of `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` with:

```
ERROR: policy "general_ledger_finance_read" for table "general_ledger" does not exist (SQLSTATE 42704)
```

A read-only `pg_policies` query against production confirms `general_ledger_finance_read` is a permissive `SELECT TO authenticated` policy scoped to the caller's ACTIVE tenant membership and finance-capable roles `OWNER, ADMIN, MANAGER, FINANCE, ACCOUNTANT, FINANCE_MANAGER`. Repository search did not find a prior committed `CREATE POLICY general_ledger_finance_read`; the historical file only alters the policy's role audience.

Safe disposable-only response on the migration-owning branch:
- Added `supabase/tests/baselines/general_ledger_finance_read.sql` from the read-only catalog predicate, explicitly marked as test-only and not historical recovery.
- Added validator checks for tenant/user/status/role scope, no DDL/grants/data, no earlier creator, and a unique version before the historical ALTER.
- Added exact-copy, untracked, and no-data-write checks in the replay workflow. Temporary version `20260927140497` sorts before the commission fixture at `20260927140498`, approval fixture at `20260927140499`, and historical ALTER at `20260927140500`.

The next replay on code head `8ada230565bb9fd8f2ba745440fb3c4175b4c612` was pending at last check. The previous run demonstrates that the commission-policy preflight no longer stops the replay; it is not a full replay PASS. Keep historical provenance unresolved and production release **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — SMM trigger creation dependency (SQLSTATE 42883)

Exact failed replay run [38350577917](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38350577917) stopped at `20260927033925_harden_smm_bootstrap_trigger_execute_privilege.sql` because `public.smm_bootstrap_first_admin()` did not exist in the disposable database. A read-only live catalog query confirms the function exists in production, is SECURITY DEFINER with `search_path=public`, and cannot be executed directly by `anon` or `authenticated`.

Root cause: the tracked migration history contains the privilege-lockdown migration but not the earlier function-creation migration. A live-derived, explicitly test-only function fixture exists, but the full reset did not materialize it before the lockdown migration. The replay workflow was changed in commit `ae5f6f63672a0aa2947f3d20fc70cae7e99ff6d0` to:
1. Reset the disposable database only through temporary version `20260927033924`.
2. Apply the reviewed function definition directly to the disposable Postgres container.
3. Apply the real historical lockdown migration `20260927033925` and verify PUBLIC/anon/authenticated EXECUTE is denied.
4. Continue the rest of the migration chain.

Run [38354483080](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38354483080) is still in progress at Supabase service startup. This is a harness correction plus a test-only compatibility baseline, **not** recovery of historical DDL. Do not alter production or treat the chain as PASS until the full replay finishes and all later gaps are resolved.


## 2026-10-13 — Next historical source gap: marketing_leads

- Read-only production catalog evidence confirms `public.marketing_leads` exists with UUID PK, requester/business/provider FKs, status/source check constraints, `idx_mkt_leads_status`, RLS + FORCE RLS, and the live policies `Users view own marketing leads`, `Users create marketing leads`, and `CRM managers view marketing leads`.
- Read-only `supabase_migrations.schema_migrations` query returned no migration whose name identifies marketing-lead creation. Repository search also found no earlier committed `CREATE TABLE public.marketing_leads` migration. The chronological replay fails at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` because its `ALTER POLICY "Users view own marketing leads"` cannot run without the table/policy.
- Added `supabase/tests/baselines/marketing_leads.sql` as a catalog-derived, test-only compatibility fixture and temporary migration version `20260927140496`. It contains no operational data and is injected only into a disposable replay. It includes only the owner-read policy required by the historical `ALTER POLICY`; later RC444/RC452 remain the owners of CRM-manager/insert policies.
- The baseline validator now checks the exact live-derived table shape, FK/check constraints, RLS, policy, no-data/no-grant/no-trigger properties, missing prior creator, and ordering before the historical policy migration. The workflow verifies exact copy/untracked status before starting Supabase.
- Workflow harness root fixes: replaced unstable Docker container discovery with a local DB URL; removed the unsupported `supabase migration up --local --version` usage, which returned the CLI version instead of targeting a migration. The workflow now applies the ACL SQL directly in disposable Postgres for the preflight assertion, then runs the normal migration runner so it records/replays the idempotent statement.
- Latest replay run [38356535239](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356535239) has passed source/baseline validation and exact-copy checks, and is in disposable Supabase startup. Full chronological replay remains **IN PROGRESS / NOT VERIFIED**.
- The test-only baseline is not historical-source recovery. Do not apply it to production, insert live rows, or treat replay as PASS until all subsequent migrations complete.


## 2026-10-13 — Latest chronological replay failure: marketing participants

Exact-head disposable replay [run 38356679251](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38356679251) progressed through the approved disposable-only historical fixtures and then failed at:

`20260927140500_remove_anonymous_sensitive_policy_access_v2.sql`

with:

`ERROR: relation "public.marketing_project_participants" does not exist (SQLSTATE 42P01)`

### Read-only live catalog evidence
A read-only query confirmed that `public.marketing_project_participants` exists in the live project and has:
- UUID primary key `id`; UUID `project_id` and `provider_id`; role, allocation_percent, agreed_value, status, created_at columns.
- FK `project_id → marketing_projects(id) ON DELETE CASCADE`; FK `provider_id → marketing_provider_profiles(id) ON DELETE RESTRICT`.
- Unique key `(project_id, provider_id, role)`, check constraints for allocation (0–100), nonnegative agreed value, role set, and status set.
- RLS enabled and FORCE RLS enabled.
- One intended provider SELECT policy plus three overlapping authenticated non-anonymous guards; these policies require separate contextual review and must not be blindly copied into a fixture.
- The only explicit non-owner table grants returned by the catalog query for `service_role` were REFERENCES, TRIGGER, and TRUNCATE; this is not proof of the complete function execution path.

### Decision
- [PR #235](https://github.com/islamnagy2022-eng/MantiqatiX/pull/235) adds a fail-closed preflight so this missing historical dependency is reported before starting the local Supabase stack.
- No test baseline was fabricated for this table. Existing approved disposable baselines for SMM tables and other historical objects do not automatically authorize a marketing participant baseline.
- Current live schema is not a substitute for canonical historical creation DDL; policies/grants/ownership and dependency order need provenance and explicit review.

### Next step
Recover the original creation migration or obtain explicit, narrowly scoped approval for a disposable-only live-derived schema snapshot for this exact table. If approved, record schema hash/provenance, include no production rows, verify policy/grant expectations separately, and inject only in the disposable test workspace before the first dependent migration. Do not add it to `supabase/migrations` and never apply it to production.

Release remains **BLOCKED / NOT CERTIFIED**.


### Historical source recovery attempt — 2026-10-13

The source search was extended beyond the current migration directory:
- Searched the supplied RC40 archive `source_RC40.zip` (SHA-256 `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`) for `marketing_project_participants` across SQL/Markdown/JSON files; no matching source file/content was found.
- Searched repository commit history and pull-request metadata for `marketing_project_participants`, “marketing project participants”, and “create marketing project participants”. No creation migration was found. PR #51 changes only `scripts/validate-module-runtime-contracts.mjs` and `web/operations-modules.js`; it does not contain schema DDL.
- The live catalog inspection remains the only currently found structural evidence, and does not establish original DDL provenance.

**Conclusion:** original creation DDL is not recovered by the supplied archive or the searched repository/PR history. Continue fail-closed. Do not generate an assumed production migration or broaden prior test-baseline approvals. The remaining safe dependency is an authoritative historical SQL export/backup/deployment record, or explicit owner approval scoped only to a disposable schema fixture with provenance and no production rows.


## 2026-10-13 — marketing project table dependency found in clean replay

### Exact evidence
- Latest PR #207 replay run [#38404099600](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38404099600), tested from PR #207 head `854935bf0bdd524bb7bf28453a7c34253c731e71`, successfully started disposable Supabase and advanced through the test-only SMM, registration, provider-profile, marketing-lead, finance-policy and approval-policy baselines.
- It then failed in `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` at `ERROR: relation "public.marketing_project_participants" does not exist (SQLSTATE 42P01)`.
- Read-only production catalog inspection confirms `public.marketing_project_participants` and `public.marketing_projects` both exist. Their complete column lists, constraints, indexes, RLS enabled/forced state, policies and table grants were inspected; no operational rows were queried or copied.
- A read-only search of the applied migration ledger finds no canonical CREATE TABLE statement for either table. The only matching historical statement is the 2026-09-27 policy-hardening migration that alters their existing policies. Repository code search likewise did not recover their canonical table-creation DDL.
- `marketing_project_participants` depends on `marketing_projects` and `marketing_provider_profiles`; `marketing_projects` depends on `marketing_leads` and `businesses`. The existing test-only marketing-leads baseline already supplies the first/parent dependency chain, so this patch extends that same isolated compatibility baseline with the two catalog-derived tables in dependency order.

### Isolated-only change
- Extend `supabase/tests/baselines/marketing_leads.sql` to create `marketing_projects` then `marketing_project_participants` after `marketing_leads`, using only read-only catalog-derived columns, constraints, indexes, RLS, the two policy definitions required by the historical ALTER POLICY migration, and observed least-privilege table grants.
- Extend `scripts/validate-historical-schema-baseline.mjs` to fail closed unless both tables' dependencies, constraints, indexes, RLS, policy predicates and grants are present and the chronological ALTER POLICY statements still exist.
- The workflow injects this file only as a temporary untracked migration in the disposable CI workspace before `20260927140500`. No new committed file is added under `supabase/migrations`, and no production table/schema/data/policy/grant is changed.
- This does **not** recover historical DDL. The fixture uses the current read-only catalog shape and current observed policy role targets; it must be described as synthetic-baseline-assisted replay. The production release gate remains blocked until source provenance, security parity and the complete replay are independently accepted.

### Verification still required
- Run the historical schema baseline validator and migration history immutability/version-uniqueness gates on the updated exact PR head.
- Inspect the next chronological replay failure without skipping migrations or inventing dependencies.
- A successful run of this synthetic-baseline-assisted replay is necessary but not sufficient for release certification.


## 2026-10-13 — second marketing policy dependency exposed

- After the project/participant compatibility additions, replay run [#38406227251](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38406227251), tested at `b30aa0fe1e41fe7f0216a8fa816dc17a65e71b74`, passed baseline provenance checks, exact-copy/untracked checks, migration version uniqueness, and migration-history immutability. It started disposable Supabase and passed the earlier `marketing_project_participants` dependency.
- The next failure was `ERROR: relation "public.marketing_provider_subscriptions" does not exist (SQLSTATE 42P01)` during `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql`.
- Read-only production catalog inspection found `marketing_provider_subscriptions` depends on `marketing_plans` and `marketing_provider_profiles`; no canonical CREATE TABLE statements for either `marketing_plans` or `marketing_provider_subscriptions` were found in the applied migration ledger/source search. Both tables' columns, constraints, indexes, RLS, policies and observed grants were inspected without reading operational rows.
- Extended the same disposable-only compatibility fixture with `marketing_plans` followed by `marketing_provider_subscriptions`, preserving the observed FK, CHECK/UNIQUE constraints, owner-view policy predicate, RLS/FORCE RLS, and least-privilege grants. Extended the baseline validator to require these contracts and the chronological `Owners view their subscriptions` ALTER POLICY statement.
- Static pattern checks against the updated baseline and applied ALTER POLICY migration all passed. These are source-level checks only; the next exact-head GitHub Actions run must verify the Node validator and continue the full replay.
- As before, the baseline is catalog-derived compatibility scaffolding, not historical source recovery. No production data, schema, grants, Auth/RLS, or migration ledger was changed. Release remains **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — missing payment-events finance-read policy source

- Exact replay run [#38406719880](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38406719880), tested at `4307e952d23961883b23ebfa8fda16faec00c768`, passed the baseline preflight, exact-copy/untracked checks, disposable Supabase startup, and advanced past the newly supplied marketing table dependencies.
- It failed at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` with `ERROR: policy "payment_events_finance_read" for table "payment_events" does not exist (SQLSTATE 42704)`.
- Read-only production `pg_policies` inspection found the exact policy as SELECT/ PERMISSIVE / `authenticated`, with an active same-tenant membership and finance-role allowlist (`OWNER`, `ADMIN`, `MANAGER`, `FINANCE`, `ACCOUNTANT`, `FINANCE_MANAGER`). RLS and FORCE RLS are enabled on the table. Direct SELECT is denied to `anon` and `authenticated`; service-role SELECT is present. No rows were queried.
- Added `supabase/tests/baselines/payment_events_finance_read.sql`, a policy-only catalog-derived fixture, and temporary CI injection at `20260927140493_test_only_live_derived_payment_events_finance_read.sql`, before the historical ALTER POLICY migration. It contains no table DDL, grants, or data.
- Extended the historical-baseline validator to verify the exact predicate, role scope, provenance labels, temporary version ordering, no pre-existing canonical policy creator, and the matching chronological ALTER POLICY statement.
- This fixture is synthetic policy compatibility, not recovered historical policy-creation DDL. The updated exact-head CI must pass preflight and proceed further before any new status can be assigned. Production remains unchanged; release stays **BLOCKED / NOT CERTIFIED**.


## 2026-10-13 — replay fixture verifier variable fix

- The first CI run after adding `payment_events_finance_read` failed before database startup in the temporary-baseline verification step with Bash `set -u` error: `payment_events_policy_baseline: unbound variable`.
- Root cause: the new baseline/migration variables were added to the injection step but not to the separate verification step's local variable declarations. This is a CI workflow wiring defect, not a SQL or production failure.
- Fixed by declaring both `payment_events_policy_baseline` and `payment_events_policy_migration` in the verification step as well. The workflow now contains two declarations for each variable (one per step), matching the step-local shell scope.
- The next exact-head CI run must prove the exact-copy/untracked step passes before replay resumes. No production state was changed.


## 2026-10-13 — settlement transaction finance policy dependency

- Replay run [#38408000724](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38408000724), on head `7016250e763a4b0729fd2bb3c4553c79ea5e47ce`, passed the baseline preflight and exact-copy/untracked checks and replayed through the new payment-events policy baseline.
- It then failed at `20260927140500_remove_anonymous_sensitive_policy_access_v2.sql` with `ERROR: policy "settlement_transactions_finance_read" for table "settlement_transactions" does not exist (SQLSTATE 42704)`.
- Read-only production catalog inspection confirmed a SELECT policy scoped to `authenticated`, active same-tenant membership, and the finance-role allowlist. RLS and FORCE RLS are enabled; direct SELECT is denied to `anon` and allowed to `authenticated`/service role. No settlement or payment rows were read.
- Added a policy-only fixture `supabase/tests/baselines/settlement_transactions_finance_read.sql`, injected only into disposable replay at `20260927140492_test_only_live_derived_settlement_transactions_finance_read.sql`. It contains no table DDL, grants, or rows. The historical-baseline validator now checks the exact policy contract, provenance, no-data/no-DDL rules, version ordering, and matching historical ALTER POLICY statement.
- This is catalog-derived policy compatibility, not recovered historical policy-creation DDL. The next exact-head run must pass the fixture copy guard and replay farther before status can change. Production is unchanged; release remains **BLOCKED / NOT CERTIFIED**.
