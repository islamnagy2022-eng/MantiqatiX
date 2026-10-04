# RC338 — Production boundary audit — 2026-10-04

## Verified evidence
The live database was reviewed for the core security and financial boundary tables:

- `orders`: RLS enabled with tenant/customer/provider/member policies.
- `payment_intents`: RLS enabled; finance-read is tenant-scoped.
- `user_memberships`: RLS enabled; self-read only.
- `support_tickets`: RLS enabled; requester/assignee/staff access is tenant-scoped.
- `ticket_messages`: RLS enabled; access is inherited through the parent ticket tenant.
- `notifications`: RLS enabled and user-scoped.
- `financial_obligations`: RLS enabled and tenant-membership scoped.
- `settlement_transactions`: RLS enabled and finance-role/tenant scoped.
- `general_ledger`: RLS enabled and finance-role/tenant scoped.

## Payment integrity
The database has a unique constraint:
`uk_tenant_idempotency UNIQUE (tenant_id, idempotency_key)`.

The server-side payment-intent RPC:
- rejects anonymous users;
- locks and resolves the order server-side;
- requires tenant match;
- requires payable order status;
- validates access against the order tenant/business;
- requires a pricing snapshot;
- rejects client amount/currency mismatches;
- enforces non-empty bounded idempotency keys;
- returns the existing intent for an equivalent idempotent retry;
- rejects conflicting idempotency reuse;
- persists the authoritative order total/currency/pricing snapshot rather than the client amount.

## Authorization boundary
The nine authenticated-callable SECURITY DEFINER functions and the intentionally public advertisement RPC retain explicit `search_path=public, pg_temp`. The sensitive functions deny anonymous execution.

## Reusable audit
A read-only SQL contract is stored at:
`scripts/verify-rc338-production-boundaries.sql`

## Remaining evidence gap
This audit is database-structural and function-definition evidence. It does **not** prove adversarial two-user/two-tenant behavior, real payment-provider behavior, browser/device push delivery, backup restoration, or Android release artifacts.

## Status
**RC338 — VERIFIED (structural/database boundary evidence).**
Overall Production Gate remains **OPEN** until external runtime gates are closed.
