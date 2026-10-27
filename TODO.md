# MantiqatiX — Master TODO / Continuation Ledger

Last updated: 2026-10-27
Target: production launch only. Do not use DEMO as the release target.

## Operating rules

- Every new user request, discovered defect, release blocker, and follow-up must be recorded here before stopping work.
- Keep this file updated with status, evidence, next action, and rollback notes after each meaningful change.
- Never claim production-ready based on a build alone. A task is complete only after implementation, automated checks, relevant production-safe verification, and evidence are recorded.
- No destructive production database change or migration until recovery capability is confirmed and a restore rehearsal is documented.
- Preserve a known-good Git reference before code changes. A Git branch is not a database backup.
- Prefer additive, reversible changes; document forward-fix/rollback procedures. Never rewrite historical applied migrations.
- Do not merge or deploy while the production gate is blocked.

## Current release safety status

- [x] Recorded code baseline: `0274bbd3f3657838153d1c8b62ea31ce487d1c90`.
- [x] Safety branch exists: `safety/production-main-20261027`.
- [x] Isolated hardening branch exists: `fix/production-launch-hardening-20261027`.
- [x] Draft PR #411 created for deploy gating and rollback documentation: https://github.com/islamnagy2022-eng/MantiqatiX/pull/411
- [x] Documented production release safety/rollback runbook: `docs/release/PRODUCTION_RELEASE_SAFETY_AND_ROLLBACK_20261027.md`.
- [ ] PR #411 reviewed and merged only after checks and release-safety review.
- [ ] Confirm actual Supabase production backup/PITR retention and latest recovery point.
- [ ] Perform and document an isolated restore rehearsal; validate schema and representative data.
- [ ] Reconcile repository migrations with the production ledger and live schema. Current observed ledger showed RC107–RC112 plus catalog seed; RC113–RC117 were not observed in that ledger. Investigate each migration and dependency before deciding whether it is pending, superseded, or represented differently.
- [ ] Make the production gate accurately validate all release-critical evidence; prevent any parallel workflow from bypassing the gate.
- [ ] Run production-safe authentication, role, subscription, business catalog, RLS, financial, webhook/idempotency, and post-deploy smoke tests.
- [ ] Keep release BLOCKED until every critical item above is evidenced.

## Product requirement: dedicated Platform Administration Console

Build this as a first-class, production-grade console consistent with the existing MantiqatiX product and recovered/previous production design where available. Do not make a separate demo app and do not break the platform's broader original purpose.

### A. Admin home dashboard
- [ ] Create a dedicated administration shell and navigation, separate from the business-owner/customer experience.
- [ ] Summary cards: total businesses, active/paused/suspended businesses, owners assigned/unassigned, total customers, active/past-due/cancelled subscriptions, commission accrued/collected/outstanding, claims due/overdue, recent administrative actions, and critical alerts.
- [ ] Visits/traffic analytics by day and selectable date range; clarify whether metrics are page views, unique visitors, sessions, or business-page visits and avoid double counting.
- [ ] Charts and drill-downs from summary metrics to the underlying records.
- [ ] Date, business, category, subscription, and status filters where relevant.
- [ ] Loading, empty, error, mobile/responsive, and permission-denied states.

### B. Full business/activity management
- [ ] Search/filter/list businesses and open a complete business profile with all editable fields.
- [ ] Admin can create/encode a business before its owner registers; keep it unclaimed/unassigned until a verified owner claims it or admin assigns a verified account.
- [ ] Admin can assign/change owner later with authorization and audit history.
- [ ] Admin can edit all business-managed data that policy permits: profile, contact data, category, description, location, media, catalog/products/services, operating settings, visibility and relevant configuration.
- [ ] Activate, pause, suspend/block, restore, archive, or delete a business using explicit state transitions and reason capture.
- [ ] Distinguish reversible deactivation/archival from permanent deletion. Preserve financial/order/audit records and follow retention policy; require confirmation and dependency checks for destructive operations.
- [ ] Ensure public pages and APIs consistently enforce the business state; hiding a UI button is not sufficient.
- [ ] Admin can operate a business without an owner only where supported by a documented platform-owned/ownerless state; define permissions, accountability, and later ownership transfer.
- [ ] Test business state transitions, unclaimed records, owner assignment, and owner/customer access.

