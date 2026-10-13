# S03 — PostgreSQL SECURITY DEFINER Audit (read-only)

- Date: 2026-10-13
- Repository: `islamnagy2022-eng/MantiqatiX`
- Reference PR: #218 (open, draft, unmerged)
- Supabase project: `moyhiluyhjsujhwlyeuu`
- Auditor: S03
- Status: **IN PROGRESS — NOT CERTIFIED**
- Safety: production checks were SELECT/catalog/advisor reads only. No GRANT/REVOKE, migration, DML, deploy, merge, or financial/operational RPC execution was performed.

## Scope and method

Audited catalog entries in non-system schemas where `prosecdef = true` and the current roles `anon` or `authenticated` have EXECUTE, excluding the four S02-owned functions:
- `get_mantigo_admin_dashboard_backend`
- `get_mantigo_admin_financial_report_backend`
- `settle_mantigo_captain_backend`
- `expire_stale_mantigo_rides_backend`

Production queries inspected identity arguments, owner, `proconfig/search_path`, effective EXECUTE privileges, and selected complete definitions. Supabase Security Advisor was queried. Catalog grants are not proof that every function is reachable over PostgREST; schema exposure and API routing are separate considerations.

## Verified production inventory

- Callable SECURITY DEFINER overloads in scope: **45**.
- `anon` can execute: **1** (also executable by `authenticated`).
- `authenticated` can execute: **45**.
- Missing explicit `search_path` setting among these functions: **0**.
- Security Advisor reports **1** `anon_security_definer_function_executable` finding and **40** `authenticated_security_definer_function_executable` findings. Advisor coverage is API-facing and therefore is not expected to match the full catalog count exactly (the catalog includes `private` schema functions).
- These role counts overlap; do not add them to derive a unique-function total.

## Finding A — public targeted-advertisement RPC

**Classification: Intended-public behavior requiring documented contract and further validation; no confirmed exploit established.**

Function: `public.get_mnty_targeted_advertisements(p_country_code, p_governorate_code, p_center_code, p_lat, p_lon, p_ad_space_id, p_limit)`

Observed facts:
- `SECURITY DEFINER`; explicit `search_path = public, pg_temp`.
- `anon` and `authenticated` have EXECUTE.
- The definition reads from `public.advertisements`, `public.advertisement_target_locations`, `public.platform_geo_areas`, and `public.platform_global_advertisements`.
- It filters ads to `status='ACTIVE'`, `approval_status='APPROVED'`, and current start/end windows.
- It returns ad title, creative/target URLs, ad-space, match level, and distance.
- `p_limit` is clamped to 1–50 (default 3).
- The inspected definition is static SQL; no dynamic EXECUTE statement was found.

Assessment:
- Anonymous reads are plausibly required for ads shown to signed-out visitors. The advisor finding alone is not proof of a vulnerability.
- Confirm with the product/API contract that all returned fields are intentionally public, that location inputs and returned distance are acceptable, and that ad approval/state transitions are authoritative.
- The function qualifies object references with `public.`; still validate schema/object creation privileges and temporary-object resolution in the isolated test environment before treating the search path as fully cleared.
- Do not revoke anonymous access until the product owner confirms an alternative public-ad delivery contract.

