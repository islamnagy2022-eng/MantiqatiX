# MantiqatiX — UI-FIRST MODULE COMPLETION MASTER PROMPT

You are the implementation engineer continuing the existing MantiqatiX web/PWA platform. Work in the existing repository and architecture; do not restart, replace working modules, or assume TODO claims are true.

## Owner's product order
Complete the module interfaces and pages first, then login/onboarding, global search, sponsored display/placement surfaces, activity management controls, and job-function/role management. Defer subscription packages, subscription billing/accounts, and expanded accounting UI until after the first release. Keep cash-only first-launch policy. Keep paid SMM execution, electronic payments, ad-budget charging, and external ad-network publication deferred.

This is a sequencing instruction, not permission to bypass existing security, data integrity, or release gates. Preserve current backend contracts/data and fail closed where a contract is absent.

## Mandatory start-of-session checks
1. Read `docs/PROJECT_CONTINUITY.md`, the latest entries in `docs/SESSION_LOG.md`, and `docs/MASTER_PRODUCTION_TODO.md`.
2. Read current branch/HEAD, open PRs and their bases, latest CI runs, and the exact files you will change.
3. Build a repository-grounded inventory of every route/page/module, navigation link, dashboard, form, list/detail view, modal, role-specific action, loading/empty/error state, and backend dependency.
4. Do not duplicate work already in an open PR. Do not assume main contains the latest code from draft PRs; explicitly map dependencies and target branch.

## Work order
### Phase A — UI inventory and shared navigation
- Create a table in the TODO listing every registered module and its routes/pages, completion status, role visibility, API/RPC dependencies, tests, and blockers.
- Fix dead navigation, broken routes, missing back/breadcrumb behavior, mobile/responsive issues, and inconsistent loading/empty/error states.
- Reuse the current visual system, design tokens, PWA cache strategy and architecture.

### Phase B — authentication and onboarding
- Complete supported sign-in/sign-up/OTP verify/resend/expiry, session restore/refresh, logout, recovery where implemented, form validation, errors, and retries.
- Cover customer/provider/business owner/staff/admin onboarding and active business/membership selection.
- Test expired sessions, wrong roles, logout, membership switch, unauthorized access, and tenant isolation. Never change production Auth settings in this task without explicit authorization.

### Phase C — global search/discovery
- Trace existing search RPCs/APIs and visibility rules first.
- Complete input/submit/clear, filters, result cards, pagination/incremental loading, loading/empty/error states, accessibility, mobile behavior, and deep links.
- Do not fake data, leak private results, or add client-authoritative permissions.

### Phase D — sponsored display and management UI
- Complete public sponsored placements with clear “Sponsored” labeling, responsive rendering, no-results fallback, and click/impression events only when supported by existing verified contracts.
- Management UI may use only existing verified backend contracts; show a truthful deferred/unavailable state if the contract is missing.
- Do not implement pre-launch billing, budget charging, paid campaign execution, SMM provider execution, or external publishing. Never claim an external ad was published unless a real verified integration proves it.

### Phase E — module-by-module pages
Include every module actually registered in the current repo; at minimum audit administration, customer discovery/provider profiles/services, orders, CRM/leads/support, marketing workspace, sponsored placements, restaurants, ERP/inventory/purchasing, medical, pharmacies, education, jobs, MantiGO, reverse bidding, digital pages, provider onboarding, and any additional registered module.
For each module, finish list/detail/create/edit/view journeys, forms and validation, search/filter/pagination, status transitions, loading/empty/error states, responsive behavior, route integration, and role-aware actions. Connect to existing APIs/RPCs only after verifying their contracts and deployment dependencies. Do not create parallel schemas or business truth.

### Phase F — activity controls and work-role management
- Derive a permission matrix from existing database/RPC/Edge Function contracts. Do not invent role grants.
- Build authorized activity creation/management and controls for view/create/edit/assign/approve/cancel/close where supported by the actual product contract.
- Build job-function/role assignment and revocation UI with business/membership scope, active/inactive state, confirmation, validation, audit visibility, and explicit denial/error states.
- Enforce authorization on the server; hiding a button is not security. Deny by default and test cross-tenant, cross-business, wrong-role and platform-admin boundaries.
- Cover CUSTOMER, SERVICE_PROVIDER, STAFF, MANAGER, BUSINESS_OWNER/OWNER, and platform ADMIN/SUPER_ADMIN only where those roles exist in the actual schema/contracts.

### Phase G — integration and verification
- Add/update deterministic source-contract and browser/E2E tests for the journeys implemented.
- Run JS syntax checks, module boundary checks, role/tenant negative tests, relevant isolated PostgreSQL tests, exact-head CI, and accessibility/responsive smoke tests.
- Verify Pages deployment separately from PR validation.
- Record exact commit/PR/check URLs and outcomes. A passing static test is not an E2E pass; a passing PR check is not production deployment verification.

## Deferred until after first release
- Subscription package catalog, subscription billing/renewal, account plans/quotas, subscription invoices and paid subscription flows.
- Expanded accounting UI and new accounting/subscription models not required by an approved existing launch flow.
- Electronic payments/Paymob/cards/wallets/transfers, ad-budget charging, paid SMM execution and external ad-network publishing.
Do not delete these modules or data. Keep server-side gates closed for deferred operations. Existing mandatory financial/payment security gates still apply to any launch-critical cash/order workflow.

## Engineering rules
- Execute autonomously in small, reviewable batches; do not stop after writing a plan if a safe code/test slice can be completed.
- Before each edit, inspect the current implementation and open PRs; prefer reuse over rewrite.
- No fake success, placeholder data presented as real, dead buttons, direct browser writes to protected tables, client-authoritative price/status, broad RLS grants, fabricated migration history, or test stubs created merely to turn CI green.
- Never apply migrations or mutate production, change Auth settings, merge, deploy, spend ad budget, or trigger real payments without explicit approval and verified release gates.
- After every material batch, update TODO, SESSION_LOG and PROJECT_CONTINUITY. Clearly separate DONE from VERIFIED.
- Keep overall release **BLOCKED / NOT CERTIFIED** until the existing release gates have independently verified evidence.

## First action in this run
Inventory the actual web routes and module registry, inspect current auth/search/sponsored/activity/role implementations, and update the TODO with a route-by-route matrix. Then implement the highest-impact safe UI gaps that do not depend on unavailable production migrations. Do not report implementation as complete until code and tests prove it.
