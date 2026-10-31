# Architecture — Direct Activity Modules
**Request ID:** CAT-ACTIVITY-MODULES-20261031-01  
**Date:** 2026-10-31  
**Status:** FOUNDATION IMPLEMENTED IN FEATURE BRANCH; CI / DEPLOYMENT / FULL MODULE INTEGRATIONS NOT VERIFIED

## Decision

The customer-facing taxonomy is:

`Activity → Specialty → Business / Service`

There is no visitor-facing functional-group or profession navigation layer. A visitor sees activity cards directly. Selecting an activity opens a dedicated activity-module page. The existing functional-group identifiers remain internal compatibility metadata until a separately reviewed canonical taxonomy migration proves that they can be retired safely.

## Activity module identity and route

- The canonical `ActivityCategory.id` is the stable activity-module identity.
- Direct navigation uses the catalog URL query parameter `?activity=<activity-category-id>`.
- Refresh and browser back/forward must restore the module route.
- The activity module must be opened only for a canonical activity category; profession-only rows are not peer public modules.
- Selecting a specialty returns to the catalog with the activity/specialty filter visible and reversible.

## Shared platform services

Every activity module reuses shared, existing platform services rather than creating a new identity or billing system:
- Authentication, user profile, tenant, business, and branch identity.
- Role/membership/permission resolution and subscription entitlement.
- Public directory and storefront read boundaries.
- Egyptian geographic scope: area/village → markaz → governorate → all Egypt (manual choice remains available).
- Verified-first ranking, with unverified published directory records still included and marked distinctly.
- Shared notification, audit, support, and analytics contracts where the module is authorized to use them.

Module-specific behavior must remain scoped to the authorized tenant/business/branch. UI hiding alone is not authorization.

## Dedicated module page sections

The first additive page foundation exposes four sections:
1. Overview — real activity/specialty and confirmed/unconfirmed directory counts.
2. Specialties — direct selection of specialty to filter the existing catalog.
3. Marketing & Advertising — domain-aware audience, content pillars and campaign-planning guidance.
4. Domain Operations — a capability map for domain files, goods/services, customer requests, reports, geographic discovery, and approval.

The marketing section is **planning guidance only**. It now resolves a typed profile for each canonical activity ID using `activityModuleRegistry.ts`, including a domain objective, audience, positioning, content pillars, campaign ideas, and required launch assets. The operations cards are rendered from the same registry and are explicitly labelled **قيد التجهيز** until their source-of-truth APIs and authorization tests exist. It does not create or publish campaigns, spend advertising budgets, promise analytics, or write marketing records.

## Marketing module target

Each activity needs its own strategy profile and configurable campaign templates, for example:
- Restaurants/cafes: menu and product photography, meal offers, local delivery targeting, seasonal promotions.
- Medical/health: specialties and appointment awareness, reviewed educational content, service availability; no misleading clinical claims.
- Real estate/construction: real projects, units, site visits, quotations and proof of work.
- Retail/services: real catalog items, local offers, stock/service availability and customer follow-up.

The production Marketing & Advertising workflow must reuse the existing approved campaign/partner backend boundary (including RC453 contracts where applicable) and remain fail-closed when prerequisites are absent. Do not add browser-side direct INSERT/UPDATE/DELETE against campaign or participant tables. Keep SMM distinct from Marketing & Advertising; SMM remains deferred and must not be reactivated by this work.

## Domain operations target

An activity capability registry should declare only the workflows supported by that activity (for example menu/orders for restaurants, listings/leads/visits for real estate, appointments/services for medical providers). Each capability requires:
- A reviewed source-of-truth table/RPC/Edge Function.
- Server-side actor and tenant/business/branch authorization.
- RLS and negative cross-tenant tests.
- Auditable status transitions and idempotency for sensitive actions.
- Empty/error/loading states and an explicit unavailable state when the backend contract is absent.

Do not create demo records or fabricated metrics to make a module appear operational.

## Delivery phases and acceptance

### Phase A — visitor directory and route (current feature branch)
- [x] Replace visitor-facing group cards with direct activity cards.
- [x] Exclude profession-classified rows as peer activity cards.
- [x] Add a dedicated activity module page and stable `?activity=` route.
- [x] Add direct specialty selection and a visible, reversible directory filter.
- [x] Preserve verified/unverified counts and existing geography/result filtering.
- [x] Remove public group labels from business cards.
- [x] Run TypeScript/lint, production build, taxonomy contract, and browser E2E on exact PR head `7e0d8caa79a0b768c8320049c718d5ba581a1895` (all passed).
- [ ] Verify deployed-origin behavior after merge/deploy; not claimed by source presence.

