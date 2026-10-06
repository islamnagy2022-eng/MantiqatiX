# RC40 → Web Production Module Reuse Matrix

Date: 2026-10-07

## Purpose
RC40 is used as a functional and UX reference source, not as an unverified production source. Current main and live Supabase contracts remain authoritative.

## Reuse rule
1. Reuse proven domain terminology, workflow and UX concepts from RC40.
2. Reuse existing current web/Supabase contracts when they already exist.
3. Do not copy Android Room persistence into the web.
4. Do not reintroduce legacy tables or direct client writes.
5. Current backend/RLS/RBAC remains authoritative.
6. Anything not runtime-tested remains NOT VERIFIED.

## RC40 functional source inventory

### Customer workspaces
- Fashion — FashionWorkspaceScreen.kt + FashionErpEngine.kt
- Grocery — GroceryWorkspaceScreen.kt
- Medical — MedicalComplexWorkspaceScreen.kt + MedicalErpEngine.kt
- Restaurant — RestaurantWorkspaceScreen.kt + RestaurantErpEngine.kt
- School/Teacher — SchoolAndTeacherWorkspaceScreen.kt + SchoolAndTeacherEngine.kt
- Jobs — JobBoardWorkspace.kt + JobsEngine.kt
- Matrimony — IslamicMatrimonyWorkspaceScreen.kt + IslamicMatrimonyEngine.kt
- Used Items — UsedItemsMarketplaceWorkspace.kt + UsedItemsEngine.kt
- Laboratory — LabWorkspaceScreen.kt + LabErpEngine.kt
- Digital Marketing — MantiqatiXDigitalMarketingWorkspace.kt
- Accounting Services — MantiqatiXAccountingServicesWorkspace.kt
- Companies — MantiqatiXCompaniesWorkspace.kt
- Factories — MantiqatiXFactoriesWorkspace.kt
- Flights/Trips — MantiqatiXFlightsTripsWorkspace.kt
- Home Maintenance — MantiqatiXHomeMaintenanceWorkspace.kt
- Legal Services — MantiqatiXLegalServicesWorkspace.kt
- Software ERP — MantiqatiXSoftwareErpWorkspace.kt

### Owner workspaces
- Restaurant ERP — RestaurantErpWorkspaceScreen.kt
- Pharmacy ERP — PharmacyErpWorkspaceScreen.kt
- Fashion ERP — FashionErpWorkspaceScreen.kt
- Clinic ERP — ClinicErpWorkspaceScreen.kt
- Laboratory ERP — LabErpWorkspaceScreen.kt

### Platform engines worth reusing conceptually
- LocationEngine.kt
- MantiqatiXBiddingEngine.kt
- NotificationEngine.kt
- SyncEngine.kt
- CommissionEngine.kt
- SettlementEngine.kt
- AnalyticsEngine.kt
- AuditTrailEngine.kt
- ModuleIsolationEngine.kt
- RbacEngine.kt
- SecurityPolicyEngine.kt
- BusinessSubscriptionEngine.kt

## Current web convergence
Already represented in current web/runtime: Restaurant, Fashion, Education, Jobs, Used Items, Reverse Bidding / Professional Services, Accounting, ERP, Factories, Trips, Matrimony, Legal, Marketing, MantiGO, Medical booking, Unified location/range adapter, and Unified Android parity catalog.

## Highest-value reuse next
1. MantiGO customer/captain UX patterns from RC40 → current secure MantiGO backend.
2. RC40 location semantics → existing web/location-adapter.js; no second GPS engine.
3. RC40 bidding domain model → current indrive_requests/indrive_bids or secure MantiGO contracts according to domain.
4. RC40 notification lifecycle → existing notification backend; delivery still requires real-device verification.
5. RC40 accounting/settlement concepts → current central financial journal/settlement core; never create a parallel ledger.
6. RC40 offline/sync concepts → only where an authoritative endpoint + idempotency + conflict policy exists.

## Privacy/security constrained reuse
- Matrimony UI concepts only through privacy-safe projections; direct contact fields must not be exposed.
- Medical UI concepts only against verified medical contracts; never create fake clinical records.
- Owner ERP concepts continue using backend-authorized operations for backend-only tables.

## Explicitly rejected reuse
- Legacy Room tables as a web persistence layer.
- Legacy direct writes copied from Android into browser JavaScript.
- Legacy mantiqatix_requests / mantiqatix_bids as a second bidding architecture where the current secure contract already exists.
- Any source behavior that bypasses current RLS/RBAC/security-definer boundaries.
- Any RC40 production-readiness claim without current runtime evidence.

## Verification status
This matrix is an implementation aid. It does not certify any module. DONE != VERIFIED.
