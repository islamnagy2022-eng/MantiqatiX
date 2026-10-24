# CRM / Marketing Lead Lifecycle — Implementation Contract

Status: DESIGN BASELINE — NOT IMPLEMENTED, NOT VERIFIED
Scope: define the safe contract for internal marketing teams to manage leads without weakening customer ownership or tenant isolation.
Release rule: this document is not approval to deploy, alter production grants, or run real-world acceptance tests. The comprehensive acceptance campaign remains deferred until module development and integration are complete.

## 1. Current source-backed boundary

The RC102 G8 baseline documents `marketing_leads` as:
- authenticated INSERT only when `requester_user_id = auth.uid()`;
- SELECT only for the requesting user.

This is an owner-scoped customer-lead boundary. It does not, by itself, authorize internal marketing staff to read or update every lead. Do not add a broad authenticated SELECT/UPDATE policy to make an internal CRM screen work.

The project TODO also records that lead details are currently read-only and that lifecycle updates remain unfinished because no suitable UPDATE policy is currently available.

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

This contract is complete as a design baseline only. Do not mark the lifecycle feature implemented until source changes, an exact-head CI result, authorization review, and the deferred final acceptance evidence are separately recorded.


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
