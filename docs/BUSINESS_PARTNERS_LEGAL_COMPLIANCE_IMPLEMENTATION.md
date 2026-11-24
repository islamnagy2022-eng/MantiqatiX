# MNTX-BP-001 — Business Partners & Legal-Compliance Implementation

**Status:** IN PROGRESS  
**Priority:** P0 commercial model and tenant security; staged P1 feature delivery  
**Started:** 2026-11-24  
**Implementation branch:** `feat/mntx-bp001-rc924-ordered-rc482-20261124`  
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


## 11. RC924 agreement participant read-scope repair — source added, CI pending

On 2026-11-24, added an isolated forward migration and PostgreSQL 17 adversarial test suite on the feature branch:

- Migration: `supabase/migrations/20261124140000_rc924_agreement_participant_read_scope.sql`.
- Fixture: `supabase/tests/rc924_agreement_participant_read_scope_fixture.sql`.
- Integration assertions: `supabase/tests/rc924_agreement_participant_read_scope_integration.sql`.
- Static contract validator: `scripts/validate-rc924-agreement-participant-read-scope.mjs`.
- Workflow: `.github/workflows/rc924-agreement-participant-read-scope.yml`.

The replacement policy correlates `agreement_participants.agreement_id` to `agreements.id`, requires the authenticated non-anonymous actor, preserves the protected platform-admin check, and permits a participant to read their own agreement. No role grants, table definitions, row data or other policies are changed by the migration.

Fixture cases cover two independent partner users, an unrelated authenticated user, an anonymous-authenticated JWT, and the protected platform-admin registry actor. The fixture reproduces the old predicate before applying RC924.

**Status:** source added; static and PostgreSQL 17 CI results are not yet confirmed. Do not mark the fix accepted or apply it to Production until the workflow passes and the full forward migration replay is green. No Production DDL/DML/RLS/GRANT was performed.


## 12. Catalog seller disclosure and payment handoff audit — 2026-11-24 (read-only)

### Current public catalog behavior
- `public-catalog` and `public-catalog-directory` read canonical `businesses`, `marketing_provider_profiles`, `catalog_items` and `catalog_item_prices`.
- Public product projection returns item identifiers, branch, type, names, descriptions, category/unit, public image/availability, quote flag and opted-in public prices. It does not currently return a verified legal seller identity, legal name, commercial registration/tax identity, or a partner-specific seller contract/terms block.
- Existing provider `is_verified` is an activity/provider profile flag; it is not proof that the partner company's legal identity, documents or commercial agreement have been reviewed. Do not treat it as partner legal verification.
- Public catalog responses explicitly set `paymentsEnabled: false` and use `PUBLIC_READ_ONLY` access. The current React storefront adds priced items to a local cart and `submitOrderViaWhatsApp` constructs a WhatsApp order URL using the current business owner's WhatsApp number. Quote-only products also open a direct WhatsApp quote link. This is the current direct-to-business handoff and does not route customer product funds through MantiqatiX.
- Seller identity can be based on the canonical business attached to the product, but public display must distinguish the business's trading/display name from legally verified seller identity. Legal identifiers and private documents must never be exposed through public catalog projections.

### Separate payment-capable path — must be excluded for partner referrals
- The independent `order-create` Edge function validates the user, business membership, catalog items and authoritative prices, then calls `create_order_backend` and persists an order with calculated product total.
- The separate `payment-intent` Edge function loads a pending/created order and calls `create_payment_intent_backend`, then creates a Paymob intention for the order total. Production metadata confirms both RPCs exist; service_role EXECUTE is enabled, and authenticated EXECUTE is enabled on `create_payment_intent_backend`.
- These payment-capable endpoints are not invoked by the current public storefront's WhatsApp path, but they are an available separate order/payment workflow. Partner products must not be routed into this path. The future partner referral flow should write a dedicated referral/order-handoff event and send the customer directly to partner-owned contact/checkout channels; it must not create a platform-payable `orders` row, payment intent, wallet credit or settlement for product proceeds.
- Any later API-level hardening must explicitly mark partner mode from trusted server-side partner profile data and reject payment-intent creation for those partner product orders; do not rely on client-supplied metadata or a UI-only flag.

