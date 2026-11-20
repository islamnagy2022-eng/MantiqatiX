# Pass 1390–1399 — First 20 direct-auth SECURITY DEFINER function review

**Date:** 2026-11-20  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Method:** read-only PostgreSQL function definitions, schema metadata, ACL checks, source migration/test inspection and exact-head CI review. No application rows selected, no RPC invoked, no Production mutation.

## 1. Review scope

This pass manually reviewed the first 20 of the 59 authenticated-callable SECURITY DEFINER functions whose bodies contain a direct `auth.uid()` reference. It supplements Pass 1380–1389's six delegated-path review; it does not certify all 65 functions.

## 2. Function-by-function findings

### Functions 1–10

- `accept_mantigo_bid_backend`: actor ID is bound to `auth.uid()`; caller must own the ride; ride must be OPEN/OPEN_FOR_BIDS/MATCHING. **State invariant gap:** selected bid is loaded without checking `b.status='OFFERED'`, and final UPDATE accepts it regardless of prior status. The bid schema permits OFFERED/ACCEPTED/REJECTED/WITHDRAWN/EXPIRED. A same-ride REJECTED/WITHDRAWN/EXPIRED bid could be promoted while ride remains open. P1 Issue **#912** opened; no row/function invocation.
- `adjust_catalog_stock_backend`: rejects anonymous sessions; checks active membership, tenant/business/branch scope, active business/branch/warehouse, warehouse branch, active product and product branch; uses advisory lock, balance row lock and idempotency reference. Platform SUPER_ADMIN is accepted through membership metadata but operation remains bound to explicit tenant/business/branch resources.
- `admin_create_global_ad`: relies on `mnty_can_platform_admin()`; remains affected by RC464/RC471 live helper drift tracked in P0 **#867**.
- `claim_digital_page_payment_intent_backend`: binds caller to order owner, checks idempotency key/payment state, row-locks order, and enforces a time-limited claim token.
- `confirm_mantigo_cash_payment_backend`: binds actor to customer, locks the financial row, requires payment status REQUIRED, and applies idempotent cash-confirmation state transition.
- `create_catalog_warehouse_backend`: rejects anonymous sessions; validates active membership, business/tenant, branch/business, active business and active branch before insert.
- `create_education_request_backend`: rejects anonymous sessions; validates target type and target availability; stores requester as `auth.uid()`.
- `create_indrive_bid_backend`: binds actor to supplied user ID; requires an existing open request, excludes request owner, and inserts a bid. Provider display name/type are caller-provided presentation values; no authorization conclusion is drawn from them.
- `create_indrive_request_backend`: binds actor to supplied user ID; enforces required text and idempotency key; idempotent lookup is owner-scoped; new request owner is `auth.uid()`.
- `create_job_backend`: binds actor to supplied user ID and requires ACTIVE membership in the exact tenant/business before creating the job.

### Functions 11–20

- `create_mantigo_bid_backend`: binds actor; requires active, verified, available captain profile; ride must be open and vehicle category must match; bid is created/replayed as OFFERED.
- `create_mantigo_ride_backend` and `create_mantigo_ride_backend_v2`: bind actor to `auth.uid()`; V2 validates coordinates and owner-scoped idempotency. Neither body explicitly rejects anonymous Auth JWTs; determine whether guest/anonymous ride creation is an approved product contract before changing.
- `create_medical_appointment_backend`: binds patient to `auth.uid()`; requires active provider and active tenant membership; checks doctor/time conflict. A unique partial index `uq_medical_appointment_active_doctor_slot(doctor_id,date_time)` protects concurrent active-slot booking.
- `create_payment_intent_backend`: rejects anonymous sessions; locks order; validates tenant/order state, customer ownership or active membership, pricing snapshot, amount/currency/provider/payment method and owner-scoped idempotency conflict.
- `expire_stale_mantigo_rides_backend`: actor ID is bound, but broad membership role list authorizes global stale-ride expiry. RC471 source replaces this with registry-backed platform-root authorization; live Production remains old. Tracked in P1 **#92** and **#94**.
- `finalize_digital_page_payment_intent_backend`: binds caller to order owner and requires matching claim token/order state before updating only that owner's order.
- `fulfill_digital_page_publish`: binds actor, checks PAID order, page owner/type/business scope and idempotent published state; platform gate depends on weak live `mnty_can_platform_admin()`, tracked in P0 **#867**.
- `get_mantigo_admin_dashboard_backend`: binds supplied admin ID to actor, but broad membership role list permits global ride/financial totals. RC471 source hardens to registry-backed platform root; live remains old. Tracked in **#94**.
- `get_mantigo_admin_financial_report_backend`: binds supplied admin ID, but broad membership roles permit global financial report. It also references legacy `amount`/`captain_amount` columns absent from live ledger; RC471 source uses `gross_amount`/`captain_net_amount`. Tracked in **#118** and **#94**.

## 3. Additional live MantiGO source-parity findings

The first 20-function review rechecked three already-implemented source repairs that remain unapplied:

- **RC476 captain earnings:** live `get_mantigo_captain_earnings_backend` references `l.amount` and `l.captain_amount`; the live ledger has only canonical `gross_amount`, `commission_amount`, and `captain_net_amount`. The function will fail when its aggregation runs. RC476 `20261118050000` replaces it with canonical columns and preserves caller/profile checks. P1 Issue **#914** opened.
- **RC477 customer bid contact privacy:** live `list_mantigo_customer_rides_backend` returns `jsonb_agg(to_jsonb(b))` for all bids. The bid relation includes captain phone and vehicle plate, so those fields are exposed before acceptance. RC477 `20261118060000` masks phone/plate until bid status ACCEPTED. P1 Issue **#913** opened.
- **RC471 global MantiGO admin functions:** live dashboard, financial report, stale-ride expiry and other global operations still accept broad tenant membership roles; RC471 source replaces these checks with canonical platform-root authority and uses current ledger columns. Issues **#92**, **#94**, **#118** updated.

Source/CI evidence:
- RC476/RC477/RC478 merged in PR #793; forward replay run **44239964551** passed.
- RC477 privacy integration run **44237312712** passed.
- RC478 privacy integration run **44239964164** passed.
- RC467/RC471 static authorization validation and integration/replay are recorded in runs **44239964551** and **44048037021**.
- These are isolated CI/replay results, not Production application evidence.

## 4. Release state and next work

Fresh live migration ledger: **310** rows through `20261110150618`; RC464/RC467/RC471/RC476/RC477/RC478/RC484 are absent. Existing source repairs are merged and tested, but Production is not migrated.

Next:
1. Keep P0/P1 issues #867, #884, #911, #912, #913, #914, #92, #94 and #118 open until coordinated release and live verification.
2. Continue full-body signature-by-signature review of the remaining **39** direct-`auth.uid()` functions and all transitive helpers.
3. Resolve the `accept_mantigo_bid_backend` OFFERED-state invariant with forward-only migration and adversarial disposable tests.
4. Complete encrypted backup/restore, migration/Edge parity, rollback, payment/finance/privacy E2E before any Production rollout.
5. Post-deploy verify exact live bodies, owners, SECURITY DEFINER/search_path, effective ACL, and behavior.

No Production DDL/DML, GRANT, RLS, Auth, Storage, Edge, payment, wallet, settlement, or deployment mutation occurred.
