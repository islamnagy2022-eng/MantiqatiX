# RC198 — Order Idempotency Atomicity & Production Convergence

## Status
- Idempotency atomicity: **VERIFIED**
- `order-create` production convergence: **VERIFIED**
- RC198 release gate: **CLOSED**
- Booking production release gate: **OPEN**

## Database verification
Production project: `moyhiluyhjsujhwlyeuu`

The live `public.orders` table contains:
- `client_idempotency_key varchar`, nullable.
- `tenant_id varchar`, not null.

Live index:
- Name: `ux_orders_tenant_client_idempotency`
- Definition: `UNIQUE (tenant_id, client_idempotency_key) WHERE client_idempotency_key IS NOT NULL`
- `indisunique = true`
- `indisvalid = true`
- `indisready = true`

This is the required atomic database protection for the `(tenant_id, client_idempotency_key)` pair. No migration was applied because the required unique index already exists in production.

## Duplicate-data check
A live production query grouped non-null idempotency keys by `(tenant_id, client_idempotency_key)` and returned **zero duplicate groups**.

Current live order counts:
- Total orders: 0
- Orders with idempotency keys: 0
- Orders with null idempotency keys: 0

Therefore there is no existing duplicate data blocking or invalidating the unique index.

## Backend RPC verification
Live `public.create_order_backend(...)` was read back from PostgreSQL.

Verified behavior includes:
- `auth.uid()` must match `p_customer_id`.
- Target tenant/business must be validated.
- Active provider profile is required.
- Branch/business/tenant relationship is validated.
- Existing `(tenant_id, client_idempotency_key)` is checked before insert.
- Pricing is re-read from catalog and prices.
- Server recalculates subtotal, tax, delivery and total.
- Pricing snapshot/hash are generated server-side.
- Order persistence uses `client_idempotency_key`.
- Function is `SECURITY DEFINER` with `search_path = public`.

Live function execution privileges:
- `anon`: false
- `authenticated`: false
- `service_role`: true

This preserves the intended server-authoritative boundary.

## Edge Function production convergence
Live `order-create` was read back from Supabase.

Verified:
- Status: `ACTIVE`
- Version: `5`
- `verify_jwt`: `true`
- Production SHA-256: `7f2090ba15abe3fbc58cf8d1c5308423ac7d92bbb2544e09de27df238080e713`

The read-back source matches the current GitHub `supabase/functions/order-create/index.ts` content associated with RC198 deployment convergence.

## Important source/database note
The supplied RC40 source package contains an earlier migration defining the same unique index. The live database verification above is the authoritative evidence for the current production state; no assumption was made from source presence alone.

## Not yet verified
- Real customer-to-provider booking E2E.
- Provider-side isolation/status transition E2E.
- Notification delivery E2E.
- Payment/refund E2E.
- CI/release gate for the current web/backend commits.
- Final rollback rehearsal.

## Release conclusion
RC198 is **VERIFIED/CLOSED** for the two requested tracks:
1. Idempotency atomicity is protected by a live valid unique partial index and has no duplicate data.
2. `order-create` production deployment is converged and read back with the expected version, JWT setting and SHA-256.

The overall MNTY production release is **not yet Production Ready** because the remaining E2E, CI and rollback gates above are still open.