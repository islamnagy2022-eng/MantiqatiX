# MantiqatiX — Production Reconciliation Snapshot (2026-11-17)

## Executive status

**FULL_PLATFORM_GATE: BLOCKED / NOT CERTIFIED**

This is a read-only Production snapshot plus source/test reconciliation. No Production migration was executed, no table/data/Auth/RLS/GRANT was changed, no Edge Function was deployed, and no website cutover was performed.

## 1. Live migration ledger

| Check | Result |
|---|---:|
| Live migration rows | 310 |
| Latest version | `20261110150618` |
| Latest name | `revoke_public_execute_from_trigger_functions` |
| Required exact release migration IDs | 42 |
| Exact required IDs present | **0 / 42** |

The exact SQL for `20261110150618` was recovered from `supabase_migrations.schema_migrations.statements` and restored to GitHub in PR #740. Its database-side and local SHA-256 match: `b462abcd9205345901c389102992d9ee31aa6d293a5e7bb5e9f6114f0f43afed`. It is a single 374-character statement containing two direct-EXECUTE revocations. It was **not** re-applied.

RC463 source `20261031100000` exists on main but is absent from the live ledger. It must not be replayed out of chronological order.

## 2. Required object presence

A fresh read-only catalog check of the 60-object release contract found:

- **30 physically present**
- **30 physically absent**
- 32 contracts remain non-PASS when exact signatures, function bodies, search_path, grants and scope are included.

Important missing RC117 default-image objects:

- `public.mnty_default_image_url`
- `public.mnty_default_business_images_trigger`
- `public.mnty_default_catalog_item_image_trigger`
- `public.mnty_default_marketing_service_image_trigger`
- `public.businesses.mnty_business_default_images`
- `public.catalog_items.mnty_catalog_item_default_image`
- `public.marketing_services.mnty_marketing_service_default_image`
- `public.marketing_services.image_url`
- `public.marketing_services.image_source`

The `marketing_services.image_url` column was present in the 14-Nov snapshot but is absent in the 17-Nov direct `information_schema.columns` check. The 17-Nov snapshot supersedes the earlier physical-presence count.

Two other physically present objects remain blocked by contract drift: `process_verified_digital_page_payment_backend` has the wrong search_path/body/ACL contract, and `update_purchase_order_status_backend(varchar,varchar)` has `search_path=public` and no expected authenticated/service_role EXECUTE.

## 3. SECURITY DEFINER and platform-admin authorization

RC463 live trigger-function recheck:

| Function | Trigger | API-role EXECUTE | Live search_path | Result |
|---|---|---|---|---|
| `assign_default_owner_to_unowned_business()` | Enabled | anon/authenticated/service_role: false | `public, auth` | BLOCKED |
| `capture_commission_rule_audit()` | Enabled | anon/authenticated/service_role: false | empty | PASS |

Both ACLs contain only the postgres owner grant. The later `20261110150618` source only revokes PUBLIC/anon/authenticated EXECUTE; it does not set search_path and is not an RC463 alias.

The current `mnty_can_platform_admin()` helper still delegates to a tenant-level `mnty_can('admin', NULL, NULL, NULL)` check. Four global MantiGO RPCs rely on that helper. PR #742 adds the canonical `private.platform_admins` registry guard and hardens the affected RPCs, but this is source-only until a separately approved Production rollout.

## 4. Edge Function source parity

Seven live entrypoints differ from current main:

| Function | Live version | Live SHA-256 (prefix) | Status |
|---|---:|---|---|
| `order-create` | 8 | `16f9b8bb687c…` | BLOCKED |
| `payment-intent` | 8 | `d6b8faee1582…` | BLOCKED |
| `paymob-webhook` | 10 | `f26fe1580e66…` | BLOCKED |
| `digital-page-payment-intent` | 5 | `8aa3d2e9c025…` | BLOCKED |
| `subscription-payment-intent` | 4 | `4466345787ea…` | BLOCKED |
| `financial-journal` | 3 | `79ee18d0544e…` | BLOCKED |
| `directory-listings` | 16 | `13f83fcf2fae…` | BLOCKED |

