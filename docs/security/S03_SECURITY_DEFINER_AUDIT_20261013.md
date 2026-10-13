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
3. explicit `search_path` on callable SECURITY DEFINER functions in scope, excluding the four S02-owned functions.

**Execution status: NOT RUN.** No isolated PostgreSQL runner was available/executed in this audit turn. The data-minimization assertion is expected to flag the current `to_jsonb(b)`/`to_jsonb(f)` pattern if run against the current definition; that is a predicted result from source inspection, not an observed test failure. A test file existing is not a passing test. Production was not used to run behavioral tests.

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
