# MantiqaTix — Platform Billing, Wallet & Advertising Inventory Specification

**Workstream:** FIN-ADS-01  
**Priority:** P0 for dashboard architecture / P1 for production activation  
**Status:** SPECIFICATION ADDED — implementation and security review pending  
**Scope:** Platform-owned fees and advertising only. This is not a marketplace checkout or merchant-to-customer settlement system.

## 1. Non-negotiable business boundary

MantiqaTix is not a sales intermediary. It does not collect, hold, route, split, reconcile, or settle the value of goods/services sold by a business to its customer. Customer-to-business payment agreements and settlements remain outside the platform.

The platform wallet exists solely to collect amounts owed to MantiqaTix: subscriptions, explicitly configured platform commissions/fees, advertising reservations, and other approved platform charges. A commission may be calculated from an explicitly selected and disclosed assessment basis, including reported or platform-recorded merchant activity/sales value when contractually approved; the activity value is calculation evidence only. The customer still pays the merchant outside MantiqaTix, and the platform never receives, holds, splits, routes, reconciles or settles those sale proceeds. The only wallet debit is the merchant's separate platform-fee liability.

## 2. Flexible subscription and commission engine

Support composable, versioned pricing rules:
- Subscription only.
- Commission/usage fee only.
- Subscription plus commission/usage fee.
- Fixed amount only.
- Percentage only.
- Fixed amount plus percentage.

Each rule must define:
- Target scope: platform-wide, business/activity, category/specialty, service, package, or a specific subscriber.
- Charge type and calculation basis. Percentage basis must be explicit and versioned; supported bases may include approved platform service value, advertising value, platform-recorded eligible activity, or declared external sales/activity value where contractually approved. Record the source, period, verification status and evidence for any externally reported value. Never infer a sales basis from unrelated order/customer data.
- Currency (EGP initially), amount/rate, minimum/maximum where applicable, effective start/end, recurrence, due-date rule, grace period, and status.
- Whether the charge is recurring, one-time, usage-triggered, or manually assessed.
- Tax treatment as a configurable, reviewed field; do not invent tax calculations.
- Version and immutable snapshot of the rule used for every generated charge.

Rule precedence must be deterministic and documented. More-specific approved rules override broader defaults; conflicting active rules must fail closed and require admin resolution. Changes apply prospectively unless an authorized adjustment explicitly references an existing charge.

## 3. Wallet and ledger

Wallets are identified by authenticated platform account; a visitor must establish/verify an account before a persistent balance can be held. Support account-level wallet balances and a clear activity statement.

Required ledger properties:
- Append-only, double-entry-compatible journal; no direct balance edits.
- Every posted credit/debit has a unique idempotency key, source reference, actor, timestamp, currency, amount, status, and audit metadata.
- Pending top-ups are not spendable. Only verified/approved top-ups post a credit.
- No negative available balance. Charges may be paid only when sufficient available funds exist, or remain due.
- Atomic posting of wallet debit and charge settlement; retries cannot duplicate either.
- Reversals/refunds use compensating entries, never mutation/deletion of posted entries.
- Separate available, pending, reserved, and promotional balances if reservation/advertising flows require them; promotional credits have explicit expiry/eligibility rules.
- Reconcile provider references, external cash receipts, and ledger totals. Provide exception queues and daily reconciliation reports.
- Never expose wallet or ledger data across accounts/tenants; RLS and server-side authorization are mandatory.

## 4. Top-up channels

Support the following channel types behind provider/operations adapters:
1. Direct online top-up.
2. Bank/card credit payment (subject to the configured payment provider).
3. Vodafone Cash.
4. Cash paid outside the platform and recorded by an authorized operator.

For electronic channels, create a pending top-up intent and credit only after a verified provider callback/server-side status check. Webhooks must be signature-verified, replay-safe, idempotent, and reconciled. Never trust a browser redirect as proof of payment.

For external cash:
- Record payer account, amount, currency, received-at, receiving employee, receipt/reference and optional evidence attachment.
- Require approval by a distinct authorized reviewer where policy demands maker-checker separation.
- Do not credit wallet until approval; preserve rejected/voided records and reasons.
- Prevent the same receipt/reference from being credited twice.

Payment provider availability, Vodafone Cash integration method, fees, limits, refunds, and settlement behavior must be verified against the actual provider contract before implementation. Do not assume Paymob or another provider supports a channel until verified.

## 5. Automatic billing

Generate subscription and configured platform-fee invoices/charges from immutable rule snapshots. At due time:
- Attempt one atomic wallet debit if sufficient available balance.
- Mark paid only after ledger posting succeeds.
- If insufficient funds, leave the charge due, notify the account, apply configured grace/suspension policy, and never create a negative balance.
- Retries must be idempotent and observable.
- A commission charge may reference an expressly configured and auditable assessment event/value, including approved external-sales reporting, but the merchant-to-customer payment itself must never be collected, held or settled by MantiqaTix. Debit only the resulting platform charge from the merchant's own wallet balance.