The six payment/order/finance functions are coupled to missing or drifted migration/RPC/ACL contracts and must not be deployed individually. They require coordinated schema compatibility checks and real Paymob sandbox E2E.

Live `directory-listings` v16 also differs from main. The live version allows Vite development CORS origins and has doctor direct-UPSERT/BULK_IMPORT publication paths that can bypass current source-permission evidence. PR #744 carries the sanitizer and stricter publication-gate source fix on current main; it is not deployed.

## 5. Security Advisor snapshot

| Finding | Count |
|---|---:|
| RLS enabled with no policy | 9 |
| SECURITY DEFINER executable by anon | 1 |
| SECURITY DEFINER executable by authenticated | 65 |
| Leaked-password protection warning | 1 |
| Unindexed foreign keys | 132 |
| auth/RLS initplan warnings | 375 |
| Multiple permissive policies | 28 |

These are review inventories, not a claim that every item is exploitable. The anon-executable SECURITY DEFINER function is the public targeted-ad retrieval RPC and still requires an explicit output/search_path review. The 65 authenticated-executable SECURITY DEFINER functions require per-function authorization review.

## 6. Default catalog images — UI vs database

### R7 application source

R7 already implements 15 functional-sector image packs, each with 3 logo variants, 3 cover variants and 6 product/service variants: 180 curated defaults. `addBusiness` and `addProduct` assign defaults at creation time.

Existing image-engine tests passed 4/4; additional compiled-runtime checks passed all 15 sectors, five local AI assets, maintenance fallbacks and SVG text sanitization. This is candidate-source evidence only.

### Production Supabase

The server-side RC117 image helper, trigger functions, triggers and marketing-service image columns are absent. Therefore the database does not enforce defaults if a caller bypasses the UI.

The old RC117 source in closed PR #410 is not on main and is not in the live ledger. Its marketing-service backfill predicate updates rows when `image_source` is null/invalid even if `image_url` is a non-empty owner-supplied URL. That can overwrite a custom image. **Do not replay or port that migration unchanged.**

Required next implementation: a new forward-only migration after `20261110150618`, preserving custom URLs with missing source metadata as `image_source='owner'`, defaulting only truly empty/known-placeholder URLs, and testing insert/update behavior for businesses, catalog items and marketing services.

## 7. R7 archive (11) release blockers

The R7 ZIP is structurally valid, but it is not safe to import/deploy as-is. Static review found:

- local JSON snapshot remains the operational data authority rather than Supabase;
- predictable fallback secrets and a hard-coded admin password path;
- caller-controlled session-token minting and unsafe invalid-token role fallback;
- unauthenticated production-state write paths;
- browser localStorage auth restore/write;
- no standard test/release scripts;
- new business creation defaults to `paymentStatus='paid'` and `paymentConfirmedByAdmin=true`;
- registration defaults wallet balance to 1000, marks email verified, returns a verification code and uses a predictable fallback password.

These are source findings, not live endpoint execution. They remain P0 until replaced with Supabase Auth, server-side authorization, authoritative payment/subscription state and ledger-backed wallet behavior.

## 8. Completed source/test increments

- PR #740 merged: exact historical source restored; 10/10 PR workflows passed. No Production migration was re-applied.
- PR #742 merged: RC464–RC467 source hardening and tests; 14/14 exact-head PR workflows passed, including migration immutability/version uniqueness/collision guards and an 80-migration disposable replay. No Production migration or Edge Function was deployed.
- PR #744: current-main directory-listings v16 security fix candidate; exact-head CI still pending at snapshot time.

## 9. Remaining release gates

1. Implement and test the RC117 forward-only default-image repair with strict custom-image preservation.
2. Complete exact migration-ledger and physical-object reconciliation for all 42 required release versions and 60 object contracts.
3. Finish PR #744 exact-head tests and review before any separate Edge deployment.
4. Reconcile the six payment/order/finance Edge Functions with their schema/RPC/ACL prerequisites and run real Paymob sandbox E2E.
5. Secure the R7 Auth, session, persistence, payment and wallet paths before importing R7 as the canonical app.
6. Perform a genuine backup restore rehearsal; RPO/RTO remain unmeasured.

**No Production rollout is authorized by this report.**
