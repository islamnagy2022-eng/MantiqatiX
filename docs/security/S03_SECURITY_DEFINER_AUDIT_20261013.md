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


### Follow-up triage of callable functions without direct `auth.uid()` — 2026-10-13

A SELECT-only triage query identified two in-scope callable SECURITY DEFINER functions whose own definitions do not directly mention `auth.uid()` and did not match the small set of known membership helper names:

1. `public.get_mnty_targeted_advertisements(...)`: anon and authenticated EXECUTE are true. This is the previously documented public ad-serving endpoint. Its definition filters to active/approved ads, enforces start/end windows, and clamps the result limit to 1–50. The intended public nature and returned creative/target URL fields still require product-contract confirmation; no exploit was established.
2. `public.preview_commission_backend(...)`: anon EXECUTE is false and authenticated EXECUTE is true. Manual definition inspection confirms it first calls `public.assert_financial_membership(p_tenant_id)`, then validates non-negative gross amount, resolves an active scoped commission rule, validates percentage bounds, and computes commission/net values. Thus absence of a direct `auth.uid()` token is explained by delegated authorization rather than, by itself, indicating missing authorization.

The heuristic returned no other in-scope callable functions lacking both a direct identity reference and the known authorization-helper patterns. This is not proof of complete authorization correctness: alternate helper names, indirect call chains, dynamic behavior, and business-contract requirements can evade lexical checks. No RPC was invoked and no production state was changed.


### Additional private SECURITY DEFINER helper and privilege review — 2026-10-13

A read-only catalog query checked non-public SECURITY DEFINER functions with role EXECUTE privileges and their function owners/configuration. A separate focused definition review covered private InDrive helpers and push-subscription helpers.

**Positive controls observed**
- The scoped callable SECURITY DEFINER inventory query found no in-scope function with a missing explicit `search_path` setting (zero rows).
- `private.accept_indrive_bid_impl(uuid,uuid)` and `private.reject_indrive_bid_impl(uuid,uuid)` require an authenticated actor, lock the request and bid rows, bind the request to its owner unless the actor passes the platform-admin check, and verify the bid belongs to the specified request and is in OFFERED state before changing it.
- `private.can_read_indrive_bid`, `private.can_read_indrive_request`, and `private.can_submit_indrive_bid` are predicate helpers whose definitions bind access decisions to `auth.uid()`, request ownership, bid participation/state, or the platform-admin predicate.
- `private.upsert_mnty_push_subscription` and `private.disable_mnty_push_subscription` reject missing authentication. Disable is scoped to both endpoint and `auth.uid()`; upsert derives `user_id` from `auth.uid()` and validates endpoint/key lengths.

**Items requiring contract/reachability verification**
- Several private InDrive helpers have PostgreSQL EXECUTE granted to `authenticated` and the `private` schema has USAGE for `authenticated`. This does not prove that PostgREST exposes the schema, but it means these helpers should not be treated as unreachable without checking active API schema configuration. Their current definitions include authorization predicates; direct exposure may still reveal relationship/state information through boolean results and should be intentional.
- Push-subscription upsert uses `ON CONFLICT (endpoint) DO UPDATE` and reassigns the matching row to the current actor. This avoids trusting a supplied user ID, but the endpoint is the conflict key. Review whether possession/knowledge of another subscription endpoint is intended to authorize reassignment; no exploit is confirmed because endpoint secrecy and exposure paths were not tested.
- Function owners observed for these reviewed private helpers are `postgres`; their definitions use explicit empty search paths (or an explicit `public` path for push subscription operations).

This was catalog/definition inspection only. No helper RPC was invoked, no push endpoint or user data was read from application rows, and no production state or privileges were changed. The API schema exposure question and push endpoint ownership contract remain open.

### Updated S03 checklist

- [x] Read-only inventory confirms explicit function-level `search_path` for callable SECURITY DEFINER functions in the defined scope.
- [x] Review selected InDrive and push-subscription helper definitions and record delegated identity/state checks.
- [ ] Verify active PostgREST exposed-schema configuration for `private`.
- [ ] Confirm whether push endpoint reassignment on conflict is acceptable under the subscription ownership contract.
- [ ] Run the contract SQL tests in a disposable branch/database and record actual pass/fail output.
- [ ] Obtain product decision for customer-visible bid and financial-ledger field allowlists.
- [ ] Reconcile source migrations with live production catalog and migration history before certification.