Support monthly recurring subscriptions and rule-defined billing intervals. Include due date, grace period, retry schedule, pause/cancel behavior, proration policy (only when explicitly configured), and audit trail.

## 6. Administrative adjustments and benefits

Authorized administration may:
- Grant full or partial exemption.
- Apply fixed or percentage discount.
- Defer due date.
- Grant a gift/promotional wallet credit.
- Correct a charge through a reversal/adjustment workflow.

Every action requires permission, reason, actor, timestamp, affected account/charge, before/after values, and optional approval. High-impact adjustments should use maker-checker approval. Gifts are separately classified from paid top-ups and cannot be misreported as cash revenue. No silent edits to historical invoices or ledger entries.

## 7. Advertising cover inventory and reservations

Create inventory for promotional cover placements with:
- Placement/slot, dimensions and creative constraints, page/section, target audience/region where supported, and availability calendar.
- Pricing and durations: monthly, quarterly, half-yearly, yearly, or custom number of months.
- Start/end dates, booking status, creative submission/review, payment status, approval, publication, pause, cancellation, renewal, and expiry.
- Conflict prevention so overlapping reservations cannot occupy the same exclusive slot.
- Pricing snapshots at booking; future price changes do not rewrite existing reservations.
- Admin override only with an audit reason.
- Publication only after creative approval and either confirmed payment or explicitly recorded admin-sponsored/free placement.
- Wallet reservation/debit must be atomic and idempotent; define cancellation/refund rules before accepting live bookings.

## 8. Unified dashboard integration

Expose modules within the unified dashboard according to server-authorized roles:
- Platform finance/admin: pricing rules, invoices, top-up review, ledger/reconciliation, adjustments, advertising inventory/reservations, reports and audit.
- Business owner: own account wallet, own charges/subscription, invoices/receipts, top-up requests, advertising booking and own booking history.
- Employee: only explicitly assigned financial/advertising actions; no default access to balances, approvals, or platform-wide settings.
- Visitor/customer: public advertising display and, only after account verification, wallet/top-up functions if enabled by policy.
- Platform administrator may inspect/manage business records under explicit platform-admin authorization, but must not impersonate an owner or inherit business membership permissions.

All routes, RPCs, Edge Functions and database operations must enforce tenant/account scope server-side. Hiding controls in the UI is not authorization.

## 9. Required data/domain concepts (final schema to be derived from current schema)

Candidate domain objects: pricing_rule_versions, platform_charges/invoices, wallet_accounts, wallet_journal_entries, wallet_topup_intents, payment_provider_events, external_cash_receipts, billing_adjustments, advertising_slots, advertising_price_versions, advertising_reservations, creative_reviews, billing_audit_events, reconciliation_runs.

These are conceptual names only, not approval to create tables or migrations. First inspect existing schema, payment/ledger modules, RPCs, RLS, Edge Functions, provider integrations, and migration history. Reuse existing safe primitives where possible; do not duplicate or bypass the canonical ledger.

## 10. Security, accounting, legal and release gates

Before implementation:
- Map existing financial schema, ledger invariants, Paymob/payment provider contracts, webhook verification, wallet/credit concepts, role model, RLS and Edge Functions.
- Establish accounting treatment for customer funds, pending top-ups, promotional credits, platform revenue, deferred charges, reversals and liabilities.
- Obtain Egypt-specific legal/compliance review before operating any stored-value wallet or collecting/holding customer funds; confirm whether the model is permitted and whether licensing/provider restrictions apply.
- Define KYC/identity, limits, AML/fraud controls, privacy/retention and dispute procedures as legally required.
- Define maker-checker controls and least-privilege access.

Production gate:
- Isolated disposable DB migration replay from current production schema checkpoint.
- Ledger property tests, concurrency tests, idempotency/replay tests, insufficient-balance tests, webhook signature tests, cross-tenant RLS tests, role matrix tests, billing scheduler/retry tests, reconciliation tests and advertising-overlap tests.
- Provider sandbox evidence for each supported channel.
- Backup/restore and rollback rehearsal.
- Exact-head CI and deployed-origin E2E.
- Explicit release authorization. No production migration, payment activation, wallet credit, provider webhook change or deployment before gates pass.

## 11. Acceptance criteria

- Subscription-only, commission-only, combined, fixed, percentage and fixed-plus-percentage rules calculate deterministically from an explicit approved basis.
- No merchant-to-customer sale amount is charged or settled by default.
- A wallet credit appears only after verified provider success or approved external-cash receipt.
- Duplicate webhook, retry, receipt or scheduler execution never duplicates a credit/debit.
- Wallet never goes negative; insufficient funds leave a due charge and follow the configured grace policy.
- All admin exemptions, discounts, deferrals and gifts are attributable and auditable.
- Advertising periods and slot conflicts are enforced; reservation payment and publication state cannot diverge.
- Owners see only their own account/charges/reservations; employees see only granted actions; platform admins use separate platform authority.
- No production financial or database mutation occurs before explicit gates and authorization.

**Current implementation status:** Not implemented. This specification is an approved intake/design baseline only.