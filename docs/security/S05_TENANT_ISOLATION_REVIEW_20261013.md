# S05 — Tenant Isolation, RLS & Membership Security Review
Date: 2026-10-13  
Repository: islamnagy2022-eng/MantiqatiX  
Reference PR: #218 (open Draft; this report is on a separate S05 branch)  
Supabase project: moyhiluyhjsujhwlyeuu

## Executive status

**Overall: BLOCKED / NOT VERIFIED for runtime isolation.** This is a read-only evidence review plus a test plan. No production policy, grant, Auth, data, migration, or Edge Function was changed. No merge or deployment was performed.

| Check | Result | Evidence / limitation |
|---|---|---|
| Live schema inventory | PARTIAL PASS | Supabase inventory returned public.tenants and public.user_memberships with RLS and FORCE RLS enabled. |
| Runtime cross-tenant isolation | NOT VERIFIED | No isolated database with synthetic identities was available during this execution; static policy presence is not a runtime test. |
| Existing tenant test safety | FINDING | scripts/verify-tenant-isolation.sql selects an ACTIVE identity from live user_memberships and executes as authenticated. Do not run it against production for this task; it does not meet the synthetic-identity requirement. |
| Payment event ledger | CONFIRMED DESIGN BOUNDARY | Migration supabase/migrations/20261002192000_rc230_digital_page_payment_events.sql enables RLS and revokes all table privileges from anon and authenticated. Existing security records describe the no-policy state as intentional backend-only storage. |
| Production mutation | NOT PERFORMED | No RLS/grants/Auth/migration changes were applied. |

## Evidence collected

1. PR #218 is open, unmerged, and Draft. Its current head is not treated as runtime proof.
2. Read-only Supabase inventory showed public.tenants and public.user_memberships with rls_enabled=true and force_rls=true.
3. Repository file scripts/verify-tenant-isolation.sql performs read-only counts for businesses, orders, payment intents, and provider onboarding requests under an authenticated role, but selects an existing active user belonging to MNTY-PLATFORM and not MNTY-TEST-B. It is unsuitable for the required synthetic-account isolation run.
4. Migration 20261002192000_rc230_digital_page_payment_events.sql defines the event table with order FK, unique external_event_id, provider/event/status/signature fields, raw payload and timestamp; it enables RLS and revokes all privileges from anon and authenticated.
5. Existing repository notes docs/RC334_SECURITY_GATE_REVERIFICATION.md and docs/RC337_CURRENT_SECURITY_RELEASE_GATE.md state that the no-policy payment-event ledger is deliberate and that direct client access is not granted. The anonymous targeted-advertisement SECURITY DEFINER endpoint is documented as an intentionally narrow public read boundary. This does not certify its current live behavior; verify it separately with function-level runtime tests.


6. Live Supabase Security Advisor was rechecked at 2026-10-13T02:26:12.710Z: one RLS-enabled/no-policy finding for public.digital_page_payment_events, one anon-executable SECURITY DEFINER function (public.get_mnty_targeted_advertisements), and 40 authenticated-executable SECURITY DEFINER function findings. Advisor findings are not automatically confirmed vulnerabilities; each function needs caller/authorization-path review. This S05 review did not invoke or mutate any such function.

## Test identity design (synthetic only)

Create fixtures only in disposable PostgreSQL/Supabase local or isolated branch DB, never in production:
- Tenant A: S05_TENANT_A; organization S05_ORG_A; branches S05_BRANCH_A1 and S05_BRANCH_A2.
- Tenant B: S05_TENANT_B; organization S05_ORG_B; branch S05_BRANCH_B1.
- Synthetic auth users: S05_OWNER_A, S05_MANAGER_A, S05_MEMBER_A, S05_OWNER_B, S05_MEMBER_B, S05_EXPIRED_A, and an anonymous JWT identity. Generate disposable UUIDs; do not reuse real user IDs/emails.
- Membership fixtures: ACTIVE owner/manager/member roles for the appropriate tenant; EXPIRED membership for S05_EXPIRED_A; no membership in B for A users and vice versa.
- Seed one clearly tagged row per tenant in each supported test table. Keep fixture setup and teardown inside the isolated environment.

## Required runtime scenario matrix

Each case must run through the actual PostgREST/client role with a JWT for the synthetic identity, not as database owner or service role. Capture request, identity, SQLSTATE/HTTP result, returned row IDs, and cleanup.

