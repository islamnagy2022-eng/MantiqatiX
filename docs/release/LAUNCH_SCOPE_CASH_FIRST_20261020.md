# MantiqatiX — Launch Scope Decision: Cash First
Date: 2026-10-20
Status: Product scope decision recorded; implementation and E2E evidence remain separate gates.

## Launch scope

### Required before launch: cash-only collection
- The launch release exposes cash payment only for order/payment flows in scope.
- Cash collection must use the existing server-authoritative cash confirmation path where supported; do not add a browser-side direct write or trust a client-supplied amount.
- The amount and currency must come from the authoritative order/pricing snapshot.
- Cash confirmation must be restricted to the authorized operational role/permission, scoped to the active tenant/business, and idempotent under retries.
- Verify the order/payment state transition, audit trail, receipt/status visibility, duplicate confirmation rejection/no-op behavior, and accounting/reconciliation behavior required by the product.
- Verify tenant payment-method configuration and fail closed when cash is not enabled for that tenant/business.
- Do not show or accept Paymob/card/online checkout methods in the launch UI. If a path is not fully verified as cash-only, keep it disabled rather than silently falling back to an electronic method.
- This scope decision does not itself prove cash E2E readiness. Cash-only launch remains blocked until its tests and release evidence pass.

### Deferred until after launch: electronic payments
- Defer Paymob production activation, card/online checkout, provider callback/webhook production E2E, online payment retries/reconciliation, and electronic-payment launch UI.
- Preserve existing code and security boundaries unless a separate reviewed change is needed to prevent accidental pre-launch exposure.
- Do not delete payment history, payment-intent infrastructure, or migrations merely because the feature is deferred.
- Keep electronic payment processing disabled/unavailable in the launch experience. Do not run production financial transactions as test data.

### Deferred until after launch: SMM
- Defer SMM provider integrations, provider API credentials usage, automated SMM order fulfilment, campaign spend execution, and related live billing workflows.
- Keep SMM credentials and provider-sensitive tables fail-closed to ordinary client roles. Deferring the feature is not permission to relax security.
- The existing marketing/agency workspace, CRM, lead management, projects, and ordinary marketing planning are not automatically deferred by this decision; they remain in launch scope only to the extent already implemented and independently verified.
- Sponsored-ad billing/backend work remains deferred until after core launch.

## Implementation checkpoint — 2026-10-20
- Marketplace cart checkout source offers cash on delivery only, validates a single business/branch, verifies catalog items, and submits item identifiers/quantities rather than client prices.
- RC458 updates the existing service-role-only `create_order_backend` actor check for trusted Edge Function calls while preserving the existing EXECUTE ACL and customer membership/tenant/business/catalog/server-pricing checks. RC458 must pass disposable PostgreSQL integration and ordered forward replay before rollout.
- Cash intent amount authority and non-destructive idempotency are source-enforced and statically tested; authenticated browser E2E and authorized cash confirmation remain NOT VERIFIED.
- Digital-page paid checkout is disabled pre-launch because its current flow requires electronic payment and no verified cash contract exists for that product.
- SMM UI shows a deferred state and the gateway remains default-deny; SMM fulfilment, provider credential use and live billing are post-launch.

## Pre-launch acceptance checklist

- [ ] Inspect current UI and API routes to prove electronic methods are not offered or callable through the normal launch workflow.
- [ ] Verify cash method is enabled/configured only for intended tenants/businesses.
- [ ] Run authenticated customer → order → provider/operations → cash confirmation E2E.
- [ ] Prove customer cannot self-confirm cash and unrelated tenant/business cannot confirm it.
- [ ] Prove server-derived amount, idempotency/retry safety, valid state transitions, and audit trail.
- [ ] Verify cash accounting/commission/settlement behavior that is required for the launch business model; do not fabricate financial transactions.
- [ ] Verify user-facing cash status/receipt and error/retry behavior in browser/device testing.
- [ ] Confirm the launch release gate does not depend on Paymob/electronic-payment or SMM production E2E.
- [ ] Keep the global release BLOCKED / NOT CERTIFIED until all remaining mandatory gates pass.

## Reporting rules
- Distinguish source implementation from runtime verification.
- Label deferred work POST-LAUNCH / NOT A LAUNCH GATE; do not label it DONE.
- Continue to report all main and sub-items in the Master Production TODO at each continuation checkpoint.
- No production migrations, grants, RLS changes, payment transactions, or deployments are authorized by this scope decision.