Advisor: [Supabase lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

## Reviewed authorization contracts (definition-level)

The following high-impact functions were inspected directly and showed explicit identity and/or platform-admin checks in the current production definitions:
- `admin_create_global_ad`: `mnty_can_platform_admin()` plus required title/creative checks.
- `review_mantigo_captain_application`: supplied actor must equal `auth.uid()`, then platform-admin check and decision/input validation.
- `set_mantigo_financial_config_backend`: actor must equal `auth.uid()`, platform-admin check, commission range validation, and audit insert.
- `fulfill_digital_page_publish`: actor equality, platform-admin check, paid-order gate, owner/type/business-scope checks, and idempotent publish handling.
- `confirm_mantigo_cash_payment_backend`: actor equality, ledger/customer ownership, payment-state validation, commission calculation, and audit insert.
- `get_mantigo_captain_earnings_backend`: actor equality and captain-profile existence before aggregation.
- `finalize_digital_page_payment_intent_backend`: actor equality and order/user/token predicates in the update.

These checks reduce specific authorization concerns but do not constitute complete end-to-end authorization, race, tenant-isolation, or business-logic certification.


### Authorization helper chain verified

- `public.mnty_active_membership` filters `public.user_memberships` by `m.user_id = auth.uid()`, active status, and optional tenant/business/branch constraints.
- `public.mnty_can` derives permissions from that helper rather than reading an actor ID supplied by the caller.
- `public.mnty_can_platform_admin` delegates to `mnty_can('admin', null, null, null)`.
- `preview_commission_backend` calls `assert_financial_membership`, which rejects unauthenticated sessions, requires active membership in the requested tenant, and requires an allowed finance/admin/owner role.

This delegation explains why these functions do not contain a direct `auth.uid()` call themselves. It is not a finding by itself. Remaining verification: exercise helper-chain behavior using role/JWT fixtures in an isolated database and confirm permission JSON casts fail safely for malformed values.

## Classification summary

- **Confirmed exploitable risks in S03 scope:** 0 confirmed from the evidence collected so far. This is not a claim that all 45 functions are vulnerability-free.
- **Intentional behavior needing documented contract:** public anonymous execution of `get_mnty_targeted_advertisements`.
- **Requires further verification:** remaining in-scope function bodies and callers, private-schema exposure/API grants, tenant-scoping contracts, and search-path safety under actual role/schema privileges.
- **Out of scope:** four S02-owned functions listed above.


## High-priority candidates requiring product-contract confirmation

### Candidate B — broad row serialization in customer ride listing

Function: `public.list_mantigo_customer_rides_backend`

The production definition returns `to_jsonb(r)`, `to_jsonb(b)` for every bid on the caller's own ride, and `to_jsonb(f)` for its financial ledger row. Catalog inspection confirms bid columns include `captain_phone` and `vehicle_plate`; ledger columns include `payment_reference`, `settlement_reference`, `idempotency_key`, `metadata`, `provider_intent_id`, and `provider_transaction_id`. The caller is restricted to their own ride, which is a meaningful authorization boundary, but the all-column serialization can expose more than the UI needs, including personal details of non-selected bidders and internal payment/settlement metadata.

**Classification: Requires verification (high priority), not yet counted as a confirmed exploit.** Confirm the intended customer-visible bid/ledger fields and whether phone/plate/provider references may be shown for every bid. Recommended safe design is an explicit field allowlist and a deliberate rule for when captain contact/vehicle details become visible. A read-only contract test now flags the broad `to_jsonb(b)`/`to_jsonb(f)` pattern; it has not been executed.

### Candidate C — open rides listing does not check captain verification

Function: `public.list_open_mantigo_rides_backend`

The function verifies `p_user_id = auth.uid()` and returns open rides with customer name, pickup/destination locations, note, and proposed price. The definition inspected does not check for an active/verified captain profile. This may be an intentional marketplace discovery policy, but if only approved captains should see ride details, it is an authorization/privacy gap.

**Classification: Requires product-contract verification.** Do not implement a role restriction without confirming the expected discoverability rules. Test both a normal authenticated customer and an active verified captain in isolated fixtures once the contract is settled.

### Candidate D — caller-supplied captain contact/name on bids

Function: `public.create_mantigo_bid_backend`

The caller identity is checked against `auth.uid()`, and profile status, verification, availability, and vehicle category are checked. However, the inserted bid takes `captain_name` and `captain_phone` from caller-supplied parameters, while vehicle/rating details are sourced from the captain profile.

**Classification: Requires verification.** If the profile is the authoritative identity/contact source, caller-supplied name/phone permit bid-level spoofing and should be replaced with profile-derived fields. If captains are explicitly allowed to publish a separate contact identity, document and validate that policy.

### Other definition-level checks completed

- `create_payment_intent_backend` verifies the signed-in actor, order/tenant match, order ownership or active tenant membership, order payment state, pricing snapshot, amount/currency equality, provider/method presence, and idempotency consistency.
- `preview_commission_backend` delegates authorization to `assert_financial_membership`, which checks `auth.uid()`, active tenant membership, and a finance/admin/owner role.
- `match_mantigo_ride_backend` verifies actor and ride ownership, bounds `p_limit`, and filters candidates to active, verified, available captains in the matching vehicle category.
- `create_indrive_bid_backend` and `create_indrive_request_backend` bind owner/provider identity to `auth.uid()`, reject anonymous JWTs, and validate key state/input conditions.
- `update_mantigo_trip_status_backend` binds the actor to the customer or accepted captain and validates status transitions, including payment state before trip start/completion.
- `update_medical_appointment_status_backend` binds actor identity, requires active tenant/business membership, validates statuses, and restricts non-cancellation transitions to provider/manager roles.

These are code-level observations, not runtime tests.

## Non-destructive tests

Added `supabase/tests/security/s03_security_definer_contract.sql`. It uses catalog reads and definition assertions only; it does not invoke business RPCs or mutate business data. It covers:
1. the intentional public-advertisement contract and approved/active/date/limit filters;
2. actor/admin guards on selected privileged operations;
3. explicit `search_path` on callable SECURITY DEFINER functions in scope, excluding the four S02-owned functions;
4. identity/tenant/status scoping in `mnty_active_membership` and delegation from `mnty_can`.

**Execution status: NOT RUN.** No isolated PostgreSQL runner was available/executed in this audit turn. The data-minimization assertion is expected to flag the current `to_jsonb(b)`/`to_jsonb(f)` pattern if run against the current definition; that is a predicted result from source inspection, not an observed test failure. Helper-chain assertions were added after direct inspection of the helper definitions. A test file existing is not a passing test. Production was not used to run behavioral tests.

## Required next steps

1. Run the SQL contract test against an isolated disposable PostgreSQL database with the relevant schema/functions installed.
2. Finish reading every in-scope function definition and its call sites, including input validation, dynamic SQL, writes, row locking, idempotency, and tenant/business boundaries.
3. Read the public schema CREATE privileges and temporary-schema resolution behavior in isolation; do not change production grants.
4. Document the expected public fields and consumers of the advertisement RPC; test null/invalid location values, extreme coordinates, and limit boundaries using a disposable fixture.
5. Add adversarial non-destructive tests for mismatched actor IDs, cross-tenant/business IDs, role escalation, malformed inputs, and concurrency where relevant.
6. Record test command, environment, commit SHA, pass/fail output, and regression results.
7. Keep PR #218 unmerged and release status **BLOCKED / NOT CERTIFIED** until all required gates are independently verified.

## Evidence caveats

- This is a snapshot of live catalog/Advisor evidence at audit time.
- All **45 function definitions** in the in-scope inventory were retrieved and inspected at definition level. Caller/call-site review, tenant-contract validation, and behavioral/adversarial runtime coverage remain incomplete; source review is not equivalent to runtime certification.
- Test pass/fail counts: **0 passed, 0 failed, 1 test file added but not run**. One assertion is expected to flag the current broad-row serialization pattern; no execution result is claimed.

## Follow-up evidence reconciliation — 2026-10-13

### Open-ride privacy contract cross-check

A repository search found the source-only migration `supabase/migrations/20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql` and its disposable integration test `supabase/tests/rc446_mantigo_open_ride_integration.sql`. The migration comment explicitly describes the intended boundary as active + verified + available captain access and sets `search_path = pg_catalog`; its integration test expects ordinary authenticated users and pending/unverified/offline/busy captains to be denied. These files are repository evidence, not proof of production deployment or product-owner approval.

The live production definition inspected for `public.list_open_mantigo_rides_backend(uuid)` does not contain that captain-profile guard. Therefore the source-vs-production mismatch is **confirmed**; the privacy/authorization impact remains dependent on the approved product contract and actual client call path. The RC446 migration is source-only and was not applied by this audit. Do not merge it or apply it to production as part of S03.

### Schema and temporary-object privilege snapshot

Additional read-only production catalog checks returned:
- `anon` TEMP privilege on the database: true.
- `authenticated` TEMP privilege on the database: true.
- `anon` and `authenticated` CREATE on schema `public`: false.
- `anon` USAGE on schema `private`: false; `authenticated` USAGE: true.

This makes isolated shadow-object tests important for SECURITY DEFINER functions. The inventory contains explicit `search_path` settings, including deliberately empty paths on several `private` helpers. An explicit setting is not by itself proof of safe name resolution: the effective path, relation qualification, function resolution, and schema/API exposure must be evaluated together. No shadow-object test was run against production, and no privileges were changed. A text-level scan is not a substitute for PostgreSQL parser/runtime verification.

### Existing source evidence for customer ride serialization

The live definition and the repository migration `20261006180000_mantigo_customer_tracking_and_finance_indexes_v1.sql` both serialize full bid and financial rows using `to_jsonb(b)` and `to_jsonb(f)`. The source confirms this is not just a stale test expectation. Whether each field is intentionally visible to the ride owner still requires a field-by-field contract review; fields of concern include non-selected bidders' contact/vehicle details and internal payment/settlement/provider/idempotency metadata.

### Updated status

- Confirmed source/production mismatch: 1 (open-ride captain gate absent from live function while the source-only RC446 contract expects it).
- Confirmed exploitable vulnerabilities: **0**; the source/production mismatch is a verified contract divergence, not yet a proven unauthorized disclosure without the call-path/product-contract confirmation.
- High-priority privacy candidates requiring contract confirmation: customer ride full-row serialization and open-ride visibility; caller-supplied captain name/phone on bids.
- Test execution remains **NOT RUN**: 0 passed, 0 failed. No result was inferred from source inspection.
- Production remains read-only throughout this follow-up. No RPC execution, DML, DDL, GRANT/REVOKE, migration, merge, or deploy was performed.

### Candidate E — caller-selected user ID in private legal admin predicate

The live catalog confirms two authenticated-executable overloads of `private.legal_is_admin`. The zero-argument overload checks the current `auth.uid()`; the UUID overload checks `coalesce(p_user_id, auth.uid())`, so a caller can supply another user's UUID and receive a boolean indicating whether that account has an active `SUPER_ADMIN`, `ADMIN`, or `LEGAL_ADMIN` membership. The function uses an explicitly empty search path and schema-qualified table/auth references.

**Classification: Requires verification, not a confirmed exploit.** `authenticated` has USAGE on schema `private` and EXECUTE on both overloads, while `anon` lacks private-schema USAGE. The PostgREST exposed-schema setting could not be read through the SQL session (`current_setting('pgrst.db_schemas', true)` returned NULL), so REST reachability is not established. If this helper is exposed to untrusted authenticated callers, the UUID overload is a role-enumeration oracle and should be restricted to self-checks or kept behind a non-exposed internal schema boundary. Before any change, inspect internal call sites and the actual API schema configuration; do not revoke privileges in production as part of this audit.


### Production migration-ledger reconciliation — 2026-10-13

A fresh read-only call to Supabase `list_migrations` returned a production ledger whose latest applied migration is `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). The repository contains later source migrations `20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql` and `20261010200000_rc451_targeted_ads_empty_search_path.sql`, but neither version appears in the production ledger returned by this call.

Consequences:
- RC446 is **not evidenced as applied to production**. This aligns with the live definition missing the active/verified/available captain guard.
- RC451 is **not evidenced as applied to production**. The previously inspected live ad RPC configuration remains `search_path=public, pg_temp`, while the source migration and its isolated integration test expect `search_path=''`.
- This is stronger than merely seeing a source migration: the ledger and live catalog indicate these two source-only protections remain pending. No migration was applied by S03.
- The branch inventory reports only a `main` Supabase development branch with `with_data=false`; no disposable branch is available for this test run. No costed branch was created.

### Candidate F — targeted-ad search path hardening is source-only

The existing RC451 source migration sets the intentionally public ad RPC to an empty search path and preserves anon/authenticated execution; its companion integration test checks the exact setting and ACL contract. The current production catalog snapshot previously recorded `search_path=public, pg_temp`, and the migration ledger does not contain RC451.

**Classification: Confirmed source/production hardening divergence; no exploit confirmed.** The body schema-qualifies application tables and uses static SQL, which lowers immediate shadowing risk, but the public schema in the execution path is unnecessary. Preserve the intentional public ad-serving behavior; do not revoke anon execution. Validate RC451 and its fixture in an isolated database before considering a separately approved release.

### Current consolidated classification

- In-scope callable SECURITY DEFINER overloads: **45** (1 anon-executable, also authenticated; 45 authenticated-executable; counts overlap).
- Confirmed source/production divergences: **2** relevant to this follow-up: RC446 captain authorization guard and RC451 empty-search-path hardening are present in repository source but absent from the returned production migration ledger; the corresponding live definition/configuration observations agree with that absence.
- Confirmed exploitable vulnerabilities: **0 established** from the collected evidence. This does not mean no vulnerabilities exist.
- Contract/security candidates requiring review: customer ride full-row serialization; caller-supplied captain name/phone; private `legal_is_admin(uuid)` role-enumeration reachability; public advertisement field contract; and the two source/production hardening divergences above.
- SQL test execution: **NOT RUN**; 0 passed, 0 failed. The current contract test intentionally contains an assertion expected to flag broad bid/ledger row serialization. RC446/RC451 integration tests are disposable-database tests and were not run against production.
- Production actions: read-only inventory/ledger checks only. No RPC business calls, DML, DDL, grants, revokes, migrations, branch creation, merge, or deployment.
- Release state remains **BLOCKED / NOT CERTIFIED** until isolated runtime tests and the product-contract decisions are evidenced.


### Diagnostic test addition — read-only, not executed

Added `supabase/tests/security/s03_security_definer_diagnostics.sql` on this isolated Git branch. It emits catalog-only statuses for the targeted-ad search path, open-ride captain guard, customer bid/ledger full-row serialization, caller-supplied captain contact fields, and the private legal admin UUID overload. It performs no DML/DDL, calls no business RPCs, and changes no grants. The output is designed to classify candidates for review rather than automatically label every deviation as an exploit.

Current repository-only verification:
- S03 report and both SQL files are present on `security/s03-audit-isolated-20261013`.
- No SQL runner was available in the session; syntax/runtime execution and result output remain **NOT VERIFIED**.
- Test counts remain **0 passed / 0 failed / 2 files not run**. Do not interpret unexecuted assertions or diagnostic statuses as test results.


### Fresh targeted production catalog recheck — 2026-10-13

A subsequent SELECT-only query rechecked the current live definitions/configuration for the five candidate functions and the private legal helper overloads. The observed values were:

| Function | Live observation | Classification |
|---|---|---|
| `public.get_mnty_targeted_advertisements(...)` | `search_path=public, pg_temp`; anon and authenticated EXECUTE true | Intentional public endpoint; RC451 hardening not evidenced in live catalog |
| `public.list_open_mantigo_rides_backend(uuid)` | authenticated EXECUTE true; active/verified/available captain guard absent | Confirmed source/production divergence; authorization impact follows product contract and call path |
| `public.list_mantigo_customer_rides_backend(uuid,text)` | authenticated EXECUTE true; `to_jsonb(b)` / `to_jsonb(f)` pattern present | Data-minimization candidate; caller is limited to own rides, so field-level exposure needs contract review |
| `public.create_mantigo_bid_backend(...)` | authenticated EXECUTE true; caller-supplied captain name/phone persistence pattern present | Identity/contact integrity candidate; no exploit confirmed until profile-authority contract is established |
| `private.legal_is_admin()` and `private.legal_is_admin(uuid)` | both have empty search path; anon EXECUTE false; authenticated EXECUTE true | UUID overload reachability remains unresolved because private schema API exposure/call path was not established |

This recheck was catalog-only and did not invoke any application RPC. It supports the report classifications above; it is not behavioral proof. The open-ride and ad search-path findings agree with the production migration-ledger gap already documented.


### Name-resolution heuristic scan — 2026-10-13

A SELECT-only static scan cross-checked function-body relation-reference tokens against actual public relation names for in-scope functions whose configured path is exactly `search_path=public`. It returned **0 matching unqualified references to existing public relations**. A separate lexical scan found no `EXECUTE` token in the retrieved function definitions.

Interpretation: this reduces the specific risk of temporary-table shadowing for the patterns tested, because no unqualified reference matching a live public table/view was found in this heuristic scan. It is **not** a PostgreSQL parser-level guarantee and does not replace review of every expression, type/function resolution, SQL constructed in strings, or actual API exposure. Several functions already use `search_path=public, pg_temp`, which explicitly places the temp schema last; the public ad RPC remains the known source-only RC451 hardening gap, although its application table references are schema-qualified.


### Cross-function authorization heuristic sweep — 2026-10-13

A further SELECT-only catalog sweep covered all 45 in-scope callable SECURITY DEFINER function definitions. It recorded whether each definition mentions `auth.uid()`, contains a common identity-comparison pattern, checks anonymous JWT state, uses tenant/business/branch scope predicates, locks rows, or contains mutation statements. This is a triage matrix, not a vulnerability detector: helper functions such as `mnty_can` correctly delegate authorization, while read-only/public functions may not need actor identity.

Specific review conclusions:
- The financial/payment path has explicit user/tenant/order checks, pricing snapshot checks, amount/currency checks, idempotency checks, and row locking in `create_payment_intent_backend`.
- `create_job_backend` binds the supplied user to `auth.uid()` and requires an active tenant/business membership in an allowed role before insert.
- `submit_job_application_backend` binds applicant identity to `auth.uid()`, validates required fields, verifies the job exists, and prevents duplicate applications per job/user.
- Private InDrive helpers have explicit empty search paths and were not found to be anon-executable in the catalog inventory. Their full authorization semantics still require caller-chain and adversarial runtime review.
- `private.legal_is_admin(uuid)` is executable by authenticated according to PostgreSQL privilege checks, but `private` schema API exposure could not be confirmed from database settings (the inspected `pgrst.db_schemas` setting was null). Its direct API reachability is therefore **unresolved**, not a confirmed vulnerability. Its use in legal write RPCs passes a target actor UUID; callers must be reviewed to ensure an untrusted actor cannot use that predicate to authorize themselves.
- The scan does not establish that all user-provided fields are safe or that all state transitions are complete. No business RPCs were invoked.

### Environment decision required for behavioral tests

Supabase organization discovery returned one organization, `manteqti` (ID `uahatcrnwfexfdmkrdkr`). I have not requested a cost quote or created a branch because the Supabase connector requires asking the user to select the organization before quoting branch cost, and explicit cost confirmation before branch creation. Until that confirmation, runtime tests remain unexecuted.


### Legal authorization call-chain and EXECUTE privilege recheck — 2026-10-13

A targeted, read-only catalog query checked the legal-related SECURITY DEFINER functions, their EXECUTE privileges for `anon`, `authenticated`, and `service_role`, and references to the private admin predicate.

Observed:
- `private.legal_is_admin()` and `private.legal_is_admin(uuid)`: `anon=false`, `authenticated=true`, both configured with an empty `search_path`.
- `public.legal_assert_action(...)`, `public.legal_publish_version(...)`, `public.legal_suspend_document(...)`, `public.legal_update_document(...)`, and `public.legal_update_draft_version(...)`: catalog reports EXECUTE only for `service_role`, not for `anon` or `authenticated`.
- `public.record_legal_consent(...)` and `public.record_legal_consent_backend(...)`: catalog reports no EXECUTE for `anon` or `authenticated`; the backend overload reports EXECUTE for `service_role`.
- The checked PostgREST schema setting `pgrst.db_schemas` is unset/null. This does **not** establish which schemas are exposed by the active API gateway, so direct RPC reachability of `private.legal_is_admin(uuid)` remains unresolved.
- Several service-role-only legal write functions call `private.legal_is_admin` with a target actor UUID. Their current EXECUTE ACLs reduce direct end-user reachability through ordinary role grants, but service-role call paths and the active API exposure configuration still need verification before certification.

Classification: no confirmed legal authorization exploit from this catalog-only check. Keep the private helper as an unresolved reachability/call-chain item; do not label it vulnerable solely because authenticated has PostgreSQL EXECUTE on the function. No application RPC was invoked, and no production data/schema/privileges were changed.

### Updated status after legal recheck

This was a read-only production catalog inspection. Behavioral tests remain **NOT RUN** (0 passed, 0 failed), no disposable Supabase test branch is available, and no release/security certification is granted. Existing restrictions remain: no production grants/revokes, migrations, data mutations, merge, deployment, or edits to S02-owned files.


### Private schema USAGE grant recheck — 2026-10-13

A follow-up read-only privilege query found:
- `private` schema USAGE: `authenticated=true`, `anon=false`, `service_role=true`.
- The active SQL session returns null for `pgrst.db_schemas` and `pgrst.db_extra_search_path`.
- A read-only check of role-level database settings found no stored `pgrst.db_schemas` or `pgrst.db_extra_search_path` setting.

This narrows but does not close the question: authenticated has schema USAGE and EXECUTE on the UUID-taking private admin predicate, but the database-side checks available here do not establish whether PostgREST exposes `private` as an RPC schema. Therefore direct endpoint reachability remains **unverified**. Treat this as a high-priority configuration verification item, not a confirmed exploit; do not infer exposure or safety from a null session setting.