### C. Subscription management
- [ ] Unified list and detail view for every subscription with owner/business, plan, start/end dates, renewal, status, payment state, and history.
- [ ] Admin may grant, change, pause, resume, cancel, revoke, or block subscriptions within policy; require a reason and record actor/time/before-and-after values.
- [ ] Clearly separate subscription entitlement status from payment status and business visibility.
- [ ] Prevent duplicate subscriptions/charges and stale entitlements; define treatment of refunds, proration, expiry, and manual grants.
- [ ] Ensure changes propagate to the app and backend consistently, including existing sessions where necessary.
- [ ] Test active, trial/granted, expired, unpaid, cancelled, suspended, and restored states.

### D. Flexible commission rules and ledger
- [ ] Define commission rules with percentage or fixed amount, scope (platform-wide, category, business, service/order type where supported), priority/stacking policy, currency, effective start/end, caps/floors if required, and enabled/disabled state.
- [ ] Explicitly define whether multiple commissions stack, override, or are mutually exclusive. Show a preview before saving a rule.
- [ ] Store immutable snapshots of applied commission rules/rates on each financial transaction so later rule changes do not rewrite history.
- [ ] Enforce idempotency so one transaction cannot accrue commission more than once.
- [ ] Track accrued, due, claimed/invoiced, paid/settled, reversed, disputed, and overdue amounts separately.
- [ ] Support corrections through auditable reversals/adjustments rather than editing historical ledger entries in place.
- [ ] Test rounding, currency, refunds/cancellations, partial settlements, duplicate webhooks, concurrent events, and rule effective dates.
- [ ] Do not represent calculated commissions as collected cash until settlement/payment evidence confirms it.

### E. Claims, statements, and reporting
- [ ] Commission claims/invoices: reference, business, period, line items, gross base, rule snapshot, total due, due date, payment/settlement status, notes, and timestamps.
- [ ] Per-business statement with full drill-down to source transactions and adjustments.
- [ ] Platform-wide and per-business reports by date, category, subscription, commission rule, and settlement status.
- [ ] CSV export initially; other export formats only where supported and secured.
- [ ] Enforce admin-only access to financial reports and avoid exposing other businesses' data.
- [ ] Reconcile ledger totals to payment/settlement records and add automated integrity tests.

### F. Category/section management
- [ ] Create, edit, reorder, enable/disable, archive, and delete categories/sections.
- [ ] Check dependencies before deletion; migrate or reassign linked businesses/services explicitly rather than orphaning data.
- [ ] Keep public discovery, business onboarding, and admin category lists consistent.
- [ ] Audit all category changes and test permissions.

### G. Permissions, access, and audit
- [ ] Separate platform owner/admin, business owner, customer, and any delegated staff roles.
- [ ] Use least-privilege permissions and server/database enforcement (RLS and privileged server actions), not client-side route guards alone.
- [ ] Provide controlled grant/revoke of admin capabilities, with safeguards against accidental removal of the last platform owner.
- [ ] Require strong authentication/re-authentication for high-impact operations where supported.
- [ ] Immutable or append-only audit trail for business edits, state changes, ownership assignment, subscription actions, commission changes, category changes, permission changes, exports, and deletion requests.
- [ ] Record actor, timestamp, target, action, reason, before/after snapshot where safe, request/correlation ID, and result.
- [ ] Never log secrets, tokens, or unnecessary sensitive data.
- [ ] Test direct API/RLS access as customer, business owner, and platform admin.

### H. Admin UX and quality
- [ ] Restore/review previous production admin UI patterns from repository history where available before inventing a new design.
- [ ] Provide dedicated admin route/layout, breadcrumbs, searchable tables, pagination, filters, clear status labels, confirmations, and accessible keyboard/mobile behavior.
- [ ] Use consistent Arabic RTL layout and localization with a responsive desktop-first data-dense console.
- [ ] No fake counts, demo fixtures, or fabricated financial values in production. Show truthful empty/error states when metrics are not yet wired.
- [ ] Add unit, integration, RLS/security, and end-to-end tests for all critical flows.
- [ ] Document how to bootstrap the first platform owner securely without hardcoded client-side credentials.

## Implementation sequence

1. [ ] Inspect current production branch and repository history for the previous administration console, routes, schema, and UI components. Reuse proven patterns without restoring deleted/demo-only behavior blindly.
2. [ ] Map current schema, migrations, RLS policies, auth roles, business/subscription/category/transaction/commission/claim entities; identify gaps before designing new schema.
3. [ ] Write a data model and API/RPC contract; define commission stacking, deletion/retention, ownerless business, and subscription transition rules.
4. [ ] Add the admin navigation and dashboard shell with real data and explicit loading/empty/error states.
5. [ ] Implement business and category management, then subscription controls and permission/audit enforcement.
6. [ ] Implement commission rules, immutable financial ledger, claims/statements, reconciliation, and reports.
7. [ ] Add migrations as new forward-only files after review. Do not apply to production before backup/restore evidence, staging/isolated replay, RLS review, and explicit release approval.
8. [ ] Add tests, run security/performance advisors, verify least-privilege/RLS and all roles.
9. [ ] Pass production gate and smoke tests; release through one gated workflow only.