| ID | Scenario | Expected result |
|---|---|---|
| S05-T01 | Tenant A member reads A rows | Only authorized A rows visible |
| S05-T02 | Tenant A member queries B rows by known ID | Zero rows / no disclosure |
| S05-T03 | Tenant A member inserts with tenant A | Allowed only if that role has insert permission |
| S05-T04 | Tenant A member inserts with tenant B | Rejected by WITH CHECK / authorization |
| S05-T05 | Tenant A member updates A row without changing tenant | Allowed only for role/table permission |
| S05-T06 | Tenant A member changes A row tenant_id to B | Rejected; original row remains in A |
| S05-T07 | Tenant A member deletes A row | Role-dependent; ordinary member must be denied if delete is privileged |
| S05-T08 | Tenant A member deletes B row by ID | No row affected / denied |
| S05-T09 | Expired/revoked membership reads tenant data | No tenant-scoped rows visible |
| S05-T10 | User switches active tenant context from A to B without B membership | Denied; client-supplied tenant context is not authority |
| S05-T11 | A owner/manager attempts B branch/org access | Denied despite elevated role in A |
| S05-T12 | B user reads B rows | Only B rows visible |
| S05-T13 | Anonymous JWT attempts private tenant/member data | Denied |
| S05-T14 | Anonymous caller invokes intentionally public targeted-ad endpoint | Only approved public ad metadata; no private location/user/tenant fields |
| S05-T15 | Authenticated client reads/inserts/updates/deletes payment event ledger | Denied |
| S05-T16 | Backend payment processor writes a verified event | Allowed only through intended trusted backend boundary; validate signature, order binding, amount/currency, replay/idempotency |
| S05-T17 | Duplicate external_event_id replay | Unique constraint / idempotency prevents duplicate processing |
| S05-T18 | Branch ID from A is paired with tenant/organization B | Rejected by relational integrity/business authorization |

Expected CRUD results must be finalized per table and role after reviewing each table's exact policies. Do not infer that every active tenant member can write or delete every row.

## Membership and role invariants

- Membership is valid only when user_id = auth.uid(), status = ACTIVE, and membership tenant matches the row's authoritative tenant.
- Role elevation in Tenant A must not grant permissions in Tenant B.
- Client-provided tenant_id, organization_id, branch_id, role strings, and active-tenant selectors are untrusted input; validate them against membership and row relationships.
- Test USING (existing-row visibility/update/delete) and WITH CHECK (insert/update destination) for every write policy.
- Membership expiry/revocation must affect the next database request; do not rely only on stale client-side session state.
- Check whether branch and organization membership is explicitly constrained rather than assuming tenant membership automatically provides correct branch scope.
- Review permissive-policy OR composition; a broad policy can defeat a restrictive tenant-specific policy.
- Distinguish table RLS from SQL grants and SECURITY DEFINER function execution privileges.

## digital_page_payment_events: decision and policy proposal

### Intended use
The migration and existing security records indicate a backend-only payment webhook/event ledger. It contains raw_payload, signature-verification status, provider event identifiers, event status, and a foreign key to a digital page order. These are payment-integrity/audit data, not general tenant-facing records.

### Authorized access proposal (not applied)
- anon: no table privileges; no policy.
- authenticated: no direct table privileges; no policy.
- service_role: backend-only access as required by the verified webhook/payment processor, preferably through a narrowly scoped server-side function. Do not expose raw payload or event writes to browser clients.
- Public users: no direct access. A user-facing order-status API, if required, should return minimal derived status after checking order ownership and must not reveal raw webhook payloads or provider event internals.

### Why no broad RLS policy
The observed migration explicitly revokes direct client privileges, and repository security records characterize the no-policy state as deliberate fail-closed design. Adding a tenant-wide SELECT or INSERT policy would widen access to sensitive payment payloads and weaken the backend trust boundary. Keep the no-policy finding documented as intentional only while direct grants remain absent and the backend write path is verified.

### Focused tests
- Authenticated/anon SELECT, INSERT, UPDATE, DELETE: denied by privileges/RLS.
- Browser cannot forge signature_verified=true or inject raw_payload.
- Backend rejects invalid signature, mismatched order/provider/event, amount/currency mismatch, and replay.
- Service-role access is tested only in a disposable environment; no service key is exposed to client code.
- Verify FK cascade behavior and event retention implications with payment/audit owners before any schema change.

## Anonymous access review

Do not classify every anonymous-related warning as a vulnerability automatically:
- Intended public read: targeted advertisement endpoint only if it returns approved, minimal, non-sensitive fields and its SECURITY DEFINER search path and execution grants are constrained.
- Deny anonymous direct reads/writes of tenant, membership, order, payment, wallet, finance, CRM, audit, branch, and organization-private data.
- Verify grants and policies together; RLS alone does not compensate for an unintended SECURITY DEFINER execution grant.
- Anonymous Auth sessions are different from PostgreSQL anon role. Tests must include both where the product supports anonymous sessions.
- Do not remove or widen policies by a blanket script; evaluate each public endpoint and table purpose independently.

## Blockers / next steps

1. Provision or identify a disposable DB/branch with no production data and synthetic Auth users. Do not run scripts/verify-tenant-isolation.sql against live production because it selects a real active identity.
2. Review full live policy/grant definitions for membership, tenant, organization, branch, order, business, payment-intent, and relevant digital-page tables in read-only mode.
3. Convert the matrix into executable pgTAP/PostgreSQL or PostgREST integration tests under a unique supabase/tests/s05_* path, using synthetic users and controlled JWT claims.
4. Run actual requests as each synthetic identity; preserve logs/results and verify fixture cleanup. Static checks alone do not close S05.
5. Record any shared policy/migration changes as a separate proposal for S02/S04 coordination. Do not apply them in this scope.
6. Re-run focused tests after integration and against the exact candidate commit before any release decision.

