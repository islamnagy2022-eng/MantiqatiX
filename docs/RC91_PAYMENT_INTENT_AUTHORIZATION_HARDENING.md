# RC91 — Payment Intent Authorization Hardening

Date: 2026-09-28

## Production change
Applied migration `rc91_harden_payment_intent_order_state` to harden `public.create_payment_intent_backend`.

The SECURITY DEFINER RPC now verifies:
- authenticated non-anonymous session;
- order exists and tenant matches;
- order is in PENDING or CREATED state before a payment intent can be created;
- active membership access to the tenant/business;
- non-customer callers require an appropriate finance/admin role when acting for another customer;
- authoritative pricing snapshot exists;
- requested amount and currency match the authoritative order values;
- provider, payment method, and idempotency key are present and bounded;
- idempotency reuse cannot cross order/amount/currency/pricing boundaries.

## Verified database state
- `authenticated`: EXECUTE only, intentionally retained for the frontend payment-intent contract.
- `anon`: no EXECUTE.
- `service_role`: EXECUTE.
- Direct production verification confirms the deployed function contains the order-state guard.

## Source alignment
The tracked `payment-intent` Edge Function was also updated to reject orders outside PENDING/CREATED before creating a provider intent.

The Edge Function source update was committed as `8ca0eb187e0ee39ff0725347bc15b0edff943c3a`.

## Important release limitation
The Edge Function deployment action was not executed from this environment after the source commit, so the live Edge Function version is not claimed as updated by this RC. The database RPC hardening is live and directly verified.

No production orders, payment intents, balances, or financial transactions were created or modified by this hardening work.
