# CRM / Marketing Lead Lifecycle — Implementation Contract

Status: SOURCE + ISOLATED POSTGRESQL INTEGRATION VERIFIED ON PR #373; TARGET RUNTIME NOT VERIFIED
Scope: define the safe contract for internal marketing teams to manage leads without weakening customer ownership or tenant isolation.
Release rule: this document is not approval to deploy, alter production grants, or run real-world acceptance tests. The comprehensive acceptance campaign remains deferred until module development and integration are complete.

## 1. Current source-backed boundary

The RC102 G8 baseline documents `marketing_leads` as:
- authenticated INSERT only when `requester_user_id = auth.uid()`;
- SELECT only for the requesting user.

This is an owner-scoped customer-lead boundary. It does not, by itself, authorize internal marketing staff to read or update every lead. Do not add a broad authenticated SELECT/UPDATE policy to make an internal CRM screen work.

The implementation now uses the RC457 server-authoritative transition RPC and does not add a broad UPDATE policy. The isolated PostgreSQL integration test passed on PR #373, covering allowed transitions, audit atomicity, idempotency, stale-state conflicts, actor spoofing, cross-business denial, authentication, and execute grants. This does not prove behavior against the target Supabase project or complete browser E2E acceptance.

## 2. Required product behavior

The CRM must support a lead lifecycle with explicit, auditable transitions:
1. New
2. Contact attempted
3. Contacted
4. Qualified
5. Offer / proposal
6. Converted
7. Not qualified
8. Follow-up scheduled
9. Retained / repeat opportunity
10. Closed

The implementation must preserve the original requester and source metadata. A lifecycle transition must not permit changing requester, tenant, business ownership, or other identity/scope fields as a side effect.

Do not silently map unknown legacy status values to a valid state. Return a safe, actionable validation error.

## 3. Authorization contract

Before implementation, identify the canonical tenant/business relationship for a lead from the actual schema and source code. Do not infer it from client-provided IDs.

The server-side mutation path must:
- require a valid authenticated session;
- resolve the acting user's active membership and authorized business/tenant scope on the server;
- verify the lead is within that exact scope;
- enforce an allowlist of valid state transitions and writable fields;
- reject client-supplied actor IDs, tenant IDs, audit actors, or ownership changes;
- return no cross-tenant existence details on denied requests;
- keep customer self-service access owner-scoped;
- use least privilege and avoid broad table grants or permissive RLS policies.

Prefer a narrowly scoped Edge Function or database RPC consistent with existing project patterns. Choose one after inspecting the canonical schema, existing audit mechanism, and current server-authoritative mutation conventions. Do not implement duplicate authorization logic in the browser.

## 4. Audit and concurrency

For each accepted transition, record:
- lead identifier;
- previous and new state;
- authenticated actor derived server-side;
- timestamp generated server-side;
- optional note with length limits and a documented PII policy;
- request/correlation identifier where supported.

Use an atomic transition so concurrent updates cannot silently overwrite each other. Require the expected prior state or a version token, and return a conflict response if the lead changed since it was read. Audit failure must not be silently ignored for a transition that is contractually required to be auditable.

Do not create a second competing CRM truth table if an appropriate canonical audit/event structure already exists.

## 5. UI contract

- Display lifecycle state and permitted next actions from server-authorized data.
- Hide actions the current role cannot perform, but treat UI visibility as convenience only; the server is the security boundary.
- Show loading, success, validation, permission-denied, conflict, and retryable-error states.
- Do not optimistically report a transition as saved before the server confirms it.
- Keep customer-facing lead submission separate from internal CRM management.
- Avoid hardcoded lead counts or fabricated activity history.

## 6. Implementation sequence

1. Inspect the actual `marketing_leads` schema, RLS policies, relevant migrations, Edge Functions/RPCs, audit tables, and current CRM UI call sites.
2. Write down the canonical lead-to-tenant/business binding and approved roles before changing access.
3. Implement a least-privilege server-authoritative transition contract and migration only if the existing schema cannot safely support it. Historical migrations must remain immutable; use a new forward-only migration.
4. Add static/source-level regression guards against direct browser mutations and broad policy regressions.
5. Wire the UI to the authoritative endpoint and render all safe error states.
6. Update the production TODO and continuity record with exact files/commits and classify the result as IMPLEMENTED — NOT VERIFIED until final acceptance.

## 7. Final acceptance matrix — deferred by project instruction

