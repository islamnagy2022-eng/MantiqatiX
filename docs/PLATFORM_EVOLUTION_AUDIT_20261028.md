# MantiqatiX Platform Evolution Audit — 2026-10-28

## Scope
Initial read-only audit for the platform evolution request covering commission rules, catalog registration, subscription reuse, and safe reuse of the existing catalog architecture.

## Repository baseline
- Repository: `islamnagy2022-eng/MantiqatiX`
- Branch: `main`
- Audited HEAD: `1a93658e7846a6b0917e0307bedac333077942f0`
- React catalog entry: `apps/catalog-frontend`
- Main legacy platform shell remains under `web/`; do not replace the current catalog app with the legacy shell as part of this work.

## Verified existing database foundations
The live Supabase schema exposes these relevant tables with RLS enabled:
- `commission_rules`: `tenant_id`, optional `business_id`, `module_id`, `rule_type`, `percentage`, `fixed_amount`, `per_item_amount`, `active`, timestamps.
- `commission_transactions`: tenant/business/order/rule references, gross and commission amounts, status, created timestamp.
- `business_subscriptions`: business, tier, billing cycle, status, start/end, provider references, idempotency key.
- `subscription_tier_prices`: tier code, monthly/annual price, currency, active state.
- `subscription_payment_intents`: business, tier, billing cycle, amount/currency, provider correlation fields, idempotency key and expiry.
- `catalog_items`, `catalog_item_prices`, `catalog_item_options`, `catalog_business_settings`: existing catalog-domain schema that should be evaluated before creating duplicate tables.
- `businesses`, `user_memberships`, `approval_requests`, `account_registration_requests`: existing identity, ownership, and approval-related foundations.

## Commission security observations
- `commission_rules` has RLS enabled.
- Current live policies allow active tenant members to read rules and active tenant OWNER/ADMIN/MANAGER roles to insert/update/delete rules within their tenant.
- `commission_transactions` reads are restricted to finance/admin roles within the same tenant.
- A prior security migration removed broad authenticated policies from `commission_rules`; preserve the hardened boundary.
- The current rule schema does not itself expose all requested rule dimensions such as explicit product/service scope, classification scope, start/end time, approval metadata, and an immutable rule version. Those require careful schema/API design before a UI can safely promise them.
- Do not give a platform-only SUPER_ADMIN a direct-table write path that bypasses the existing tenant authorization contract. Platform-wide rule management should use a reviewed server-authoritative path with explicit platform permission checks and audit logging.

## Catalog registration observations
- The current React catalog app already has a platform-admin business creation form in `apps/catalog-frontend/src/components/admin/AdminDashboard.tsx`.
- Merchant catalog management exists in `apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx`.
- The repository has a protected `business-register` Edge Function that creates a pending business and approval request. It requires an authenticated, non-anonymous user with an existing eligible membership or an explicitly authorized platform-admin membership; it is not a universal anonymous self-registration endpoint.
- The existing `catalog-admin` Edge Function is the current catalog mutation path and should remain the server authority for catalog writes.
- The current merchant dashboard already supports product/service entry, profile/branding fields, social links, and a public catalog QR/link workflow. Extend these flows rather than introducing duplicate catalog storage.
- Do not bypass approval, membership, payment, tenant, or publication gates in order to make registration appear simpler.

## Subscription reuse observations
- Existing subscription and price tables are present. Reuse them after reviewing their constraints, RLS policies, payment-intent lifecycle, and renewal support.
- Do not assume recurring billing is supported merely because monthly/annual price fields exist.
- Existing production notes identify external payment E2E and some release/security checks as not verified. No production financial migration or payment behavior was changed during this audit.

## Implementation sequence
1. Map existing catalog registration and owner-membership flows; design the shortest safe multi-step flow around the protected backend endpoints.
2. Build a registration draft/stepper that saves progress without granting publication or ownership privileges client-side.
3. Define and review the commission rule model, including rule scope, priority, eligibility event, pricing basis, effective dates, audit trail, idempotency, and reversal behavior.
4. Add a server-authoritative commission management path with platform and tenant scope checks; only then expose rule editing in the appropriate dashboards.
5. Reuse existing subscription tables and payment intents; verify constraints and lifecycle before UI changes.
6. Add integration and negative authorization tests before any production migration or deployment.

## Status — follow-on work
- Initial read-only audit: DONE.
- Flexible commission draft schema, tenant-scoped RPC, draft UI, audit trigger/history: IMPLEMENTED in RC452. Additive migration applied to production; live schema and RPC presence verified.
- Commission calculation activation: BLOCKED by design until the payment engine supports all scopes, events, effective dates, bounds, exemption, reversals, and combined formulas.
- Catalog CSV import: IMPLEMENTED as a preview-first path with local draft autosave/resume, duplicate validation, sequential server-authoritative writes, and retryable failures.
- Direct XLSX import, AI image suggestions requiring user approval, complete multi-step publication workflow, and cross-device drafts: NOT YET IMPLEMENTED.
- Live authenticated browser E2E: NOT VERIFIED. This is not a production readiness certificate.