**Status remains BLOCKED / NOT CERTIFIED.** The above checks are static catalog/definition review only, not runtime behavioral tests.


### Final scoped callable inventory recheck — 2026-10-13

A fresh SELECT-only aggregate over the same S03 scope (excluding the four S02-owned functions) returned:

| Metric | Live catalog result |
|---|---:|
| Callable SECURITY DEFINER functions in scope | 45 |
| Anon-executable functions (overlap allowed) | 1 |
| Authenticated-executable functions (overlap allowed) | 45 |
| Functions with explicit function-level `search_path` | 45 |
| Functions missing explicit function-level `search_path` | 0 |

The role counts overlap: the single anon-executable function is also authenticated-executable. This inventory confirms the scoped search-path property only; it does not prove correct authorization, least-privilege output fields, safe state transitions, or API schema reachability. The GitHub combined commit-status query for the latest audit commit returned no status entries; this is **not** evidence of CI passing.

No production mutation, migration, privilege change, application RPC invocation, merge, or deployment occurred. Behavioral tests remain unexecuted pending an isolated test environment.


## Follow-up read-only verification (2026-10-13, continued)

### Migration-ledger cross-check

A fresh Supabase migration-ledger read confirms that the latest applied migration reported by the connector is `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). The following source migrations previously identified as relevant are still absent from the returned production ledger:

- `20261010060000_rc446_mantigo_open_ride_privacy_boundary`
- `20261010200000_rc451_targeted_ads_empty_search_path`

This is a **source/production migration drift signal**, not by itself proof that either source migration is safe or required for production. Before any deployment decision, inspect their complete SQL, dependencies, and release ordering, then validate in an isolated database. No migration was applied.

### Private-schema callable helper grants

A fresh catalog query confirms these private SECURITY DEFINER helpers are executable by `authenticated`, while `anon` has neither `private` schema USAGE nor function EXECUTE:

- `private.can_read_indrive_bid`
- `private.can_read_indrive_request`
- `private.can_submit_indrive_bid`
- `private.legal_is_admin` (two overloads)
- `private.upsert_mnty_push_subscription`
- `private.disable_mnty_push_subscription`

The inspected helpers have explicit function settings: the InDrive predicate helpers and legal helper use an empty `search_path`; push subscription helpers use `search_path=public`. These grants are PostgreSQL privilege facts only. They do **not** establish that PostgREST exposes the `private` schema, nor that direct invocation is possible through the HTTP API. API schema configuration and call paths remain unverified. The push upsert's endpoint-conflict reassignment remains a contract question, not a confirmed vulnerability.

### Updated disposition

- Production reads only: migration ledger and function/schema privilege catalog.
- Production mutations, business RPC execution, grants/revokes, migrations, deployments, merges: **none**.
- Test execution: **not run**; SQL scripts remain unverified at runtime.
- Confirmed exploitable findings: **0 based on evidence collected**, which must not be interpreted as proof of no vulnerabilities.
- Release decision: **BLOCKED — NOT CERTIFIED** pending isolated runtime tests, field-level data contract review, schema/API exposure confirmation, and reconciliation of source migrations with production.


### Source-tree existence cross-check — qualification

A follow-up GitHub contents lookup for the exact RC446 and RC451 migration paths returned HTTP 404 on `main`, even though code-search results show those filenames referenced by migration-chain/security validation scripts and workflows. Therefore, the evidence currently supports **an unresolved source-tree inconsistency** (references exist; exact migration file retrieval did not), not a claim that the migration files themselves are present and ready to apply. Before any release, verify the actual tree at the intended release commit, repair missing/mismatched files in a separate reviewable change, and ensure the production migration ledger matches the validated chain. Do not apply either migration based only on filename references.


## Fresh Supabase Security Advisor snapshot — 2026-10-13

A fresh read-only Security Advisor query returned these items relevant to release readiness:

1. `anon_security_definer_function_executable`: 1 finding — the public targeted-ad RPC, already described above. The product contract must explicitly confirm anonymous delivery is intended.
2. `authenticated_security_definer_function_executable`: 40 findings — callable public SECURITY DEFINER functions. This is an exposure inventory, not a verdict that every function is vulnerable; each function must have a reviewed caller contract and authorization checks.
3. `auth_leaked_password_protection`: **WARN — disabled**. Enable compromised-password protection through the approved Auth settings/release process, after evaluating user impact. No Auth settings were changed during this audit.
4. `rls_enabled_no_policy`: **INFO — one table**, `public.digital_page_payment_events`, has RLS enabled with no policies. This may be deliberate deny-by-default; verify intended client access and retain the boundary unless a justified narrow policy is tested.
5. Anonymous-role RLS policy warnings were returned for multiple tables, including financial, payment, ride, SMM, tenant, storage, and marketplace tables. These are advisor-level leads and must be reviewed against each policy expression and actual role semantics; they do not alone establish that unauthenticated users can read or mutate the underlying rows. In particular, do not blanket-remove policies without checking app behavior and negative tests.

Remediation references:
- [SECURITY DEFINER callable by anon (lint 0028)](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [SECURITY DEFINER callable by authenticated (lint 0029)](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

**Safety:** this was an advisor read only. No production settings, policies, grants, migrations, schema, or data were modified.


### Anonymous-policy warning reconciliation — catalog read

To avoid treating the Security Advisor output as confirmed access, I queried `pg_policies` directly for policies whose role list contains `anon` or `public` in `public` and `storage`. The query returned **20 policies: 14 SELECT policies and 6 restrictive ALL policies with both `USING (false)` and `WITH CHECK (false)`**.

The SELECT policies inspected include several explicitly public contracts (published digital pages, active marketing catalog, active Egypt geographic areas, official showcase businesses, published legal documents, and public profile-media bucket objects). The six restrictive policies are deny boundaries on ERP purchase orders/receipts/stock transfers, legacy idempotency, SMM admin records, and SMM provider credentials.

This does not reconcile every one of the 90 advisor `auth_allow_anonymous_sign_ins` findings: the advisor and direct catalog query may classify anonymous sessions/role inheritance differently, and the query only reports explicit `anon`/`public` role entries. Treat the difference as a verification task. Next step is to inspect the full policy set and table grants for each advisor-flagged table, then verify effective access with negative tests in an isolated database. No policy or grant was changed.


## Sensitive-table and column-privilege reconciliation — 2026-10-13

Read-only catalog inspection was extended to effective table/column privileges, RLS flags, and policy expressions for financial, MantiGo, marketing-provider, and SMM tables. These are catalog observations, not live API exploit tests.

### Finding S03-R1 — public marketing-provider profile exposes non-public-looking columns (HIGH REVIEW / contract not confirmed)

- `public.marketing_provider_profiles` has RLS enabled and FORCE RLS enabled. Its public SELECT policy is `Public can view active marketing providers` for roles `anon, authenticated` with predicate `status = 'ACTIVE'`.
- Catalog privilege checks returned `anon_select = true` for every column in the table, not only display fields. The accessible column set includes `owner_user_id`, `business_id`, `ranking_weight`, `settings`, `created_at`, and `updated_at`, alongside public-facing name, description, specialties, service areas, portfolio, status, and image path.
- This confirms broad anonymous column access for rows passing the active-status policy. It does not prove that `settings` currently contains secrets or that the owner ID is confidential; no row values were queried. However, the privilege boundary is broader than a minimal public-directory projection.
- Recommendation: inspect the intended public provider-card contract and the `settings` JSON schema; preferably expose a narrow public view/RPC with only approved display fields and grant anonymous SELECT only on those fields or the curated surface. Preserve active-only row filtering. Do not apply a change until caller inventory and public directory regression tests are prepared.

### Finding S03-R2 — MantiGo bids expose phone and plate fields to all customers owning the ride (HIGH REVIEW / product contract not confirmed)

- `public.mantigo_bids` has RLS and FORCE RLS enabled. Its SELECT policy permits the bid's captain (`captain_id = auth.uid()`), the customer owning the associated ride, or platform admin.
- The table includes `captain_phone` and `vehicle_plate`, in addition to captain name/rating, vehicle details, offer price, ETA, message, status, and timestamps.
- Therefore, an authenticated customer who owns a ride can read row-level bid records that include phone and plate for bids on that ride, not only the accepted bid, subject to the policy predicate. This is a confirmed catalog-level exposure path; whether it violates the product contract depends on whether contact/plate details are intentionally disclosed before bid acceptance.
- Recommendation: product owner must decide disclosure timing. If only the accepted captain should be contactable/identifiable, split public offer fields from private contact/vehicle identifiers or expose a narrow customer-facing view/RPC that reveals those fields only after acceptance. Add negative tests for another customer's ride and pre-acceptance bids. No live row values were read.

### Positive control — SMM direct table access is not granted to client roles

- Catalog checks showed `anon` and `authenticated` lack direct SELECT privileges on `smm_orders`, `smm_order_events`, `smm_wallets`, `smm_wallet_transactions`, `smm_admins`, `smm_providers`, and `smm_provider_credentials`, including the `api_key_ciphertext` column.
- Existing RLS policies include owner-read rules on orders/wallet data, public read of active `smm_services`, and explicit false-deny policies for admin/credential tables. Since direct SELECT grants are absent, those RLS rules do not independently create a direct-table SELECT path for client roles. This is a positive control for direct table access, not proof that all SMM gateway/RPC/Edge Function paths are safe; the SMM gateway remains in scope for separate authorization and secret-handling tests.

### Financial catalog posture — partial positive control, not runtime certification

- Catalog checks showed RLS plus FORCE RLS on `general_ledger`, `wallet_accounts`, `wallet_transactions`, `payment_intents`, `payment_events`, `settlement_transactions`, and `subscription_payment_intents`.
- Their observed SELECT policies are scoped to active tenant memberships and finance/admin/owner-type roles, or are owner-specific where applicable. `payment_events.raw_payload` and provider/idempotency references exist in schema, so any future RPC response that serializes whole rows still needs field-level review.
- `mantigo_financial_ledger` has RLS enabled but not FORCE RLS, with a SELECT policy limited to the ride's customer or captain. Direct table SELECT privileges for `anon` and `authenticated` were false in the catalog snapshot, so that policy alone did not grant direct table SELECT. SECURITY DEFINER functions returning ledger rows still require the previously documented field-minimization review.

### Scope and release decision

- These checks queried schema metadata and privileges only; no customer, payment, bid, credential, or wallet row data was read.
- No policy, grant, schema, Auth setting, or production data was changed.
- Required before certification: resolve public-provider column contract, resolve MantiGo pre-acceptance phone/plate disclosure, run isolated role-based negative tests, inspect SMM gateway/RPC/Edge Function authorization, and execute the authored S03 SQL tests in an isolated database.
- Status remains **BLOCKED — NOT CERTIFIED**; no tests are represented as passed.


## Adjacent SMM gateway source review — main branch, not production parity

Reviewed `supabase/functions/smm-gateway/index.ts` from `main` (blob SHA `26101b48d9ab4135b1174e39907f87bfc593076b`) to follow the SMM direct-table boundary into its trusted server-side gateway. This is a source review only. The production `smm-gateway` was previously recorded as deployed version 6 and not matching the current source; therefore none of these observations establish deployed runtime behavior until the deployed source/version is captured and compared.

### SMM-GW-1 — provider call has no explicit timeout (availability / stuck-request risk)

The shared `call()` helper uses `fetch(p.api_url, ...)` without an `AbortSignal`/deadline. A slow or non-responsive provider can keep an Edge Function invocation open and increase concurrency/resource pressure. Add a bounded timeout and classify timeout separately from definitive provider rejection; validate configured provider URLs against an approved scheme/host policy as part of provider onboarding.

### SMM-GW-2 — automatic refund on ambiguous provider outcome (financial integrity risk)

`place_order` inserts an order and debits the wallet before calling the external provider. Its catch path attempts `smm_refund_wallet` for every thrown error, including network errors or malformed/ambiguous provider responses that may occur after the provider accepted the order. The refund result is not checked, and the order status update result is not checked either. A provider-side accepted order plus a local timeout/response parse failure can therefore create a provider/customer/accounting mismatch; a failed refund can leave an inconsistent wallet/order state without a surfaced reconciliation state.

Required hardening design: use a stable client idempotency key persisted before provider submission; persist provider submission intent and attempt IDs; distinguish definitive rejection from unknown outcome; on unknown outcome retain a `RECONCILIATION_REQUIRED`/equivalent state rather than automatically refunding; reconcile with provider status before refund; verify and record the refund RPC outcome and every critical persistence result. Implement only with isolated financial tests and a reviewed migration/API contract.

### SMM-GW-3 — provider status sync lacks terminal-state and persistence guards

`order_status` derives a new status from provider response and updates the order without an explicit terminal-state transition guard. It does not check the result of the order update or event insert, and returns success based on the derived status even if persistence failed. Add a centralized allowed-transition matrix, monotonic terminal-state rules, idempotent event persistence, and explicit handling when either write fails. Test repeated/out-of-order status responses and terminal states in disposable PostgreSQL.

### SMM-GW-4 — error/result and write handling require contract minimization

The gateway returns raw provider result in `order_status` and provider-derived error text in `place_order`. Review these payloads for provider internals, customer data, or sensitive metadata before exposing them to clients. Admin/provider reads and service sync also need validation of provider configuration and provider response fields; no provider call was executed during this review.

### SMM gateway status

These are actionable source-level risks, not proof of a live incident. Do not treat the `main` source as deployed truth: the deployed version 6/source mismatch must be reconciled first. Do not deploy or mutate production under this audit. Required evidence includes source/version parity, isolated tests for timeouts/ambiguous acceptance/refund failures/status races, and financial-ledger reconciliation. Release remains **BLOCKED — NOT CERTIFIED**.


## Follow-up verification — exact table privileges and migration ledger — 2026-10-13

A second read-only catalog query used PostgreSQL `has_table_privilege` directly for each of SELECT, INSERT, UPDATE, and DELETE on the sensitive table subset (payments, ledgers, wallets, rides/bids, orders, tenants, and SMM). This supersedes any inference from the earlier aggregated `table_privilege_grantees` list, which included non-SELECT privileges and therefore was not a valid way to infer SELECT access.

### Exact client-role privileges observed

- For every table in the queried subset, `anon` returned false for SELECT, INSERT, UPDATE, and DELETE.
- For SMM tables in that subset (`smm_orders`, `smm_order_events`, `smm_wallets`, `smm_wallet_transactions`, `smm_admins`, `smm_providers`, `smm_provider_credentials`, `smm_services`), `authenticated` also returned false for all four direct table privileges.
- `authenticated` has SELECT on several business tables in the subset, including `orders`, `payment_intents`, `payment_financial_reconciliations`, `payment_provider_events`, `wallet_accounts`, `wallet_transactions`, `general_ledger`, `mantigo_rides`, `mantigo_bids`, and `indrive_bids`. This is not by itself evidence of exposure: the relevant tables have RLS enabled, and most finance/ride tables in this subset also have FORCE RLS. The policy predicates and caller role context still need isolated role-based tests.
- `mantigo_financial_ledger` has no direct SELECT privilege for either client role in this snapshot; its customer/captain SELECT policy does not independently grant table access.
- The six deny-only tables previously noted (`erp_purchase_orders`, `erp_purchase_receipts`, `erp_stock_transfers`, `legacy_module_idempotency`, `smm_admins`, `smm_provider_credentials`) remain catalog-level deny-policy observations, not evidence of a working client read path.

### Advisor warning interpretation

The Security Advisor's anonymous-policy warnings should not be read as 90 confirmed anonymous data leaks. Exact direct table privileges were absent for `anon` across the sensitive table subset above. Advisor warnings and explicit `anon`/ `public` policy roles are distinct signals; complete reconciliation requires enumerating every warning's table, effective grants, RLS policies, view/function paths, and API exposure. This query only sampled the stated sensitive subset and does not resolve all 90 warnings.

### Migration ledger reconciliation

A fresh read of the live migration ledger confirms the latest applied migration is still `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). Source filenames referenced in the S03 investigation for RC446 and RC451 were not confirmed as applied migrations by this ledger; earlier direct fetches of those exact paths from `main` returned 404. Treat them as unresolved source-tree references, not as production changes or deployed hardening. Do not apply them based on filename references alone.

### Evidence limits and release gate

- Read-only catalog checks only; no business rows or secrets were read.
- No grants, policies, Auth settings, migrations, or production data were changed.
- No role-based tests or S03 SQL tests were executed; there are still zero tests claimed as passed.
- Release remains **BLOCKED — NOT CERTIFIED** until warning reconciliation, SMM deployed/source parity, product decisions on pre-acceptance bid identity disclosure, and isolated negative tests are complete.
