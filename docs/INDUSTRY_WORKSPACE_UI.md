# MantiqaTiX — Industry Workspace UI Inventory

## Scope and status

This change is the **frontend-first design stage** for sector workspaces. It does not certify or implement sector backends. The workspace directory and detail routes are intentionally read/write-free: no sector-table queries, writes, bookings, dispensing, payments, or fabricated operational records.

- Canonical sector count: 27 unique codes from the existing sector registry.
- Entry point: the existing **الموديولات** workspace.
- Route format: **قطاع: CODE**, where CODE is a canonical sector identifier.
- Access boundary: routes require the existing **الموديولات** view permission through RBAC.
- PWA: web/industry-workspaces.js is loaded by the boot sequence and precached by service worker cache mnty-web-v130.
- UI controls that would mutate data are disabled and labelled as awaiting the approved backend contract.

## Sector inventory

| Code | Workspace | Main sections |
|---|---|---|
| FOOD | المطاعم والكافيهات | menu, kitchen, orders, tables, delivery, inventory, branches, staff, finance, reports |
| HEALTH | الأطباء والعيادات | specialties, appointments, clinical services, customers, staff, privacy, branches |
| PHARMACY | الصيدليات | products, prescriptions, inventory, orders, procurement, privacy, branches |
| LABS | معامل التحاليل | services, schedule, samples, order status, staff, privacy, reports |
| RADIOLOGY | مراكز الأشعة | services, device schedule, imaging workflow, orders, staff, privacy, reports |
| DENTAL | أطباء الأسنان | specialties, appointments, clinical services, customers, staff, privacy |
| HOSPITAL | المستشفيات | wards/departments, specialties, appointments, clinical services, staff, privacy |
| MEDICAL | المراكز الطبية | specialties, services, appointments, clinical services, branches, staff |
| VETERINARY | العيادات البيطرية | animal care, appointments, services, customers, inventory, staff |
| GROCERY | البقالة والسوبر ماركت | products, offers, orders, inventory, procurement, delivery, finance |
| FASHION | الأزياء والملابس | products, offers, orders, inventory, customers, branches, finance |
| REAL_ESTATE | العقارات | properties, customers, schedule, documents, projects, finance |
| AUTO | السيارات والنقل | vehicle/service catalogue, schedule, orders, inventory, finance |
| MAINTENANCE | الصيانة والخدمات المنزلية | services, orders, schedule, staff, inventory, finance |
| ACCOUNTING | المحاسبة ومكاتب المحاسبة | services, customers, projects, documents, finance, staff |
| LEGAL | المحاماة والخدمات القانونية | services, customers, schedule, documents, projects, staff |
| COMPANIES | الشركات والموردون | services, orders, procurement, projects, documents, finance |
| EDU | التعليم والتدريب | education programmes, schedule, customers, staff, finance |
| DIGITAL | التسويق والإعلان | campaigns, customers/leads, projects, documents, finance, staff |
| TECH | البرمجيات والخدمات الرقمية | services, customers, projects, documents, orders, staff |
| FITNESS | الرياضة واللياقة | fitness plans, schedule/classes, customers, staff, finance |
| TRAVEL | السفر والرحلات | travel packages, orders, customers, documents, finance |
| MANTIGO | MantiGO والنقل عند الطلب | vehicle, orders/rides, schedule, finance, staff, reports |
| JOBS | الوظائف والتوظيف | jobs, applicants, schedule/interviews, documents, staff |
| MATRIMONY | الزواج والخدمات المرتبطة | consent-aware profiles, contact requests, documents, safety |
| USED_ITEMS | سوق المستعمل | ads, orders/negotiation, customers, reports |
| FREELANCER | المستقلون ومقدمو الخدمات | services, customers, projects, documents, finance |

## Shared UI patterns

- Search and sector-group filters on the directory.
- Responsive sector cards and nested section navigation.
- A detail screen for each sector with sector-specific focus areas.
- Screen preview with empty states instead of fake rows or sample customer data.
- Disabled forms/actions to make the eventual interaction model visible without implying writes succeeded.
- Consistent RTL layout, accessible labels, responsive table containers, and reduced-motion support.
- Keyboard-accessible sector tabs (Arrow Left/Right, Home/End, roving focus), explicit tab-panel relationships, selected-state announcements for filters, and a live result count for screen readers.
- Explicit notice that sensitive operations are not active until the backend and authorization contract is reviewed.

## Existing restaurant workspace — explicit backend boundary

The legacy operational restaurant workspace is a separate implementation and must not be treated as proof that the new sector workspaces are backend-ready.

- The current browser module reads `restaurant_menu_items`, `orders`, `restaurant_tables`, and `restaurant_inventory`; its menu/table/inventory forms contain direct table insert/update calls.
- The repository's `docs/RC52_RESTAURANT_MUTATION_SECURITY.md` records that `restaurant_erp_mutate(text,jsonb,text)` and `restaurant_table_mutate(text,jsonb,text)` were not executable by `anon`, `authenticated`, or `service_role` through the inspected ACL surface at that checkpoint.
- That checkpoint explicitly does not certify restaurant production completeness and leaves authoritative order-state transitions open.
- Before connecting any new FOOD screen, re-check the live production ACL/grants, current migration parity, RLS policies, and tenant/business/branch scope. Do not enable the legacy RPCs or widen grants as a shortcut. If the verified contract remains unavailable, keep mutations disabled and use a newly reviewed server-authoritative path.

This is a source-repository audit note, not a claim that the historical checkpoint still matches today's production database. Current live verification is required.

## Backend phase — do not infer readiness from the UI

When the frontend is reviewed, implement each sector in a separate backend slice:

1. Confirm existing schema, migrations, Edge Functions/RPCs, and canonical table names; do not invent tables or write directly from the browser.
2. Define role/tenant/organization/branch scopes and RLS tests.
3. Define server-owned state transitions, idempotency, audit events, and validation for sensitive actions.
4. Add isolated database integration tests and negative cross-tenant tests.
5. Connect the UI to verified read contracts first, then add mutations through approved server endpoints.
6. Add empty/loading/error states and end-to-end tests against disposable fixtures.
7. Do not mark a sector production-ready until exact-head CI, deployment parity, and post-deployment smoke checks pass.

## Validation

The dedicated Industry Workspaces UI Contract workflow checks JavaScript syntax, the 27-code registry contract, all sector routes at runtime, accessible tab/panel relationships, invalid-route rejection, the absence of direct backend operations in the new UI file, RBAC routing, and PWA precache integration. A queued or missing workflow result is not a pass.