## Session continuation protocol

At the start of every continuation:
1. Read this TODO and the production release runbook.
2. Inspect current Git branch/commit and PR/check status; do not assume the prior session completed work.
3. Identify the highest-priority safe next action and report blockers only when action truly requires user approval or unavailable credentials.
4. After each change, record commit/PR, checks, evidence, risks, rollback, and next step here.
5. If work stops, leave a precise `NEXT ACTION` below.

## NEXT ACTION

1. Inspect the current repository tree/history for the prior production administration console and the existing schema/role/commission/subscription model.
2. Record findings and gaps here before implementation.
3. Keep PR #411 draft and production deployment blocked until the release safety gates are satisfied.

## Reconnaissance findings — 2026-10-27

- Existing catalog admin UI is present at `apps/catalog-frontend/src/components/admin/AdminDashboard.tsx` with tabs for billing, taxonomy, businesses, subscribers, settings, backup, and control center. This is a useful starting point, but it is not yet evidence of the requested complete platform-wide administration console.
- The current catalog admin dashboard stores a single default commission input (`defaultCommissionPerOrder`) and existing Paymob fee configuration. The requested multi-rule commission engine, immutable transaction-level rule snapshots, claims, statements, and reconciliation still need a dedicated audit/implementation.
- `apps/catalog-frontend/src/context/AppContext.tsx` calls production backend functions for business creation and profile/catalog updates; subscriber deactivation is currently represented as membership status `INACTIVE`. Audit each action and ensure business status/delete/ownerless workflows exist before relying on them.
- `supabase/functions/catalog-platform-admin/index.ts` contains `CREATE_BUSINESS`, `SUBSCRIBER_STATUS`, and `SAVE_SETTINGS` actions. The inspected snippets do not establish a complete business suspend/delete/update lifecycle or a complete subscription-management API; verify all handlers and authorization paths before UI work.
- `SuperAdminControlCenter.tsx` uses guarded RPCs for custom roles, people, assignments, and audit records. Its own error message says it depends on RC115 being deployed; do not assume those migrations are live in production.
- The app's current `AdminDashboard` tab set does not include a traffic/visits analytics tab. Repository searches did not find a clearly wired production visits analytics endpoint, so define the metric source and add it without hardcoded or demo data.
- Existing migration history includes docs for RC113–RC115 and later admin-scope hardening in source control. The production migration ledger previously observed did not show RC113–RC117. Do not apply these directly; reconcile exact migration names, dependencies, live schema, and authorization model first.

### Immediate next action (updated)
1. Inspect the complete `catalog-platform-admin` action dispatcher and its authorization guard, then map every admin action to an existing backend contract.
2. Inspect production business/subscription/commission/claims/ledger tables and relevant RPCs read-only; compare with migration ledger and RLS.
3. Produce a gap matrix (existing / partial / missing / not production-verified) and only then implement the smallest safe slice on the fix branch.
4. Do not deploy or mutate production DB while backup/restore and release gates remain unverified.

- **Confirmed action-dispatcher gap:** `catalog-platform-admin/index.ts` currently exposes only `TENANT_LIST`, `GET_SETTINGS`, `SAVE_SETTINGS`, `LIST_SUBSCRIBERS`, `CREATE_BUSINESS`, `CREATE_SUBSCRIBER`, `SUBSCRIBER_STATUS`, `BUSINESS_SETTINGS_UPDATE`, and `DEACTIVATE_BUSINESS`. Source inspection found no corresponding action for permanent business deletion, a complete activate/suspend/restore lifecycle, flexible commission rules, commission claims, or visits analytics in this function. Treat these as missing from this API surface until another verified backend contract is found.

### Read-only production schema and permission findings — 2026-10-27

