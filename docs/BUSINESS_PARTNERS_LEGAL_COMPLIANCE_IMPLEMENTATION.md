# MNTX-BP-001 — Business Partners & Legal-Compliance Implementation

**Status:** IN PROGRESS  
**Priority:** P0 commercial model and tenant security; staged P1 feature delivery  
**Started:** 2026-11-24  
**Implementation branch:** `feat/business-partners-legal-compliance-20261124`  
**Master request:** GitHub issue #599  
**Scope owner:** MantiqatiX platform

## 1. Authoritative commercial boundary

MantiqatiX operates as a marketing, advertising, discovery and commercial-referral platform. It is not the product seller, reseller, merchant of record or custodian of partner product proceeds in the current operating model.

- The partner owns the product and is the seller to the customer.
- The partner receives product consideration directly from the customer.
- The partner issues the product invoice and is responsible for fulfillment, delivery, warranty, returns, product quality and customer product obligations.
- MantiqatiX records only its own subscription, commission/referral-service, advertising and marketing-service revenue.
- Partner product GMV may appear only as a clearly labelled informational metric; it is not platform revenue, cash received, a platform payable or a settlement amount.
- No product payment intent, platform wallet credit, product-sale invoice or product-proceeds settlement may be created by this workstream.
- Any future change to this boundary requires separate legal, tax, accounting, payment-provider and product approval.

## 2. Repository reconnaissance — verified on 2026-11-24

Base: `main` at `80cd991f6d591c42f77f58531de995d4e1ef2f3f`.

Existing components to reuse and extend:

- `public.businesses` and `public.user_memberships`: canonical business and membership identity/scope. Do not create duplicate company, tenant, user or membership roots.
- `BusinessSubscriberAdmin.tsx` and `mnty_platform_admin_list_businesses` / `mnty_platform_admin_manage_business`: existing Super Admin business and membership administration.
- `MerchantDashboard.tsx`, `BusinessEmployeeManager.tsx`, `CatalogImportPanel.tsx`: existing merchant workspace, employee management and catalog import.
- `public.commission_rules`, `commission_rule_audit`, `mnty_commission_rule_drafts`, commission preview/resolution RPCs: configurable commission rule drafts and previews already exist. RC467 hardens commission rule administration to platform admin.
- `settlement_transactions`, journal entries and `settlement-financial-atomic`: existing finance infrastructure is scoped and security sensitive. It must not be repurposed to settle product proceeds.
- `referral_codes` and `referral_events`: existing personal account invitation/referral system. It is not a company-product referral attribution ledger and must not be overloaded.
- `digital_page_products` / `digital_page_orders`: these are MantiqatiX digital services, not partner-owned marketplace inventory.
- `BusinessProfileHeader.tsx` and `CatalogSection.tsx`: existing public business and catalog presentation. Extend to disclose seller identity and partner terms using verified business data.

Known release constraint: current repository release notes say Production is BLOCKED / NOT CERTIFIED pending physical migration reconciliation, coordinated database/Edge release, and actual encrypted backup/restore evidence. All new migrations and Edge changes remain source-only until those gates are satisfied. No Production writes were made for this request.

## 3. Target domain model (reuse-first)

### Canonical identity
- Company/partner identity references `businesses.id` and `businesses.tenant_id`.
- Human access references `auth.users` and `user_memberships`; no second identity system.
- All child records carry tenant and business scope, with composite consistency checks/FKs where supported.
- Partner employee authority is bounded by the existing membership/employee permission model.

### New records to add only after schema preflight confirms absence
1. Partner legal profile / verification state, linked 1:1 to canonical business.
2. Partner legal documents, private storage references, checksums, uploader, review state and retention metadata.
3. Partner agreements and immutable agreement versions, agreement type, effective dates, renewal policy, legal review status and signature evidence metadata.
4. Partner referral attribution records, unique referral IDs, campaign/product/business references, minimized customer reference, event timestamps and immutable status history.
5. Contract-versioned commission terms and accrual/adjustment ledger, reusing existing commission rule engine where compatible.
6. Platform-service invoice/charge records for subscription, advertising, marketing and fixed referral fees only.
7. Partner statement snapshots and two-party acknowledgement events; product GMV remains informational and excluded from platform balance.
8. Compliance events: access audit, complaints, privacy requests, retention actions and incident references.

Names and final column contracts must be reconciled against the actual schema before migration creation. Do not blindly create a second catalog, orders, company, contracts or accounting subsystem if a compatible canonical object already exists.

## 4. State machines and hard gates

### Partner lifecycle
`DRAFT → PENDING_REVIEW → APPROVED → ACTIVE`; alternate terminal/paused states: `SUSPENDED`, `REJECTED`, `EXPIRED`.

