# Marketing Financial Mutation Contract

**Status:** DESIGN CONTRACT — NOT IMPLEMENTED, NOT RUNTIME-VERIFIED  
**Scope:** Marketing plans, provider subscriptions, project participation/allocation, and commission rules.  
**Release policy:** Keep these operations read-only until the gates below are implemented and independently tested.

## Why this contract exists

The operations workspace displays financial or financially consequential marketing data. A UI role check is not authorization, and a successful browser request is not evidence that a financial change was recorded atomically. The existing read-only notices must remain until all mutation paths are server-authoritative.

This document intentionally does not assume undocumented table columns, existing RPC names, or production schema parity. Before implementation, inspect the complete chronological migration chain and the target schema in an approved non-production environment.

## Required command boundary

Every future write must use a narrowly scoped database RPC or Edge Function. Browser code must not directly `insert`, `update`, `upsert`, or `delete` financial configuration or lifecycle rows.

The server boundary must:

1. Derive the actor from the verified session and reject anonymous sessions.
2. Verify active membership and the selected business/tenant on the server; never trust a business or actor ID supplied by the client.
3. Apply a least-privilege role/permission check specific to the requested operation.
4. Validate all enumerated states, currency, decimal precision, amount ranges, effective dates, and allowed transitions server-side.
5. Use an expected-current-state/version check and row lock where concurrent changes could conflict.
6. Accept a caller request/idempotency key, persist its result in the same transaction, and return the prior result for a safe replay. Reject reuse of a key with a different payload.
7. Write an immutable audit record in the same transaction, including actor, business scope, operation, record ID, request key, before/after values, reason, and timestamp. Do not log secrets or payment credentials.
8. Return stable machine-readable error codes that do not disclose cross-tenant record existence.
9. Revoke execution from `PUBLIC` and `anon`; grant only to the required authenticated role after server-side authorization.
10. Never trigger a real payment, refund, settlement, external advertising spend, or plan charge merely by editing a configuration row.

## Operation-specific acceptance criteria

### Plans

- Treat changes to price, currency, billing interval, feature limits, or activation state as versioned configuration.
- Preserve prior versions and effective dates; do not silently rewrite the terms of an existing paid subscription.
- Require a reason for material pricing or entitlement changes.
- Verify existing subscriptions continue to reference the intended plan version.

### Provider subscriptions

- Define the allowed lifecycle from the existing schema and product policy before writing code; do not invent or normalize status vocabulary.
- Separate subscription state changes from payment collection. Activation after payment requires a verified server-side payment event, not a client assertion.
- Make renewals, cancellation, retries, and webhook processing idempotent.
- Enforce tenant ownership and subscription owner boundaries independently of UI filtering.

### Project participation and allocations

- Validate project/business scope, participant eligibility, allocation percentage and agreed amount using the canonical project currency.
- Reject allocations outside policy bounds and prevent accidental duplicate active participation.
- Require explicit confirmation and an audit reason for changes affecting an agreed allocation.
- Reconcile any downstream payable/commission impact before allowing changes after financial commitment.

### Commission rules

- Define precedence, effective dates, rounding mode, and whether the rule applies to new projects only or to in-flight projects.
- Never silently recalculate posted ledger entries when a rule changes.
- Require a preview/dry-run of impacted records and an explicit approval step for material changes.
- Keep the existing commission read policy unchanged; do not broaden direct table access to make the UI work.

## Required test matrix

Run these in disposable PostgreSQL with realistic independent identities and fixtures:

- unauthenticated and anonymous callers are denied;
- spoofed actor ID is denied;
- a user from another tenant/business cannot read or mutate the record;
- a user with a read-only role cannot mutate;
- invalid state, amount, currency, date, and out-of-range allocation are rejected;
- stale expected version returns a conflict without partial writes;
- identical request replay returns the original result and creates no duplicate audit/ledger effects;
- same request key with a different payload is rejected;
- audit record and business change commit or roll back together;
- revoked PUBLIC/anon grants and authenticated EXECUTE grants are verified;
- commission changes do not mutate posted ledger history;
- payment/webhook retries cannot double-activate or double-charge a subscription;
- browser tests verify disabled/read-only UI for unauthorized roles, while backend tests prove authorization even if requests are forged.

## Release gates

- [ ] Canonical table definitions, constraints, policies, triggers, grants, and status vocabularies reviewed from the complete migration chain.
- [ ] Forward-only migration reviewed for collisions and historical migration immutability.
- [ ] RPC/Edge Function implemented with server-side authorization, transaction safety, idempotency, and audit.
- [ ] PostgreSQL negative/positive authorization tests pass.
- [ ] Browser E2E passes for manager, provider, read-only member, and cross-tenant attacker identities.
- [ ] Reconciliation and rollback/restore plan reviewed.
- [ ] Exact-head CI passes and the production target's schema parity is independently verified.
- [ ] Explicit release approval recorded before any production migration or financial operation.

Until every applicable gate is closed, keep plans, subscriptions, project financial allocations, and commission rules read-only. Production status remains **BLOCKED / NOT CERTIFIED**.