### Design consequences
1. Partner legal verification requires a dedicated company-level legal profile and evidence lifecycle; existing provider `is_verified` is not a substitute.
2. Seller disclosure should extend `public-catalog` and `public-catalog-directory` with a minimized, explicitly public seller block derived from an approved partner profile. Keep legal registry/tax IDs, bank data and uploaded documents private.
3. Product ownership must be validated server-side: `catalog_items.business_id` must equal the approved partner business ID, and the referral record must snapshot that owner.
4. Partner referral order state is a separate lifecycle and should not be conflated with the existing payment-enabled order workflow.
5. Add regression tests proving partner referral flow never invokes `order-create`, `payment-intent`, Paymob, wallet or settlement APIs.

**Safety:** source and metadata inspection only; no API was invoked for real orders, no payments were initiated, and no Production object or row was changed.


### Partner onboarding and document storage preflight
- `provider_onboarding_requests` is an existing workflow, but its verified columns are provider/business name, user/tenant/organization IDs, provider kind, description, specialties, service areas, portfolio, profile image path, status and review metadata. It has no legal registration/tax identifiers, authorized signatory, contract terms or legal document evidence columns. Reuse it only for initial provider onboarding context; add a separate legal partner profile linked to the canonical business.
- Production Storage buckets observed: `mantiqatix-media` is private but limited to JPEG/PNG/WebP and 5 MB; `mantiqatix-profile-media` is public and allows SVG. Neither is appropriate for legal contracts, commercial-register extracts, tax cards or bank documents. Do not place legal evidence in the public profile bucket or broaden public access. Phase 1 needs a dedicated private legal-document bucket with PDF/image allowlist, strict per-business object path authorization, short-lived signed reads, checksum/size validation and audit events.
- Current `businesses` table has canonical `id, tenant_id, organization_id, name, code, status, settings`; no first-class legal company identity columns. Keep sensitive legal data out of public `settings` JSON and create a dedicated business-scoped legal profile table with RLS/FORCE RLS and trusted server-side access.


### RC924 CI correction record
- First RC924 workflow attempt (`45406123008`) stopped at the static validator because its regex assumed `FOR SELECT TO authenticated` was on one line, while the migration formats the clause across lines. The PostgreSQL integration step was skipped; no SQL failure was observed in that attempt.
- Corrected the validator to accept multiline SQL formatting and independently reran the source-level contract checks; all 12 source checks passed.
- A new RC924 PostgreSQL 17 workflow run (`45406678966`) is queued against the corrected branch. The migration remains unaccepted until this run completes successfully.
- Migration version uniqueness and cross-PR migration collision guards passed on the earlier source commit; the latest commit has a new set of workflows running/queued.


### RBAC preflight — reuse existing permission authority
- Production already has `public.mnty_platform_has_permission(text, varchar, uuid, varchar)`, SECURITY DEFINER with empty search_path, and EXECUTE granted to authenticated but not anon. It grants root authority only from `private.platform_admins`; scoped staff/role assignments are evaluated against tenant/business/branch and module/action permission JSON.
- Existing membership role values include `BUSINESS_OWNER`, `OWNER`, `EMPLOYEE`, `STAFF`, `MANAGER`, `ADMIN`, `SUPER_ADMIN`, and `CUSTOMER`. Partner company ownership must be scoped to active memberships for the exact business; do not infer owner authority from a generic tenant role.
- Current `platform_custom_roles` and `platform_role_assignments` have RLS + FORCE RLS; the inspected production role registries currently returned no custom role/scope rows. Partner module roles/permissions therefore need explicit setup through the existing role administration workflow before those custom roles can be relied on.
- Proposed permission keys: `PARTNERS.READ`, `PARTNERS.MANAGE`, `PARTNERS.REVIEW`, `PARTNERS.CONTRACT_APPROVE`, `PARTNERS.FINANCE_READ`, `PARTNERS.FINANCE_APPROVE`, `PARTNERS.COMPLAINTS`. These are design names, not yet seeded or enabled.
- Legal identifiers and uploaded documents should be restricted to the company owner and explicitly authorized legal roles; ordinary company employees should not receive them by default. Financial records should be separately gated to financial manager/approved company owner.


### Public seller/contact disclosure constraint
The existing public catalog derives phone/WhatsApp/address through `getExplicitPublicContact(profile, selectedBranch)` and only exposes contact when the profile has explicit public-contact enablement plus verified consent audit metadata. Partner seller contact disclosure must preserve this gate; do not expose a company's private phone, personal contact, address or employee details merely because the partner account is approved. Public seller display should include the approved trading name and seller responsibility notice, while contact fields are returned only when the current public-contact consent gate permits them. Legal name and registry/tax identifiers remain non-public unless counsel explicitly approves a narrow disclosure requirement.


