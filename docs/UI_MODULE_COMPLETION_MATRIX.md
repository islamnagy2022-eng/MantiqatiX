# MantiqatiX UI Module Completion Matrix

Last inspected: 2026-10-21
Branch: `feat/module-safe-error-feedback-20261021`
Source of module scope: `scripts/validate-module-runtime-contracts.mjs` and `scripts/validate-module-runtime-coverage.mjs`.

## Interpretation

This is an execution inventory, not a claim that listed modules are complete. The existing validators define 28 module keys and expected data sources/renderers. A source-contract or module-coverage check does **not** prove the browser journey, role authorization, tenant isolation, responsive behavior, or every create/edit/detail flow. Every row therefore remains **NOT VERIFIED** until runtime evidence is attached.

## Registered module coverage

| Module key | Current renderer | Expected live data sources | UI/E2E status |
|---|---|---|---|
| `RESTAURANTS` | `web/restaurant-module.js` | `restaurant_menu_items`, `restaurant_orders`, `restaurant_tables` | NOT VERIFIED |
| `CAFES` | `web/restaurant-module.js` | `restaurant_menu_items`, `restaurant_tables`, `restaurant_orders` | NOT VERIFIED |
| `SUPERMARKET` | `web/operations-modules.js` | `catalog_items`, `catalog_item_prices`, `inventory_transactions`, `orders` | NOT VERIFIED |
| `CLOTHING` | `web/operations-modules.js` | `fashion_products`, `fashion_orders`, `fashion_tailor_services` | NOT VERIFIED |
| `MANTIGO` | `web/operations-modules.js` | `mantigo_rides`, `mantigo_bids`, `mantigo_ride_ratings` | NOT VERIFIED |
| `MARRIAGE` | `web/operations-modules.js` | `matrimony_profiles`, `matrimony_requests`, `matrimony_contact_unlocks` | NOT VERIFIED |
| `JOBS` | `web/operations-modules.js` | `jobs`, `job_applications` | NOT VERIFIED |
| `SCHOOLS` | `web/operations-modules.js` | `school_profiles`, `teacher_profiles`, `education_requests` | NOT VERIFIED |
| `MAINTENANCE` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids`, `support_tickets` | NOT VERIFIED |
| `MARKETING` | `web/operations-modules.js` | `marketing_leads`, `marketing_provider_profiles`, `marketing_services`, `marketing_projects`, `marketing_plans`, `marketing_provider_subscriptions`, `marketing_project_participants`, `marketing_commission_rules` | NOT VERIFIED |
| `BUSINESS_ERP` | `web/operations-modules.js` | `businesses`, `erp_purchase_orders`, `erp_purchase_receipts`, `erp_stock_transfers`, `warehouses` | NOT VERIFIED |
| `ACCOUNTING` | `web/operations-modules.js` | `chart_of_accounts`, `journal_entries`, `general_ledger` | NOT VERIFIED |
| `LEGAL` | `web/operations-modules.js` | `legal_documents`, `legal_requirements`, `agreements` | NOT VERIFIED |
| `PARTNERS` | `web/app.js` | `success_partners`, `referred_businesses` | NOT VERIFIED |
| `ADS` | `web/app.js` | `advertisements`, `ad_campaigns` | NOT VERIFIED |
| `TRAVEL` | `web/operations-modules.js` | `travel_packages`, `travel_bookings` | NOT VERIFIED |
| `USED_ITEMS` | `web/operations-modules.js` | `used_item_ads` | NOT VERIFIED |
| `PHYSIOTHERAPY` | `web/operations-modules.js` | `medical_appointments`, `marketing_provider_profiles` | NOT VERIFIED |
| `PHARMACIES` | `web/operations-modules.js` | `marketing_provider_profiles`, `orders` | NOT VERIFIED |
| `CLINICS` | `web/operations-modules.js` | `marketing_provider_profiles`, `medical_appointments` | NOT VERIFIED |
| `HOSPITALS` | `web/operations-modules.js` | `marketing_provider_profiles`, `medical_appointments` | NOT VERIFIED |
| `LABS` | `web/operations-modules.js` | `marketing_provider_profiles`, `medical_appointments` | NOT VERIFIED |
| `ACCOUNTING_SERVICES` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids` | NOT VERIFIED |
| `COMPANIES` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids` | NOT VERIFIED |
| `FACTORIES` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids` | NOT VERIFIED |
| `FLIGHTS_TRIPS` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids` | NOT VERIFIED |
| `HOME_MAINTENANCE` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids` | NOT VERIFIED |
| `SOFTWARE_ERP` | `web/reverse-bidding-module.js` | `indrive_requests`, `indrive_bids` | NOT VERIFIED |

## Required completion contract for every module

- [ ] Landing/overview state and clear page title.
- [ ] List/table or card results from the authoritative API/RPC; no fake records.
- [ ] Detail/view flow and working navigation/back behavior where the domain supports it.
- [ ] Create/edit/submit actions only where a verified backend contract exists; otherwise disabled with a truthful reason.
- [ ] Field-level validation, bounded inputs, duplicate-submit protection, and accessible feedback.
- [ ] Search/filter/sort/pagination where useful for the dataset size.
- [ ] Loading, genuinely empty, read failure, network failure, and retry states are distinct.
- [ ] Permission-denied and missing/expired-session behavior; server/RPC remains the authority.
- [ ] Tenant/business/provider scope verified with positive and negative tests.
- [ ] Keyboard navigation, labels/live regions, mobile layouts, and responsive overflow.
- [ ] Browser test for the primary happy path and at least one failure path.
- [ ] Exact-head CI evidence and link to the relevant run.

## Existing first-party module pages discovered

- Shared runtime/navigation: `web/app.js`, `web/module-blueprints.js`
- Generic operations workspaces: `web/operations-modules.js`
- Restaurant/cafe: `web/restaurant-module.js`
- Reverse bidding: `web/reverse-bidding-module.js`
- Sector catalog/rendering: `web/sector-modules.js`, `web/sector-registry.js`, `web/android-parity-catalog.js`
- Provider onboarding: `web/provider-onboarding-module.js`
- SMM: `web/smm.html`, `web/smm.js`, `web/smm.css`
- Digital pages: `web/digital-page.html`, `web/digital-page.js`, `web/digital-page-editor.html`, `web/digital-page-editor.js`
- Home/public discovery: `web/home.js`, `web/home.css`

## Confirmed limitations / next execution order

1. Inspect the module catalog and actual page routes, then reconcile aliases that share a renderer (e.g. clinics/hospitals/labs and reverse-bidding sector aliases) without treating a shared renderer as proof of equivalent authorization or UX.
2. Walk each module against the completion contract above; prioritize auth/session and public discovery, then provider profiles, order lifecycle, CRM/marketing, and remaining operational modules.
3. Do not expand subscription billing, paid ad execution, or full accounting UI in this UI-first phase.
4. Critical payment release blocker remains open: `supabase/functions/paymob-webhook/index.ts` has a MantiGO path that inserts `payment_provider_events` and updates `mantigo_financial_ledger` in separate writes. Implement a transaction-safe RPC/state machine and tests for replay, concurrency, and partial failure before production certification.
5. Release remains **BLOCKED / NOT CERTIFIED** until required security, browser, payment, backup/restore, monitoring, and release gates are verified.
