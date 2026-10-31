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
- [ ] Run TypeScript/lint, production build, taxonomy contract, and browser E2E on the exact PR head.
- [ ] Verify deployed-origin behavior after merge/deploy; not claimed by source presence.

### Phase B — activity configuration registry
- [x] Add a typed activity-module configuration registry resolved by canonical activity ID.
- [x] Add domain-level marketing plans and operation capability profiles for the ten supported domain profiles.
- [x] Render each activity's objective, audience, positioning, content pillars, campaign ideas, required assets, and domain operations from the registry.
- [x] Keep unknown/custom activity IDs compatible through a safe generic profile.
- [ ] Add explicit reviewed per-activity overrides for every canonical activity ID.
- [ ] Define an additive admin editing experience and persistence contract for module configuration.
- [ ] Run exact-head TypeScript/build/taxonomy/browser validation after registry changes.

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

## Safety boundaries

This task changes frontend source and test/documentation contracts only. It does not authorize production migrations, schema/data changes, grants, RLS/Auth changes, Edge Function deployments, ad spend, payment, wallet, commission, or accounting mutations. The global production gate remains BLOCKED / NOT CERTIFIED.