A partner cannot publish partner-owned products unless:
- legal profile required fields are complete;
- required documents are reviewed and approved;
- required agreement is active and signature requirements are met;
- partner is not suspended/expired;
- catalog owner and seller identity resolve to the same canonical business.

### Agreement lifecycle
Draft → Legal Review → Partner Review → Signed/Accepted (according to legally approved method) → Active → Expiring/Expired/Terminated. Keep immutable versions and signature evidence. In-app acceptance is not described as a substitute for legally required signatures.

### Referral/order lifecycle
`REFERRED, ACCEPTED, REJECTED, CONFIRMED, DELIVERED, COMPLETED, CANCELLED, RETURNED, DISPUTED`.
Every transition is authenticated, business-scoped, time-stamped and audited. Customer data shared with a partner is limited to what is necessary for the referral/fulfillment and lawful basis.

### Commission eligibility
A commission is accrued only against the approved agreement/rule version and its specified eligibility event. The calculation basis must explicitly state treatment of discounts, shipping, taxes, returns, cancellations and partial fulfillment. Cancelled/returned orders reverse or do not accrue unless the signed applicable agreement explicitly provides otherwise. Rule changes never retroactively rewrite prior accruals.

### Financial separation
Platform revenue categories: subscription, commission/referral services, advertising, marketing services and fixed referral fees.
Partner product GMV: analytics-only indicator, never platform revenue or a platform-held liability.
Partner statements show service fees/commission due to MantiqatiX and amounts collected/outstanding; do not imply MantiqatiX collected customer product money.
Tax rates and withholding rules are configurable effective-dated accounting settings, never hard-coded assumptions. No official invoice/tax document is generated without approved legal entity, tax configuration and accountant sign-off.

## 5. Implementation phases and acceptance criteria

### Phase 0 — source/schema contract and request registration
- [x] Register MNTX-BP-001 in master issue #599.
- [x] Create a dedicated cross-session implementation record.
- [x] Confirm canonical business, membership, merchant, commission, personal-referral and settlement components to reuse.
- [ ] Complete exhaustive schema/RPC/Edge/RLS mapping and duplicate-object preflight.

### Phase 1 — partner legal profile, verification and contracts
- [ ] Add additive, reversible migrations only after schema preflight.
- [ ] Add private document handling with strict owner/admin access and no public document URLs.
- [ ] Add partner verification and publication hard gate through trusted server-side actions.
- [ ] Add contract templates, version history, approval/signature evidence, renewal and expiry alerts.
- [ ] Add Super Admin legal review UI and partner company workspace.
- [ ] Tests: state transition matrix, missing-document block, expired-contract block, cross-business denial, audit immutability.

### Phase 2 — partner catalog seller identity and referral attribution
- [ ] Extend existing product/catalog records, do not create a parallel product catalog.
- [ ] Display partner seller name/contact/terms/delivery/warranty/returns on product detail.
- [ ] Add unique partner referral ID and campaign attribution.
- [ ] Reuse or extend existing order model only after confirming the current product order path does not collect platform product payments.
- [ ] Add immutable order/referral event history and partner-scoped status transitions.
- [ ] Tests: ownership, direct partner contact/order handoff, unique attribution, customer data minimization, status permissions.

### Phase 3 — commission, service fees and statements
- [ ] Bind commission rule versions to active signed agreements and explicit basis/eligibility.
- [ ] Add accrual, approval, invoice reference, payment, dispute and reversal lifecycle.
- [ ] Add subscription/advertising/marketing/fixed-referral service charges.
- [ ] Generate statements with partner product GMV explicitly informational and excluded from platform balances.
- [ ] No product-money checkout, wallet, platform collection or product proceeds settlement.
- [ ] Tests: completion eligibility, cancellation/return reversal, discount/shipping/tax basis, replay/idempotency and arithmetic reconciliation.

### Phase 4 — Super Admin and partner dashboards
- [ ] Super Admin partner/legal/contract/commission/compliance overview with real persisted data.
- [ ] Partner workspace: profile, documents, products, referrals, order status, service fees, statements, contracts and renewal requests.
- [ ] Enforce all access in RPC/Edge/RLS; UI visibility is not authorization.
- [ ] Tests for all roles and cross-tenant/business/branch isolation.

### Phase 5 — privacy, accounting and tax controls
- [ ] Privacy notice, platform terms, partner terms, cookie notice where applicable, DPA, complaints, retention and incident workflow.
- [ ] Data-subject request intake, identity verification, legal hold and deletion/anonymization workflow.
- [ ] Accounting center for platform service revenue only, expenses, fee invoices, bank reconciliation and approved withholding records.
- [ ] Effective-dated tax settings with accountant/legal approval; no tax rate defaults represented as legal advice.
- [ ] Review current Egyptian legal requirements with qualified counsel/accountant before enabling regulated processing or issuing tax documents.