## Final S05 gate

- Schema/policy discovery: PARTIAL
- Static evidence review: PASS for documented payment-ledger boundary
- Runtime two-tenant isolation: NOT VERIFIED
- CRUD/tenant_id tampering/membership expiry/tenant switching: NOT VERIFIED
- Anonymous-access adversarial tests: NOT VERIFIED
- Production changes: NONE
- Release recommendation: BLOCKED / NOT CERTIFIED until synthetic-identity runtime evidence is attached


## Continuation update — 2026-10-13 (live catalog review)

A targeted read-only query further confirmed RLS and FORCE RLS on `public.tenants`, `public.user_memberships`, `public.branches`, `public.businesses`, `public.organizations`, and `public.tenant_modules`. `public.digital_page_orders` and `public.digital_page_payment_events` have RLS enabled but FORCE RLS is false; interpret this together with table ownership, effective grants, and trusted backend paths rather than treating the flag alone as a vulnerability.

Observed policy boundaries:
- `tenants_select_member`: active membership, `auth.uid()`, and matching tenant ID; `tenants_no_direct_update` denies direct updates.
- `memberships_select_self`: row user ID equals `auth.uid()`.
- `organizations_member_read` and `tenant_modules_member_read`: active tenant membership; write policies are limited to OWNER/ADMIN.
- `businesses_member_select`: active tenant membership; write policies are limited to OWNER/ADMIN/MANAGER. The public showcase policy is separately constrained to ACTIVE records and `settings.showcase=true`.
- `branches_member_read`: active membership and matching tenant; no explicit `branch_id` predicate was visible. Product must confirm whether all tenant members may read all branches or whether limited roles require branch-level isolation. This is an open design question, not a confirmed vulnerability. PostgreSQL permissive policies are OR-combined, subject to restrictive policies, so effective policy behavior must be assessed as a set.

Targeted SECURITY DEFINER review:
- `mnty_active_membership(character varying,uuid,character varying)`: `search_path=public, pg_temp`; authenticated EXECUTE allowed, anon denied; definition binds membership lookup to `auth.uid()` and ACTIVE status.
- `start_business_trial_backend(uuid,text,text,integer,text,uuid)`: empty search_path; service_role-only EXECUTE in the observed grant checks. It accepts `p_actor_user_id`, so the trusted caller must bind it to the authenticated actor rather than pass an untrusted client value. The server/Edge Function call path remains NOT VERIFIED.
- `get_or_create_business_referral_profile(uuid)`: service_role-only EXECUTE and function logic checks `auth.uid()` plus active membership/role. Verify user JWT propagation in the trusted call path if it is intended to act on behalf of a user.
- `track_business_referral_event(...)`: service_role-only EXECUTE observed; inspect the trusted caller for event-type and metadata validation/minimization.
- Payment webhook signature verification before the payment RPC remains NOT VERIFIED; the database RPC receives a boolean assertion and cannot itself infer that the provider signature was cryptographically validated.

### Added static regression contract

Added `supabase/tests/S05_tenant_isolation_policy_contract.sql` on branch `security/s05-tenant-isolation-review-20261013` (commit `594c2f2ddddfc696ab8b8268221a4aaa3aa30028`). This contract checks selected catalog invariants and effective direct table/function privilege boundaries. It is **static only**, has not been run in CI or production in this review, and does not substitute for two-tenant runtime tests.

### Updated gate

- Static policy/grant inventory: PARTIAL REVIEWED.
- Branch-level vs tenant-level visibility semantics: NEEDS PRODUCT CONFIRMATION.
- Trusted backend actor binding and webhook signature path: NOT VERIFIED.
- Synthetic multi-user runtime tests: NOT RUN.
- Production changes, merge, deployment: NONE.
- Release gate: **BLOCKED / NOT CERTIFIED**.


### Policy combination semantics — additional check

A fresh catalog query included `pg_policies.permissive`. The `authenticated_sessions_only`, `deny_anonymous_users`, `mnt_non_anonymous_boundary`, and `non_anonymous_authenticated_guard` policies observed on `tenants`, `branches`, `organizations`, and `tenant_modules` are **RESTRICTIVE**, not PERMISSIVE. Therefore, they do not independently grant access through permissive-policy OR semantics. This is important positive static evidence and avoids incorrectly treating the guard policies themselves as an access bypass.

The static contract was strengthened in commit `802d9ef969d9fedb5363ac92b80c1425de5278fc` to fail if these guard policies are changed away from RESTRICTIVE or are missing. This test is still unexecuted; no CI run is associated with the reviewed commits so far.

Repeated restrictive guard policies appear redundant and increase policy complexity, but no cleanup is proposed in this S05 scope. Effective behavior must still be confirmed with synthetic-user behavioral tests.
