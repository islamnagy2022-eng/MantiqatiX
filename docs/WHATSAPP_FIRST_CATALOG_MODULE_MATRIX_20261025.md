# WhatsApp-first shared catalog — module integration matrix

Date: 2026-10-25
Branch: feat/digital-page-self-service-20261025
Status: inventory snapshot based on source inspection; not a release certification.

## Shared engine contract
The common UI helpers are in web/catalog-experience-engine.js. The main web bootstrap loads it before app.js. It provides safe rendering helpers, WhatsApp URL construction, feature-state labels and sector profiles. It must not become a parallel source of business/catalog data or replace sector authorization, orders, bookings, inventory, medical/privacy or finance rules.

## Sector/module matrix

| Sector / module | Existing canonical area/source observed | Current integration state | First-launch handling |
|---|---|---|---|
| Digital self-service page | digital_pages, digital_page_sections, digital_page_orders and existing RPC/Edge Function contracts | PARTIAL — owner page editor and WhatsApp product request exist | Continue as the initial general catalog surface; pending subscription request uses manual review; no online collection |
| Restaurants / cafés | restaurant_menu_items and existing restaurant workspace; RC570 candidate binds a published MENU page to a branch | PARTIAL — menu-to-public-WhatsApp catalog path exists in PR; exact-head migration replay and browser/RLS E2E still required | Preserve variants/add-ons, availability, opening hours, branch binding, kitchen and canonical order workflows |
| Marketing company-services page | marketing-services.html placeholder | DEFERRED — public request form disabled; page marked noindex and under construction | Keep unavailable in first launch; focus on digital product catalogs |
| Grocery / supermarket | operations module uses catalog_items, catalog_item_prices, inventory_transactions and orders | PROFILE ONLY / ADAPTER NOT VERIFIED | Reuse canonical catalog and inventory; do not create duplicate products; validate price/stock and keep existing order path if enabled |
| Fashion / retail | sector-modules.js uses fashion_products, fashion_orders and fashion_tailor_services | PROFILE ONLY / ADAPTER NOT VERIFIED | Preserve sizes, variants, inventory, returns and tailoring workflows |
| Pharmacy | Canonical sector code PHARMACY exists; engine profile is present | PROFILE ONLY / ADAPTER NOT VERIFIED | Public information only where permitted; no unsupported prescription/controlled-product ordering; pharmacist review remains authoritative |
| Doctors / clinics / dental | HEALTH, MEDICAL and DENTAL sector codes/profiles exist | PROFILE ONLY / ADAPTER NOT VERIFIED | Preserve credential, patient privacy and existing booking/appointment paths; no diagnosis via public catalog |
| Hospitals | HOSPITAL sector/profile exists | PROFILE ONLY / ADAPTER NOT VERIFIED | Departments and service information only; emergency routing must not be replaced by ordinary WhatsApp inquiry |
| Labs / radiology | LABS and RADIOLOGY sector/profile exists | PROFILE ONLY / ADAPTER NOT VERIFIED | Preserve preparation, referral, booking and results privacy |
| Companies / freelancers / maintenance | Canonical sectors and engine profiles exist; related operations areas exist | PROFILE ONLY / ADAPTER NOT VERIFIED | Quote-based services must not invent fixed prices; retain contracts, scheduling and approvals |
| Education / jobs / used items | sector-modules.js has dedicated existing screens and canonical tables | NOT TARGETED FOR SHARED CATALOG UNTIL CONTRACT REVIEW | Keep specialized application/request lifecycle; only adopt public catalog where it fits without changing workflow |
| SMM digital services | Separate web/smm.html and web/smm.js, service/order/wallet/provider-gateway paths | SEPARATE MODULE — NOT PART OF SHARED CATALOG | Preserve existing digital-service selling functionality. Audit each unfinished SMM feature; mark only incomplete parts "تحت الإنشاء". Keep provider/payment safety boundaries intact |
| Sponsored ads | Existing public advertising entry points and campaign workspace | DEFERRED FOR FIRST LAUNCH | Label "تحت الإنشاء", disable new paid-promotion purchase/booking paths; do not remove internal records or unrelated features |
| Accounting / commissions / settlements for WhatsApp-first orders | Existing finance modules serve other platform flows | DEFERRED FOR NEW FLOW | Do not add new commissions or settlements for WhatsApp-only inquiries; do not disable existing finance functions elsewhere |
| Paymob collection for WhatsApp-first catalog | Existing Paymob integration serves other supported flows | DEFERRED FOR NEW FLOW | No checkout/payment intent in the new catalog path; do not alter existing Paymob flows elsewhere |

## Required adapter fields before a sector can be marked ready
- Actual route/page and owner dashboard entry point.
- Authoritative tables/views/RPCs/Edge Functions (verified from code and permissions).
- Publicly allowed fields and safe image URL rules.
- Owner CRUD and tenant/business/branch scope.
- Price mode: FIXED / STARTING_FROM / QUOTE / HIDDEN.
- Request mode: WHATSAPP / EXISTING_BOOKING_FLOW / EXISTING_ORDER_FLOW / INFORMATION_ONLY.
- Sector-specific notices, regulated actions and publication rules.
- Feature status for every tab/action: READY / UNDER_CONSTRUCTION / BLOCKED / NOT_VERIFIED.
- Automated source-contract test plus authenticated multi-user RLS and browser/mobile E2E.

## Subscription notices
- In-app dashboard reminders display based on recorded paid timestamp and product duration, with urgency states for 7 days, 3 days, 1 day and expired.
- This is not evidence of scheduled push/email. Background dispatch remains NOT VERIFIED until the existing notification infrastructure is inspected, a safe idempotent scheduler is implemented if needed, and delivery/deduplication/tenant-isolation tests pass.

## Launch decision
Do not claim the shared engine is applied to all sectors yet. The first release scope is the digital self-service product catalog and restaurant/café menu path only. The company marketing-services page is explicitly deferred and must not be promoted in public navigation. Integrate the remaining sectors through explicit adapters in prioritized batches; preserve existing sector workflows and mark unready UI "تحت الإنشاء".