- Live schema contains `businesses`, `business_subscriptions`, `commission_rules`, `commission_transactions`, `general_ledger`, `payment_events`, `payment_intents`, `payment_financial_reconciliations`, `audit_logs`, `business_categories`, and `user_memberships`.
- Live functions include `create_commission_backend`, `preview_commission_backend`, `resolve_commission_rule_backend`, `record_cash_commission_due`, `deactivate_business`, `append_audit_log_backend`, and `mnty_can_platform_admin`. Reuse/verify these contracts before adding duplicates.
- Live `commission_rules` schema currently includes tenant, optional business/module scope, rule type, percentage, fixed amount, per-item amount, active flag, and timestamps. It does not, in the inspected columns, expose effective dates, explicit priority/stacking behavior, or immutable rule snapshots on `commission_transactions`.
- Live `commission_transactions` currently includes business/order/rule IDs, gross amount, commission amount, status, and timestamp. Need verify idempotency constraints and existing journal integration before extending.
- Live `business_subscriptions` includes tier, billing cycle, status, start/end, provider references, payment intent, idempotency key, creator, and timestamps. This is a canonical source to build on; subscription changes need to preserve payment history.
- The inspected high-impact tables have RLS enabled and forced. Current policies are primarily tenant/business-scoped: `business_subscriptions` has owner-scoped SELECT; `commission_rules` permits tenant OWNER/ADMIN/MANAGER operations; `commission_transactions` has finance-role read scope; `businesses` has tenant-manager policies plus a narrow public showcase read. A platform-wide admin UI must call server-side guarded contracts; do not bypass RLS with direct browser writes or grant broad client access.
- Live routines query found no obvious routine named for commission claims, invoice/claim history, or traffic/visit analytics. That does not prove no alternative reporting source exists; inspect order, page-view, access-log, billing, and ledger sources before designing new tables.
- The read-only production inspection made no database changes. No production migration was applied.

### Next safe implementation slice
- [ ] Map exact source and destination fields for platform admin business/subscription/commission operations and verify the full bodies of the existing SECURITY DEFINER routines, including grants, actor checks, search_path, idempotency, and audit behavior.
- [ ] Inspect `catalog-platform-admin` full handler guard and current deployed Edge Function version/configuration; compare with repository source.
- [ ] Define new platform-admin-only server contracts for missing operations, with reason-required state transitions and audit events. Do not expose service-role operations to the browser.
- [ ] Implement the dashboard shell only after choosing verified real metrics; display unavailable metrics as unavailable, never as zeros/fake values.

- The live Supabase Edge Function `catalog-platform-admin` was inspected read-only: it is ACTIVE at version 2 with `verify_jwt=true`. Its deployed dispatcher confirms the same limited actions listed above. The handler validates a non-anonymous Supabase identity and requires an active `SUPER_ADMIN` membership with `scope=PLATFORM` and `full_control=true` before platform actions.
- The deployed handler's current `CREATE_BUSINESS` creates an ACTIVE business with no owner, creates a main branch and provider profile, and uses compensating deletes if those dependent inserts fail. This is an existing ownerless-business foundation, but it needs explicit claim/assignment, status transitions, full edit coverage, reasoned audit trail, and tests before being treated as the complete requested workflow.
- Current `SUBSCRIBER_STATUS` supports `ACTIVE`, `INACTIVE`, and `SUSPENDED` for OWNER/BUSINESS_OWNER memberships, but it is not a complete plan/billing subscription management contract and currently returns no detailed change audit in that handler.
- Current `DEACTIVATE_BUSINESS` changes status to `INACTIVE` and disables public catalog exposure; there is no paired activate/restore action in the inspected dispatcher, nor an admin deletion action.
- Security note: platform-wide administrative operations must remain behind the platform authority check. Do not reuse tenant-scoped RLS policies as proof of global admin access, and do not send the service-role key to the client.

## 2026-10-27 — Activity taxonomy request
- [x] Recorded the user request: provide a full list of activity names where every activity is independent and selectable, e.g. restaurant, doctor specialties, and other service professions.
- [x] Added proposal: [`docs/product/ACTIVITY_TAXONOMY_PROPOSAL_AR.md`](docs/product/ACTIVITY_TAXONOMY_PROPOSAL_AR.md), with 18 top-level categories and separately coded activity names.
- [ ] Review the proposal with the platform owner; refine names, merge duplicates/aliases, and approve the taxonomy.
- [ ] Map the existing 27 active `business_categories` records to the approved activities without losing current business/category links.
- [ ] Define compatibility for `business_sectors`, modules, business registration, search, subscriptions, and commission scope.
- [ ] Implement via a new reviewed migration and admin CRUD interface on the fix branch; preserve prior values and create a rollback/forward-fix plan.
- [ ] Test category CRUD, search/autocomplete, new/existing business registration, permissions/RLS, subscriptions, and commission calculations.
- [ ] Do not change production taxonomy until migration reconciliation, backup/PITR, and restore rehearsal gates are evidenced.