### Phase 6 — integrated release
- [ ] Test partner onboarding, verification, agreement activation and publication gate.
- [ ] Test partner product listing and seller disclosure.
- [ ] Test referral/order lifecycle and status history.
- [ ] Test commission eligibility, cancellation, return and reversal.
- [ ] Test statement arithmetic and prove product proceeds never enter platform ledgers/payment flows.
- [ ] Test cross-tenant data isolation, RBAC, audit logs, privacy controls and restore.
- [ ] Release only through coordinated, approved database/Edge/UI deployment and production read-back.

## 6. Required roles

Platform roles: `SUPER_ADMIN`, `LEGAL_MANAGER`, `FINANCIAL_MANAGER`, `PARTNER_MANAGER`, `CUSTOMER_SUPPORT`.
Partner roles: `COMPANY_OWNER`, `COMPANY_EMPLOYEE`.

Map to existing role/membership infrastructure where possible. Do not grant platform-wide authority by trusting client-supplied role strings. Financial approvals and contract changes require server-side permission checks and audit records. A partner employee cannot edit approved commission terms or contract versions.

## 7. Cross-session continuation protocol

This workstream is persistent and must be resumed in every MantiqatiX continuation:
1. Read issue #599, this document, `docs/CROSS_SESSION_TODO_PROTOCOL.md`, `docs/PROJECT_CONTINUITY.md` and the current master TODO.
2. Read current main, active PRs, exact-head CI, migration ledger and deployment state.
3. Resume the first unfinished dependency-ordered checkbox in this document.
4. Keep status IN PROGRESS/BLOCKED/NOT VERIFIED until evidence supports completion.
5. Do not repeat completed work; append evidence and update the same task.
6. If a future session lacks repository access, do not claim automatic GitHub changes; reconnect before modifying the ledger.

## 8. Current status

- Request registered in issue #599.
- Feature branch created from current main.
- Repository reconnaissance completed for the canonical business/membership, merchant, commission, personal referral and settlement foundations.
- No application code, production schema, RLS, Auth, Edge deployment, payment or financial data has been changed by this request yet.
- Phase 0 is partially complete; overall feature is **NOT IMPLEMENTED / NOT VERIFIED**.
- Next action: complete schema/RPC/Edge/RLS dependency mapping, then implement Phase 1 as a compatibility-safe, tested migration + server action + UI stack.


## 9. Additional repository findings — legal and partner module inventory

Further source inspection after the initial reconnaissance found:

- The platform already has a Legal Center/CMS/Consent/Gate Edge family: `legal-center`, `legal-cms`, `legal-consent`, and `legal-gate`. These currently serve published legal documents, user consent records, required-consent gates and platform-admin-only Legal CMS actions.
- Existing Legal Center consent captures `agreement_id`, but the reviewed Edge contracts do not establish a company-partner agreement lifecycle with per-company contract terms, counterpart signatures, versioned commercial clauses or expiry/renewal management. Reuse the legal document/version and audit infrastructure for templates/policies; extend the agreement contract only after reading its authoritative schema and lifecycle RPCs.
- RC481–RC483 show that legal Edge access is intentionally narrow: column-scoped service-role grants and SECURITY DEFINER RPCs are used. New partner legal operations must follow this pattern, not broaden table-wide grants.
- The unified module catalog lists a `PARTNERS` sector with `success_partners` and `referred_businesses` as expected data bindings, but the current module runtime contract maps PARTNERS to the generic app surface. Code search did not locate authoritative table-creation migrations for those two names. Treat these as unverified/non-canonical until the live schema inventory proves otherwise; do not query or create them based only on catalog metadata.
- The database already references `public.business_referral_events` and `public.agreements` in guarded business-deactivation logic. This proves those object names are referenced by current SQL, but not their complete columns, constraints, policies, triggers, grants or suitability for partner-product referral and signed commercial contracts. Full schema inspection is mandatory before reuse.
- `provider_onboarding_requests` exists as a separate onboarding workflow tied to registration requests and canonical tenant/business identity. Evaluate whether its verified identity/document steps can be extended for partner onboarding; do not treat provider approval as partner commercial-contract approval.
- Existing personal `referral_codes/referral_events` must remain distinct from company/product attribution. Existing `orders` and payment-intent workflows are payment-enabled in some sectors, so partner referral orders must use an explicit direct-to-partner handoff and must not invoke platform payment-intent creation for product proceeds.

