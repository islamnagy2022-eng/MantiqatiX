# Pass 1430–1439 — Final direct-auth SECURITY DEFINER review and release gates

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only full function definitions, schema metadata, indexes/constraints, helper graph and effective privileges. No application rows selected; no RPC invoked; no Production mutation.

## 1. Final 9 direct-auth functions (51–59 of 59)

- `submit_mantigo_captain_application(...)`: binds supplied captain ID to `auth.uid()`; validates vehicle fields and service-area array; idempotently returns existing profile; rejects resubmission after REJECTED; new profiles start PENDING/PENDING/OFFLINE and are audit logged. It does not explicitly reject anonymous Auth JWTs; verify whether anonymous sign-in is enabled and whether pending applications should accept anonymous accounts before tightening.
- `update_catalog_item_status_backend(...)`: validates ACTIVE/INACTIVE, tenant/business/branch role scope, active branch and item ownership; uses advisory transaction lock to enforce 150 active item cap on reactivation. Its platform-wide SUPER_ADMIN membership branch is a legacy global-root path and is included in the seven catalog RPCs reported to P0 #867.
- `update_mantigo_captain_presence_backend(...)`: binds caller to own captain profile; validates availability enum and coordinate ranges; updates only own profile and audit log. It does not require ACTIVE/VERIFIED before setting AVAILABLE, but ride matching and open-ride access separately require ACTIVE/VERIFIED/AVAILABLE.
- `update_mantigo_trip_status_backend(...)`: binds actor; locks ride; derives customer and accepted driver; enforces actor-specific state transitions and payment confirmation before STARTED/COMPLETED; audits and notifies the counterparty.
- `update_medical_appointment_status_backend(...)`: P1 #921. It binds actor and locks appointment but permits any SERVICE_PROVIDER member in the same tenant/business to change appointments for any provider; it does not bind `doctor_id` to `marketing_provider_profiles.owner_user_id`. It also accepts any allowed target status without validating `v_old` transition.
- `upsert_catalog_business_profile_backend(...)`: rejects anonymous sessions; validates field lengths, HTTPS logo/cover URLs, business-wide owner/admin role, active business and exact active branch; row-locks business and merges profile JSON without overwriting unrelated settings. The separate `catalog_public_enabled` flag is intentionally not changed here (static validator protects against stale-client snapshot overwrites).
- `upsert_catalog_item_backend(...)`: checks authenticated membership and tenant/business/branch scope, finite tax rate, item type, HTTPS image URL and metadata limits; serializes item creation per business and enforces 150 active item cap; update is constrained to item branch or authorized business-wide item.
- `upsert_catalog_price_backend(...)`: validates actor membership, tenant/business/item, branch, finite non-negative price and currency; P2 #922 because MAX(version)+1 is computed without a lock and table has no unique (catalog_item_id, branch_id, version) constraint.
- `upsert_catalog_settings_backend(...)`: rejects anonymous sessions; requires business-wide OWNER/ADMIN/BUSINESS_OWNER or legacy platform SUPER_ADMIN; validates currency and finite non-negative delivery fee; uses business_id upsert.

## 2. New findings recorded

- **P1 #921 — Medical appointment provider ownership and transition gap:** SERVICE_PROVIDER membership is not tied to the appointment's assigned provider profile, and previous status is not used to validate transitions. No appointment/patient rows were read.
- **P2 #922 — Catalog price version race:** no lock or unique index protects version allocation; no price rows were read.
- **P2 #919 — Inactive job applications:** submit RPC checks job existence but not `jobs.is_active`; duplicate application race is already protected by unique index.
- **P2 #917 — Employee/position branch mismatch:** business-wide manager can pair branch-specific position with NULL-branch employee/membership; least-privilege/data consistency, not demonstrated privilege escalation.
- **P0 #867 — Seven catalog RPCs also use legacy SUPER_ADMIN membership flags instead of `private.platform_admins` for their global bypass:** `adjust_catalog_stock_backend`, `create_catalog_warehouse_backend`, `update_catalog_item_status_backend`, `upsert_catalog_business_profile_backend`, `upsert_catalog_item_backend`, `upsert_catalog_price_backend`, `upsert_catalog_settings_backend`. No membership rows were queried; existence of an active legacy non-registry account is not asserted.

## 3. Final 65-function inventory reconciliation

Fresh catalog aggregate:
- **65** authenticated-callable public SECURITY DEFINER functions.
- **59** direct `auth.uid()` functions, now reviewed by signature/body in Pass 1390–1439.
- **6** without direct `auth.uid()`, reviewed by delegated-path tracing in Pass 1380–1389.
- **65/65** have explicit function-level `search_path`.
- **1** is also anon-callable: intentional targeted-ad discovery RPC, reviewed as a constrained public read contract.

The full 65-function manual review is now complete. This does not mean the platform is certified: multiple authorization, privacy, schema-drift and state-machine findings remain open and source repairs must be applied/verified.

## 4. Production release blockers

Live Production migration ledger remains **310** rows through `20261110150618`; required release migration IDs including RC464/467/471/476/477/478/484 remain absent. Confirmed source repairs and tests are merged/CI-green but unapplied:
- P0 #867: platform root helper/callers and legacy catalog global-root paths.
- P1 #884: commission authorization RC467.
- P1 #911: open-ride privacy RC478.
- P1 #913: customer bid contact privacy RC477.
- P1 #914: captain earnings ledger columns RC476.
- P1 #912: selected bid must be OFFERED before acceptance.
- P1 #921: medical provider ownership/status transitions.
- P2 #917: employee/position branch scope alignment.
- P2 #919: reject applications to inactive jobs.
- P2 #922: serialize catalog price version allocation.
- P1 #92/#94/#118: MantiGO global admin, expiry, settlement and financial report paths.

Production remains **BLOCKED / NOT CERTIFIED** until encrypted DB+Storage backup, Vault recovery, independent PG17 restore/rollback with measured RPO/RTO, full ordered migration and Edge parity, sandbox payment/finance/privacy E2E, release approval and post-deploy live verification all pass.

No application rows, identities, membership records, patient data, customer locations, captain contact details, catalog prices, job applications or financial rows were selected. No RPC was invoked. No Production DDL/DML, grants, RLS, Auth, Storage, Edge, payment, wallet, settlement or deployment mutation occurred.