### Existing Legal Center RPC and agreement lifecycle gap
- Production Legal Center exposes document/version publishing and consent RPCs: `legal_check_action`, `legal_assert_action`, `legal_publish_version`, `legal_update_document`, `legal_update_draft_version`, `legal_suspend_document`, `record_legal_consent` and `record_legal_consent_backend`. Published legal versions are protected by immutability triggers and legal document/version changes are audited.
- No agreement-specific create/update/terminate/signature RPC was found in the inspected Production function inventory. Existing `agreements` and `agreement_participants` therefore provide storage roots but not a complete commercial agreement lifecycle.
- Phase 1 must add narrow, actor-bound backend RPCs for partner agreement draft/submit/approve/activate/expire/terminate and participant acceptance/signature evidence. Do not grant direct authenticated INSERT/UPDATE on agreement tables or use `record_legal_consent` as a substitute for counterpart signature capture.
- Agreement versions must reference immutable legal document versions and snapshot the commercial terms/commission basis that applied when signed. Updates create a new version/renewal rather than mutating a signed contract in place.


### RC924 isolated PostgreSQL 17 result — PASS
- Corrected workflow run `45406678966` completed successfully on 2026-11-24.
- Static RC924 contract validator: PASS.
- Disposable PostgreSQL 17 fixture + migration + adversarial integration assertions: PASS.
- Participant A/B isolation, unrelated-user denial, anonymous-authenticated denial and protected platform-admin access all passed.
- RC924 is accepted as a source-level migration/test change. It remains unapplied to Production pending the separate full forward migration-chain replay and coordinated release gate.
- Full forward migration replay run `45406678921` is still IN PROGRESS; the isolated Supabase instance startup/replay stage has not yet completed.


### Business registration integration point
- Existing `business-register` Edge flow creates the canonical `businesses` row in `INACTIVE` status and a `PENDING` `approval_requests` record for a BUSINESS/CREATE request. It checks an allowed owner/service-provider membership or the protected platform-admin registry and performs duplicate checks.
- Reuse this canonical registration path for new company identity creation; do not create a second company/tenant record. Partner legal onboarding begins against the resulting canonical `business_id` after the business creation/owner membership approval path is complete.
- Existing business approval is not equivalent to legal partner approval. A separate partner verification state and publication gate must be required before partner-owned products can be published or referrals activated.


### RC924 full forward migration replay — PASS
- Workflow run `45406678921` completed successfully on 2026-11-24.
- The disposable Supabase instance started from the captured Production schema checkpoint, restored successfully, and applied all later repository migrations in timestamp order, including RC924.
- The companion RC921/RC922 PostgreSQL 17 behavioral/concurrency job also passed.
- RC924 therefore passed isolated PG17 behavior and full forward migration-chain replay. It is source/replay verified, but remains unapplied to Production pending the overall release gate and explicit coordinated deployment approval.
- Next dependency-ordered task: Phase 1 partner legal profile, private evidence storage, verification state machine, publication hard gate, and partner-specific agreement/terms/signature lifecycle.


## 11. Fresh Production schema/storage preflight — 2026-11-24

Read-only recheck against `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`), PostgreSQL 17.6.1.155. No production writes were performed.

### Confirmed existing schema to reuse
- `public.businesses` is the canonical business root with `id`, `tenant_id`, `organization_id`, `name`, `code`, `status`, `settings`, `created_at`, and `updated_at`. It does not currently expose first-class legal registration/tax profile columns.
- `public.user_memberships` remains the canonical membership root with `user_id`, `tenant_id`, optional `organization_id`, `business_id`, `branch_id`, `role`, `permissions`, and `status`. Partner access must resolve through exact active business membership.
- `public.agreements` has `tenant_id`, `agreement_type`, `document_id`, `document_version_id`, optional `business_id`, `status`, `effective_at`, `created_by`, and `metadata`. It has no first-class renewal, expiry, signature, counterpart verification, or commercial-terms snapshot columns.
- `public.agreement_participants` has `agreement_id`, `user_id`, `account_type`, `participant_role`, `status`, `joined_at`, `left_at`, and `metadata`. This supports participants but does not itself prove a legally valid signature workflow.
- `public.legal_documents` and `public.legal_document_versions` provide document type, title, locale, jurisdiction, immutable content/hash/version, publishing/effective/retirement state, target audience, consent flags, and metadata. Reuse these for approved templates and policy versions.
- `public.user_consents` stores a user's consent to a legal document/version and optional `agreement_id`, including consent timestamp, source, content hash and device/session metadata. Do not treat this table alone as proof of bilateral commercial signature or legal representative authority.
- `public.provider_onboarding_requests` contains provider kind, specialties, service areas, portfolio, profile image path and review state, but no commercial partner registration/tax identifiers or company legal-document lifecycle. It is not a substitute for partner verification.