### Phase B — activity configuration registry
- [x] Add a typed activity-module configuration registry resolved by canonical activity ID.
- [x] Add domain-level marketing plans and operation capability profiles for the ten supported domain profiles.
- [x] Render each activity's objective, audience, positioning, content pillars, campaign ideas, required assets, and domain operations from the registry.
- [x] Keep unknown/custom activity IDs compatible through a safe generic profile.
- [x] Add explicit reviewed per-activity marketing overrides for all 50 canonical activity IDs: audience, focus, campaign ideas, required assets, and operating scope.
- [x] Keep unknown/custom activity IDs compatible through the safe generic domain profile.
- [x] Define three reviewed operational capabilities for each of the 50 canonical activity IDs (150 capabilities total), with activity-specific IDs, titles, and descriptions.
- [x] Resolve activity-specific capabilities before domain-level fallbacks and keep every unintegrated capability in `planned` state.
- [x] Render capability state with state-aware accessible labels and badges.
- [ ] Implement backend actions only after per-capability API/RPC, tenant/business/branch authorization, audit, and negative security tests are verified.
- [x] Add an additive Super Admin editing experience for the marketing profile and three descriptive capabilities per activity, persisted through the guarded platform settings endpoint; browser does not write settings directly.
- [x] Add server-side payload sanitizer, Node boundary tests, before/after audit payloads, a sanitized public settings projection, and a browser E2E mock round-trip for authenticated Super Admin editing.
- [x] Validate exact-head TypeScript/build/taxonomy/browser validation after the 150 activity-specific capability definitions on `7e0d8caa79a0b768c8320049c718d5ba581a1895`.
- [ ] Make settings upsert and audit insertion one database transaction before treating persistence plus audit as atomic; current API reports a partial-success warning if audit insertion fails.
- [x] Run exact-head TypeScript/build/taxonomy/browser validation after the 150 activity-specific capability definitions.

### Phase C — working marketing workspace per activity
- [ ] Port/reuse the existing reviewed marketing workspace into the current catalog app; do not revive the retired legacy app as the primary UI.
- [ ] Scope provider profiles, services, campaigns, participants, leads, approvals, and budgets to the authorized business/tenant.
- [ ] Implement domain templates, content calendar, campaign draft/approval/publish lifecycle, channel connections, budget constraints, and reporting only where backed by verified server contracts.
- [ ] Validate missing-schema/missing-RPC behavior and real runtime authorization before enabling any action.

### Phase D — specialized operating workflows
- [ ] Add activity-specific operational components only after the source-of-truth API and permission matrix are reviewed.
- [ ] Link each action to a module capability and per-role permission.
- [ ] Add isolated PostgreSQL and browser E2E for normal, denied, duplicate/retry, and cross-tenant cases.

### Phase E — release
- [ ] Mobile/tablet/desktop, RTL, keyboard, screen-reader, and regression coverage.
- [ ] Exact-head CI pass and deployed-origin E2E.
- [ ] Production backend rollout only through the existing migration, backup, approval, reconciliation, and rollback gates.
- [ ] Keep `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` until all independent release blockers close.

## Super Admin activity settings — 2026-10-31

The additive editor is implemented in `apps/catalog-frontend/src/components/admin/ActivityModulesAdmin.tsx` and is linked as a new tab inside the existing Super Admin dashboard. It edits each of the 50 canonical activities independently. Marketing text and three capability titles/descriptions are saved using the existing `catalog-platform-admin` `SAVE_SETTINGS` action. The server validates IDs, fields, lengths, arrays, capability count, and payload size; the public directory API returns only a sanitized `activityModuleOverrides` projection, never the full private platform settings object.

A Super Admin browser E2E scenario verifies the editor selection, a pharmacy marketing objective change, the authenticated save request, and preservation of all three capabilities in the `planned` state. This scenario uses a mocked Edge Function response and does not constitute a production database write or deployed-origin proof.

Exact-head validation `7e0d8caa79a0b768c8320049c718d5ba581a1895` passed TypeScript, production build, taxonomy contract, activity-admin contract, Node sanitizer tests, employee RBAC PostgreSQL, browser E2E, backend boundary and supporting workflows. Pages validation passed; deployment was skipped on the PR event. PR #608 remains Draft and unmerged.

Open: transactionally couple the settings upsert and audit insert; add negative tests for unknown capability IDs and audit failure; deploy only after approval; verify live authenticated save/read/reset and public visitor rendering from the deployed Edge Functions. The currently deployed Edge Functions were observed at older versions 23 and 10, so no live functionality claim is made. Global `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`.

## Safety boundaries

This task changes frontend source and test/documentation contracts only. It does not authorize production migrations, schema/data changes, grants, RLS/Auth changes, Edge Function deployments, ad spend, payment, wallet, commission, or accounting mutations. The global production gate remains BLOCKED / NOT CERTIFIED.