Run this only at the final comprehensive verification stage after development/integration is complete:
- requester can submit and read their own lead;
- unrelated customer cannot read or mutate the lead;
- authorized marketing staff can access only their assigned/authorized business scope;
- staff from another tenant/business are denied;
- inactive membership and revoked roles are denied;
- invalid transitions and writable-field tampering are rejected;
- concurrent transitions produce a conflict rather than lost updates;
- audit records are accurate and actor identity cannot be spoofed;
- retries are safe and do not duplicate events;
- UI displays truthful server results and errors.

Use isolated test accounts and non-production fixtures wherever possible. Any production-impacting operation requires explicit authorization and a verified recovery plan. Until the complete release gates are evidenced, production remains BLOCKED / NOT CERTIFIED.

## 8. Completion criteria

This contract began as a design baseline. RC457 now stages a backend transition RPC and audit/idempotency guard in the feature branch, but the UI is not yet wired and no database execution or final acceptance evidence has been produced. Keep the lifecycle feature NOT VERIFIED.


## 9. Source review findings — 2026-10-24

The current repository source was inspected after this contract was drafted:

- The RC452 migration scopes CRM lead/provider reads to an active membership's tenant/business, with a separate explicit platform-wide SUPER_ADMIN/full-control path. Preserve this boundary; do not replace it with a broad role-only policy.
- The `marketing-lead-create` Edge Function derives `requester_user_id` from the validated JWT actor, checks active memberships for the requested business, applies payload limits, and inserts through the service-role client. The function is a create path only; it does not implement lifecycle transitions.
- RC453 establishes the adjacent campaign pattern: server-side actor matching, a shared business-scope helper, row locking, allowlisted status transitions, audit-log writes, and explicit execute grants. Reuse the pattern only after confirming the lead table's actual schema and role semantics; do not copy campaign rules blindly.
- A status vocabulary discrepancy appears in the available source evidence: the lead-create function writes `OPEN`, while the RC452 disposable integration fixture uses `NEW`. This is not proof of a production defect, but it must be reconciled against the actual migration/schema and all UI consumers before defining a transition allowlist. Never silently normalize existing values.
- The existing RC102 baseline documents owner-scoped lead reads; later RC452 source adds business-scoped CRM manager and assigned-provider reads. These are different historical checkpoints, so the effective policy must be determined from the ordered migration chain, not inferred from one document in isolation.

- The internal CRM lead list in `web/app.js` now adds an active-business filter for internal business-management roles when `live.businessId` is selected. Customer-facing owner-scoped reads remain governed by RLS. This is defense-in-depth for the UI and does not replace database authorization. The change is classified **IMPLEMENTED — NOT VERIFIED** until exact-head CI/source review is recorded.

### Next implementation gate

Before writing the lifecycle migration/RPC, record the canonical status values, the exact approved transition graph, the meaning of platform vs tenant-level roles, the required audit-log fields, and whether lead notes contain personal data. Then implement a forward-only migration and a narrowly scoped backend mutation. The migration must be checked for version collisions against every open PR before it is proposed. No production migration is authorized by this design note.


## 10. RC457 backend implementation — 2026-10-24

- Added forward-only source migration `20261024193000_rc457_marketing_lead_lifecycle_backend.sql` on the feature branch. It creates a narrowly scoped `transition_marketing_lead_backend` RPC and an idempotency uniqueness guard in the existing canonical `audit_logs` store; it does not add direct browser UPDATE grants or a broad RLS policy.
- The RPC requires an authenticated non-anonymous actor, rejects actor spoofing, locks the lead row, requires an active authorized business scope through `mnty_can_manage_marketing_business`, checks the expected current status, allowlists transitions, writes status + audit atomically, and handles request retries using a caller-provided request UUID.
- The initial vocabulary `OPEN` is preserved. `NEW` is explicitly treated as a known legacy state from the disposable fixture only when the caller supplies it as the expected status; it is not rewritten automatically. The production schema/status inventory still needs confirmation during final acceptance.
- No free-text note field is introduced, avoiding a new PII storage path. The audit entry stores only status values and request correlation ID.
- The production migration source gate and its companion static contract were extended to require RC457 in chronological timestamp order. The production ledger is not updated, no migration was applied, and the release gate must remain BLOCKED until the full ordered migration plan is reconciled.
- Remaining development work: wire the existing CRM lead-detail/list UI to the RPC with a fresh request UUID per user action, render loading/success/permission/conflict/error states, add source-level guards for the RPC/UI boundary, and update the TODO/continuity records.
- Verification classification: **IMPLEMENTED — NOT VERIFIED**. Comprehensive runtime acceptance remains deferred until development and integration are complete.


