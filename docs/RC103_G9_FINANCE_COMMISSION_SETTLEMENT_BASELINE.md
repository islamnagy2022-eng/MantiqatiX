# RC103 — G9 Finance / Commission / Settlement Baseline

## Verified payment boundary
- `payment-intent` requires a non-anonymous authenticated user.
- Payable order states are restricted to `PENDING` and `CREATED`.
- Customer payment requires order ownership; non-owner payment requires an active financial role in the order tenant.
- Authoritative pricing snapshot fields are checked before provider intent creation.
- Paymob amount/currency are derived from authoritative order data.
- Provider callback uses Paymob HMAC verification.
- `process_verified_provider_payment` re-checks tenant, provider, order state, pricing binding, amount and currency.
- Provider payment events are idempotency-protected.
- Commission is calculated from the configured tenant/business commission rule and cannot exceed the order amount.
- Provider payout and platform commission obligations are recorded.
- Financial reconciliation is explicitly marked operationally reconciled while GL posting remains `NOT_POSTED` until account mapping is configured.

## Settlement boundary
`create_settlement_backend` is SECURITY DEFINER with `search_path=public` and first calls `assert_financial_membership(p_tenant_id)`.
It rejects negative amounts and requires:
`gross = platform_fee + net + voucher`
with two-decimal rounding.
It also protects settlement IDs against replay with changed financial values.

## Critical G9 finding and fix
`commission_rules` had legacy broad authenticated `ALL` policies in addition to role-scoped admin policies. Those broad policies could broaden write access.

Removed in production:
- `authenticated_sessions_only`
- `deny_anonymous_users`
- `mnt_non_anonymous_boundary`
- `non_anonymous_authenticated_guard`

Remaining verified policies:
- SELECT: active tenant member.
- INSERT: active tenant OWNER/ADMIN/MANAGER.
- UPDATE: active tenant OWNER/ADMIN/MANAGER.
- DELETE: active tenant OWNER/ADMIN/MANAGER.

Production migration:
`rc103_g9_commission_rules_rls_hardening`

GitHub commit:
`f8b9439c4ad6f746854b6a108fb2cda24e3b8618`

## Finance read boundaries verified
- commission transactions: finance/admin roles only within tenant.
- payment reconciliations: finance/admin roles only within tenant.
- payment intents: finance/admin roles only within tenant.
- payment provider events: finance/admin roles only within tenant.
- settlement transactions: finance/admin roles only within tenant.
- financial obligations: active tenant members can read according to current policy; this remains a candidate for narrower role-specific review before final go-live.

## Not yet verified
- live successful Paymob transaction.
- duplicate webhook replay against production.
- two-tenant finance isolation with real users.
- provider payout lifecycle through actual settlement.
- GL posting/account mapping.
- full browser finance E2E.
- external Security Advisor clean state.

## Release status
**G9 security implementation + database verification: COMPLETE.**
**Real-money / external E2E: NOT VERIFIED.**