### Storage boundary — verified bucket inventory
Only two buckets exist:
- `mantiqatix-media`: private; 5 MiB limit; JPEG/PNG/WebP only.
- `mantiqatix-profile-media`: public; 5 MiB limit; JPEG/PNG/WebP/SVG.

There is no dedicated private legal-document bucket. Do not put contracts, commercial-register extracts, tax cards, identity evidence or signatures in the public profile-media bucket. The private media bucket's current MIME allowlist excludes PDF and its existing path policies are for ordinary user/business media, not partner legal evidence. Phase 1 therefore needs a separately scoped private legal-evidence bucket and strict storage-object policies, upload/download authorization, checksum verification, retention and audit controls. This is a future migration, not a current Production change.

### RC924 hardening correction — fail closed on missing JWT claim
The first RC924 draft used `COALESCE(is_anonymous, false) = false`, which blocks an explicit anonymous Auth claim but treats a missing claim as a confirmed user. That is not sufficiently fail-closed. The current source was corrected to require `(auth.jwt() ->> 'is_anonymous')::boolean IS FALSE`; NULL/missing now denies participant reads. The adversarial integration suite adds a separate missing-claim negative case. The earlier RC924 CI pass predates this correction and must not be used as evidence for the current head. Exact-head CI for the corrected migration is pending.

### Remaining security distinction
RC924 corrects the participant SELECT policy only. Existing legal admin-write and related legal policies still contain legacy COALESCE-based anonymous-claim expressions. They remain part of the coordinated RC479/RC481/RC482/RC483/RC488+ release review; RC924 does not certify all Legal Center writes or signature semantics.

**Current Phase 0 result:** canonical business/membership/legal roots and storage gap are mapped. Exhaustive RPC/Edge/constraint/trigger/ACL dependency mapping remains incomplete. Overall MNTX-BP-001 remains **IN PROGRESS / NOT IMPLEMENTED / NOT VERIFIED**.


## 13. RC924 hardening and partner legal-profile schema preflight — 2026-11-24

### RC924 policy behavior
- Live Production confirms `agreements_admin_write` is a PERMISSIVE `FOR ALL` policy, so it also participates in SELECT decisions. A participant SELECT policy alone is not a complete deny boundary; RC924 now installs a separate RESTRICTIVE SELECT policy called `agreements_confirmed_auth_select` requiring an explicit `is_anonymous = false` claim.
- The participant policy now correlates `agreement_participants.agreement_id = agreements.id` and requires the current JWT user to match the participant row. Missing `is_anonymous` is denied, not treated as a confirmed identity.
- RC482 is an ordered dependency: it changes `private.legal_is_admin(uuid)` from role-label authority to the private platform-admin registry. The RC924 fixture uses the post-RC482 registry helper semantics and now mirrors RLS/FORCE RLS and the private helper's client ACL boundary.
- Added tenant-role adversarial actors (ACTIVE tenant ADMIN, tenant SUPER_ADMIN with stale platform metadata, and delegated LEGAL_ADMIN) and assertions that none can read global agreements or impersonate the registered root actor. The integration also asserts that the RESTRICTIVE SELECT guard and existing PERMISSIVE admin FOR ALL policy coexist.
- First expanded RC924 run `45449613298` failed at the unrelated-user assertion because the test had executed `RESET ROLE` and then accidentally queried as PostgreSQL owner. Participant A/B isolation and tenant-role negative assertions had completed successfully. The integration now explicitly re-enters `SET ROLE authenticated` before unrelated/anonymous/root assertions and the static validator enforces this role context.
- Corrected exact-head run is being queued on `f541aa64ebf7fef80c9a2a740d0aac25035e7461`. Do not mark RC924 accepted until this exact run and the current full replay pass.

