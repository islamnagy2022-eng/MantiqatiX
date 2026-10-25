# MantiqatiX — Shared WhatsApp-first Catalog Engine + Subscription UX
Date: 2026-10-25
Status: DESIGN/INVENTORY IN PROGRESS — NOT YET IMPLEMENTED ACROSS ALL MODULES

## Goal
Implement common catalog/public-page/owner-management behavior once, then connect each applicable sector through a small, typed sector adapter. Do not create a parallel business/catalog data store and do not force every sector into identical workflows.

## Architecture
### 1. Shared engine responsibilities
- Public business/service/catalog page shell, mobile layout, safe text/image rendering, metadata and canonical URL.
- Catalog grouping/sorting, item/service cards, price display where appropriate, availability display, WhatsApp handoff and contextual prefilled request.
- Owner dashboard primitives: profile/page settings, catalog editor entry points, publish status, link/QR/share actions, preview, activity/status notices.
- Uniform feature state display: READY, UNDER_CONSTRUCTION, BLOCKED, NOT_VERIFIED. Arabic display for unfinished capabilities is exactly "تحت الإنشاء". Incomplete actions must be disabled and backend restrictions remain authoritative.
- Shared validation, URL encoding, error/loading/empty states, accessible status messages, audit hooks where the existing backend supports them, and test helpers.
- Subscription status component for active/expiring/expired/pending/manual-review states, driven only by authoritative entitlement data.
- No direct client-side writes to financial/order truth. Use existing approved APIs/RPCs/Edge Functions.

### 2. Sector adapter contract
Each sector provides configuration and data adapters, not a copy of the engine:
- sector code + display label + profile type;
- canonical source of truth (existing tables/views/RPC/Edge Function);
- public fields allowed to be exposed;
- owner CRUD operations supported by existing backend;
- catalog noun and field mapping (product, menu item, service, specialty, department, appointment slot, etc.);
- price mode: FIXED, STARTING_FROM, QUOTE, HIDDEN;
- request mode: WHATSAPP, EXISTING_BOOKING_FLOW, EXISTING_ORDER_FLOW, INFORMATION_ONLY;
- sector-specific fields/sections and required notices;
- availability/booking constraints, moderation and publication rules;
- feature readiness and supported actions.
The engine must fail closed if a required adapter or authoritative data path is missing. Never infer table names or permissions from the sector label.

## Initial sector profile mapping
| Sector | Shared presentation | Sector-specific rules to preserve |
|---|---|---|
| Restaurants/cafés (FOOD) | public menu, categories, item photos/prices, owner page, WhatsApp inquiry | reuse restaurant canonical menu; variants/add-ons, availability, hours, order/fulfilment and kitchen workflow stay restaurant-owned |
| Pharmacy (PHARMACY) | business profile, allowed catalog display, contact CTA | no unsupported prescription/controlled-medication ordering; pharmacist review and applicable regulatory restrictions; no medical claims |
| Doctors/clinics/dental (HEALTH/DENTAL/MEDICAL) | profile, specialties, services, location/contact | appointments remain in existing booking workflow where implemented; no medical diagnosis through catalog; availability/credentials/privacy boundaries retained |
| Hospitals (HOSPITAL) | institution profile, departments/services/contact | department and service navigation; urgent/emergency directions must not be replaced by an ordinary WhatsApp CTA; preserve privacy and institutional workflow |
| Labs/radiology (LABS/RADIOLOGY) | tests/procedures/services and contact | preparation requirements, booking/referral and results privacy remain in existing approved workflow |
| Companies/providers (COMPANIES/FREELANCER/MAINTENANCE/LEGAL/ACCOUNTING) | company profile, service catalog, quote/request handoff | quote-based services need no invented price; contract, legal, financial, and operational flows remain unchanged |
| Retail/grocery/fashion (GROCERY/FASHION) | product catalog, price, photos, availability, WhatsApp | inventory, variants, delivery, returns and canonical order flow remain owned by sector module |
| Marketing company-services page | company-owned service descriptions and WhatsApp inquiry | separate from internal agency workspace, paid-ad module, SMM and campaign billing |
| SMM digital-services sales | separate SMM module and existing service-sale capabilities | not merged into general catalog engine; provider gateway, spend, refunds and finance contracts remain isolated; incomplete actions marked "تحت الإنشاء" |