This inventory changes the implementation sequence: finish a read-only, column-level live schema/RPC/Edge/ACL inventory of `agreements`, `business_referral_events`, `provider_onboarding_requests`, catalog ownership and order/payment contracts before selecting exact extension points. No schema changes are safe until this inventory is complete.


## 10. Read-only Production schema and authorization findings — 2026-11-24

Target inspected: Supabase project `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`), PostgreSQL 17.6.1.155. Queries were SELECT-only. No production writes were performed.

### Confirmed reusable structures
- `agreements`: `id, tenant_id, agreement_type, document_id, document_version_id, business_id, status, effective_at, created_by, created_at, metadata`. Status constraint: PENDING / ACTIVE / SUSPENDED / EXPIRED / TERMINATED. It links to legal document/version and canonical business/tenant.
- `agreement_participants`: `agreement_id, user_id, account_type, participant_role, status, joined_at, left_at, metadata`; statuses PENDING / ACTIVE / DECLINED / SUSPENDED / TERMINATED. FK to agreements and auth.users.
- `business_referral_codes` and `business_referral_events`: existing business-owned referral code and event records. Event types are SCAN / VISIT / SIGNUP / LEAD / ORDER. These do not yet provide the requested order state machine, product/campaign attribution, order reference, commission eligibility snapshot or immutable per-order status lifecycle.
- `catalog_items`: canonical tenant/business/branch-owned product/service inventory with `item_type, name_ar, description, status, tax_rate, metadata`; prices live in `catalog_item_prices`. Do not create a parallel catalog.
- `orders`: canonical business/tenant/branch order with customer contact/address, items JSON, subtotal, discount, tax, delivery fee, total, payment/pricing binding and assigned partner. Existing status workflow is narrower than requested partner referral workflow.
- `commission_transactions`: currently keyed to tenant/business/order and commission rule, with gross amount, commission amount and status. It is not yet proven to contain the full signed-contract basis snapshot, fee categories, invoice/paid/disputed/reversed lifecycle and tax treatment required by this request.
- `commission_rules`: already has draft/approval/version/effective-window/eligibility-event fields and preview/resolution RPCs. Reuse only after validating the live rule engine and binding it to an immutable agreement version.
- Legal Center tables and Edge functions already support legal document/version publication, consent and admin controls. They do not by themselves prove counterpart signature capture or partner-specific commercial terms.

### Confirmed authorization findings
- `agreements` and `agreement_participants` have RLS enabled and FORCE RLS enabled; anon SELECT is false. Their current policies include admin writes and participant reads.
- **Critical existing policy defect:** the `agreements_participant_read` policy tests `agreement_participants.agreement_id = agreement_participants.id` rather than matching `agreement_participants.agreement_id = agreements.id`. This prevents the intended participant membership check from matching the parent agreement. A participant may therefore be unable to read their own agreement. Fix requires a dedicated, reviewed migration and regression fixture/integration test; do not edit Production directly.
- `business_referral_codes` and `business_referral_events` have RLS + FORCE RLS and no direct anon/authenticated table privileges; access is through RPCs. Member-read policies are scoped by active business membership.
- `catalog_items` and `catalog_item_prices` have RLS + FORCE RLS and no direct anon/authenticated table privileges; server-side catalog APIs remain the intended write/read boundary.
- `orders` has RLS + FORCE RLS, no anon SELECT, no direct authenticated INSERT/UPDATE table privileges, and business/tenant-scoped read policies. Order writes/status changes use trusted server-side functions.
- `commission_transactions` has RLS + FORCE RLS, no direct authenticated writes, and finance-role tenant read policy.
- Existing SECURITY DEFINER functions found include `track_business_referral_event`, `get_or_create_business_referral_profile`, `update_order_status_backend`, commission creation/resolution and Legal Gate triggers. Some legacy definitions use `search_path=public`; any new/modified privileged routine must use the current project's approved hardened pattern and exact grants, not copy older implementations.

### Production row counts observed
- `agreements`: 0 rows.
- `agreement_participants`: 0 rows.
- `business_referral_events`: 0 rows.
These counts do not prove the absence of historical records in other stores or branches; they are the exact counts observed in this read-only check.

### Updated next actions
1. Add a focused security fix for the agreement participant read policy with a fixture and live-contract validator; keep it source-only until release gates permit.
2. Complete schema/ACL inspection of `business_referral_codes`, legal gate requirements, catalog public projections and all payment-intent creation paths.
3. Design partner legal-profile fields and evidence storage around the verified canonical business ID and existing Legal Center, without reusing consent as a substitute for signatures.
4. Implement partner lifecycle and publication gate before product attribution.
5. Keep the order/referral workflow as a direct-to-partner handoff; never call product payment-intent creation or platform settlement for partner goods.