## 11. RC457 UI integration — 2026-10-24

- The CRM lead detail drawer now offers only the next status transitions defined in the source contract, and only for internal management roles when the lead's `requester_business_id` matches the active business selected in the session.
- Internal lead detail reads add an active-business filter; customer detail reads remain requester-owner scoped. Database RLS remains authoritative.
- Status changes call `transition_marketing_lead_backend` with the current expected status, the selected next status, the authenticated user ID (which the RPC independently matches to `auth.uid()`), and a fresh request UUID.
- The UI handles conflict, invalid transition, forbidden/not-found, idempotency conflict, and generic failure without claiming success until the RPC confirms the requested status. It refreshes the workspace after a confirmed transition.
- Added source-level CI assertions for the UI/RPC contract and the ownership/business boundary. This is a static guard, not a runtime or adversarial security test.
- The migration is still source-only and has not been applied to production. Until the RC457 migration is approved and applied through the authorized release process, the new UI action must not be considered production-operational.
- Classification: **IMPLEMENTED — NOT VERIFIED**. Comprehensive acceptance remains deferred to the final development/verification stage. Production remains **BLOCKED / NOT CERTIFIED**.


### UI source review follow-up — active-business identity projection
A source review found that the CRM lead list query filtered manager results by `requester_business_id` but did not select that field, so the detail drawer could not reliably recognize a row as belonging to the selected business and therefore would not expose authorized lifecycle actions. The projection now includes `requester_business_id`, and the static guard asserts that the field remains selected. This was a source-level correctness fix; runtime behavior remains NOT VERIFIED.


## Cross-business partner discovery (RC458)
- The invitation picker must not widen direct SELECT access to `marketing_provider_profiles` across business boundaries.
- It uses `list_marketing_partner_directory_backend`, which verifies the authenticated actor and `mnty_can_manage_marketing_business(p_business_id)`, and returns at most 50 minimal directory records for active, verified `PARTNER_COMPANY` / `FREELANCER` profiles outside the selected business.
- The directory does not return owner IDs, contact details, or business IDs. Invitation creation is still revalidated by `invite_marketing_campaign_partner_backend`; response actions remain limited to the invited provider owner and are independently validated by `respond_marketing_campaign_invitation_backend`.
- RC458 is a forward-only source migration. Static guards do not replace runtime RLS/RPC, tenant-isolation, or release-chain acceptance. Production remains **BLOCKED / NOT CERTIFIED** until those checks are evidenced.

- The invitation workspace supports a search term of up to 80 characters and requests at most 50 results; the backend independently enforces both bounds. A search result is only a discovery aid: the invite RPC rechecks eligibility and business authority before creating an invitation.


## 12. Exact-head CI and release-gate evidence — 2026-10-24

- Evidence source: PR #373 head `75fe488bbe6cc73be50691f547dd785103ecfdb0`; workflow run IDs are recorded below so this snapshot is auditable.
- All 10 PR-triggered workflows completed successfully on that head: migration collision guard (`40123602279`), module professionalization (`40123602244`), marketing workspace contract (`40123602425`), migration version uniqueness (`40123602271`), migration history immutability (`40123602281`), web validation (`40123602254`), approval audit atomicity (`40123602245`), backend-only module boundary (`40123602253`), marketing campaign backend (`40123602275`), and MantiGO privacy boundary (`40123602252`).
- The web validation job generated a source-contract report but did not deploy: `validate` succeeded, while `validate_public_only` and `deploy` were skipped for this PR event.
- The exact-head production verifier still reports `PRODUCTION_GATE=BLOCKED`: the PR tree is missing the 16 RC425–RC441 migration source files restored in PR #372; the live reconciliation manifest still records `required_release_migrations_applied=false`, `chronological_replay=NOT RUN`, and tenant isolation, payment/finance E2E, backup/restore, Edge Function parity, SMM parity, and Auth security settings as `NOT VERIFIED`.
- These are source/isolated-CI findings only. They do not certify target Supabase runtime, production parity, external ad delivery, or disaster recovery. Keep the release gate blocked until post-dependency CI and authorized runtime evidence are complete.