This mapping is a starting point only. Confirm actual routes, tables, RPCs, Edge Functions, current UI and permission model before implementing an adapter. The registry in web/sector-registry.js and existing modules (including web/restaurant-module.js, web/sector-modules.js, web/operations-modules.js, web/module-blueprints.js and web/smm.js) are source candidates to audit, not proof every sector is complete.

## Owner/admin dashboard requirements
- Business owner sees only their active business/branch and own pages/catalog; staff sees only permitted actions; platform admin gets a separate audited moderation/support view.
- Overview: page status, public URL, preview/share/QR, items/services count from authoritative sources, last update, and clear warnings for missing configuration.
- Page management: name, description, logo/media if supported, contact WhatsApp, allowed fields and publish lifecycle. Keep sector-owned canonical records in their original module.
- Feature-state inventory: show "تحت الإنشاء" on each incomplete tab/card/action, disable unsupported interactions, preserve working areas.
- Avoid showing fake metrics or hardcoded "success"; show loading/empty/error/not-verified honestly.
- All data reads/writes must honor existing RBAC/RLS and business/tenant/branch boundaries.

## Subscription reminders
### Owner/customer view
- In the subscription/dashboard panels show status: pending manual review, active, expires soon, expired, or blocked.
- Display exact end date/time and remaining days only when they can be computed from authoritative paid/activation time and the purchased product duration.
- Reminder milestones proposed: 7 days, 3 days, and 1 day before expiry, plus an expiry notice. Make milestones configurable and avoid duplicate notices.
- Show renewal CTA through the currently approved path. For the initial WhatsApp-first scope, this means opening the support WhatsApp with subscription/page/order context; do not claim payment or renew automatically.
- Expired entitlement must disable paid features/public publication according to the authoritative server rule, not just hide the dashboard badge.
### Notifications implementation gate
- First inspect existing subscription sources and notification infrastructure (mnty push, in-app notifications, cron/pg_net/Edge Functions). Reuse existing notification delivery; do not introduce a second notifications table or duplicate scheduler without need.
- Scheduled dispatch must be idempotent, time-zone aware, rate-limited, retryable and auditable. Avoid sending personal/business subscription details to unauthorized users.
- If a scheduler/provider is not configured, dashboard reminders may be shown from authoritative data, but scheduled push/email must remain explicitly NOT VERIFIED rather than being claimed as delivered.
- Test duplicate runs, missed windows, expiry/renewal races, owner transfer, revoked membership and cross-tenant isolation.

## Required delivery phases
1. Inventory routes, sectors, canonical tables, actions, subscription source-of-truth, existing notification scheduler and dashboard entry points.
2. Define the engine/adapter contract and static tests; preserve existing module contracts.
3. Integrate one low-risk pattern first (digital page + retail/menu reuse) and prove no duplicate catalog records.
4. Integrate each applicable sector via adapter; retain existing order/booking/clinical/regulatory workflows where required.
5. Add subscription status cards and expiry reminders to customer, business-owner and admin dashboards as appropriate.
6. Run multi-user RLS, public data exposure, browser/mobile E2E, accessibility, and regressions for restaurant, medical, pharmacy, company, retail, SMM, finance and payments.
7. Enable release only after exact-head CI and production-like integration tests pass. No direct production migration/deployment as part of this plan.

## Release checklist
- [ ] Complete route/module/data-source inventory and sector-adapter matrix.
- [ ] Shared engine implemented and actually wired into each applicable module.
- [ ] No parallel/duplicate catalog data introduced.
- [ ] Sector-specific requirements and safety constraints preserved.
- [ ] Every incomplete visible feature marked "تحت الإنشاء" and unsupported actions blocked.
- [ ] Dashboard ownership, page state, preview/link/QR and error/empty states tested.
- [ ] Subscription status/end date computed from authoritative entitlement data.
- [ ] 7/3/1-day + expiry reminders idempotent and delivery path verified, or explicitly marked dashboard-only.
- [ ] Cross-tenant/RLS tests, browser E2E and regressions pass.
- [ ] Production release gate explicitly approved; no implicit release from passing CI alone.
