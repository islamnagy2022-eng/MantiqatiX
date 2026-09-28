# RC200 — Payment / Refund Booking Path

## Status
- Payment authorization boundary: **FIXED + VERIFIED**
- Payment database idempotency: **VERIFIED**
- Paymob real-money E2E: **BLOCKED**
- Refund E2E: **NOT VERIFIED**
- RC200 overall: **OPEN**

## Production verification
- `payment_intents` exists.
- `payment_provider_events` exists.
- Unique payment-intent idempotency index exists on `(tenant_id, idempotency_key)`.
- Unique provider/order constraint exists when `provider_order_id` is present.
- Unique provider event constraint exists on `(provider, external_event_id)`.
- `create_payment_intent_backend` is `SECURITY DEFINER`, `search_path=public`.
- `anon` EXECUTE: false.
- `authenticated` EXECUTE: true.
- The function authenticates with `auth.uid()` and rejects anonymous users.

## RC200 issue found and fixed
The previous payment RPC required active membership in the provider/order tenant before allowing the caller to proceed. That contradicted the marketplace rule where a customer can place and pay for their own order from another provider tenant.

The live function was changed so:
- the authenticated customer who owns the order may create/pay the payment intent across the provider tenant;
- a non-owner actor still requires active tenant/business membership;
- provider-side financial roles remain required when acting for another customer's order;
- amount, currency, pricing snapshot/hash, provider, payment method and idempotency key remain server-validated;
- existing payment intent replay remains idempotent and conflicts are rejected.

Production readback after migration confirms the new authorization logic.

## Paymob path review
`payment-intent` source:
- requires Bearer authentication;
- rejects anonymous users;
- requires configured Paymob secrets;
- loads the order server-side;
- allows the customer owner or authorized financial tenant actor;
- delegates payment-intent persistence to `create_payment_intent_backend`;
- verifies amount/currency/pricing hash/version against the authoritative order;
- sends the Paymob intention request server-side;
- persists the provider intent under the matching payment intent and pricing snapshot.

`paymob-webhook` source:
- validates Paymob HMAC-SHA512;
- validates amount/currency;
- correlates subscription or order payment intent;
- detects duplicate provider events;
- delegates verified payment processing to backend RPCs.

## NOT VERIFIED / BLOCKED
- No real Paymob transaction was executed.
- No real customer-to-provider order exists in Production.
- No real payment success webhook was processed.
- No duplicate webhook replay was exercised with real provider events.
- No refund transaction was exercised.
- No end-to-end payment-to-financial-settlement rehearsal was executed.

## Source / commits
- Production migration: `rc200_cross_tenant_customer_payment_authorization`.
- Source migration: `supabase/migrations/20260928190000_rc200_cross_tenant_customer_payment_authorization.sql`.
- Source commit: `f07ed0587f0741fa6bb0345ad23e0d9ab9b92271`.

## Conclusion
RC200 is **not closed**. The payment authorization and database idempotency boundaries are verified, but real-money payment/refund behavior remains blocked until a real authorized booking fixture and approved Paymob test/production transaction path are available.