### Live canonical partner schema
- `public.businesses` remains the canonical business identity: `id, tenant_id, organization_id, name, code, status, settings, created_at, updated_at`. It has no dedicated legal name, commercial registration, tax number, signatory or bank columns.
- `public.user_memberships` already links `user_id`, `tenant_id`, `organization_id`, `business_id`, `branch_id`, `role`, `permissions` and `status`. Partner owners/employees must use this existing business membership boundary; do not create a parallel partner-user membership graph.
- `provider_onboarding_requests` is an activity/provider application, not a complete legal partner profile. It stores request/user/tenant/org IDs, business display name, provider kind, specialties, service areas, portfolio, profile image path and review state. It does not store legal registration/tax identifiers or the required private evidence.
- `legal_documents` and `legal_document_versions` are the Legal Center's published legal-content/version tables. They are appropriate as immutable referenced terms/templates, not as the private upload store for partner registration documents.
- `agreements` already reference a business, legal document and immutable document version; `agreement_participants` tracks users and participation state. Their schema does not yet prove bilateral electronic signing or contain a complete partner-specific commercial snapshot/signature evidence lifecycle.
- Production Storage currently has only two buckets: `mantiqatix-media` (private, 5 MiB, JPEG/PNG/WebP) and `mantiqatix-profile-media` (public, 5 MiB, JPEG/PNG/WebP/SVG). Neither is an appropriate legal evidence repository; especially never put registry/tax/bank documents in the public profile bucket.

### Phase 1 design boundary
1. Reuse the canonical `businesses.id` and active scoped memberships.
2. Add a business-scoped legal profile with legal/trading names, entity type, registration jurisdiction, registry number, tax registration number, registered address, authorized representative and verification status/history. Keep this data private.
3. Add a dedicated private legal-evidence bucket with PDF/JPEG/PNG allowlist, strict business-path authorization, short-lived signed reads, server-side size/MIME/hash validation and immutable audit events. No anonymous/public reads or uploads.
4. Keep commercial agreement terms/version/signature evidence separate from generic Legal Center user-consent records. A checkbox/consent row is not a legally sufficient partner signature. Reuse `agreements` only after a reviewed versioned agreement and bilateral-signature design; never mutate signed versions.
5. Gate partner product publication and referral activation on legal approval plus an effective agreement. The existing provider `is_verified` flag does not satisfy this gate.
6. No new migration was created in this checkpoint because the local Supabase CLI/PostgreSQL tooling is unavailable here; follow the repo's pinned CLI migration workflow before inventing or committing the next migration version.

**Safety:** Production inspection was read-only. No partner records, documents, Storage buckets, grants, RLS, Auth, Edge Functions, products, payments or settlement data were changed.


### RC924 corrected exact-head verification — PASS
- The corrected RC924 workflow run `45450116751` passed on exact source head `5d49951c3541e71da3b61f2e5343c5c14d966eac`: static validator PASS; fixture, migration and PostgreSQL 17 adversarial integration PASS.
- Verified both partners see only their own agreement; unrelated authenticated users see none; anonymous Auth and missing `is_anonymous` claims see none; tenant ADMIN/SUPER_ADMIN/LEGAL_ADMIN labels cannot acquire global legal authority or impersonate the registered platform root; registry root can read all; the restrictive confirmed-auth SELECT guard remains alongside the existing permissive admin FOR ALL policy.
- Full chronological replay run `45450116515` passed on the same exact source head: checkpoint restore, 117 timestamp-ordered forward migrations, RC485/RC923 catalog checks, RC488–RC492 security tests, RC494/RC495 and tenant-isolation suite.
- Current module professionalization workflow `45450116780` remains queued at this checkpoint. The complete RC924 source fix is accepted in isolated PG17; PR #1061 remains Draft until the dependent module workflow finishes.
- These are disposable CI results only; no Production migration or access policy was applied.


## 2026-11-24 — RC924 ordered-helper correction
- Read-only Production inspection found `private.legal_is_admin(uuid)` still derives authority from active tenant ADMIN/SUPER_ADMIN/LEGAL_ADMIN memberships because RC482 is not recorded in the live migration ledger.
- RC924 now preflights the helper body, SECURITY DEFINER flag, empty search_path, ACL and absence of the ambiguous zero-argument overload. It aborts unless RC482 has made the helper registry-backed.
- The dedicated PostgreSQL 17 workflow now proves RC924 fails on the legacy helper, then applies RC482 and RC924 in timestamp order with both integration suites.
- Production remains read-only; do not deploy RC924 independently or before RC482.
