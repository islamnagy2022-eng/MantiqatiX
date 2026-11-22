# PASS 1811–1820 — Li2Lak verified business reviews — 2026-11-22

## Objective

Add a separate customer-review capability to Li2Lak without reusing MantiGO ride ratings. Reviews must have verified transaction provenance, moderation, business-scoped responses, bounded public output and a privacy-safe account-deletion lifecycle.

## Production facts checked read-only

- Live schema has `public.orders`, `public.businesses`, `public.user_memberships` and `public.marketing_provider_profiles`.
- `orders.id`, `businesses.id`, and `orders.business_id` are UUID; `orders.tenant_id` and `businesses.tenant_id` are varchar; `orders.customer_id` is UUID; `orders.status` is varchar; `orders.total_amount` is numeric; `orders.items_json` is jsonb.
- Membership tenant and business identifiers are varchar and UUID respectively.
- No general business review table was present at the read-only checkpoint.
- Public order count was zero at the earlier checkpoint; the feature therefore has no current delivered-order source to accept reviews from.
- No Production schema, Auth, RLS, grants, Storage, Edge, payment or wallet change was performed.

## Source implementation in PR #970

- Migration: `supabase/migrations/20261122010000_rc497_verified_business_reviews.sql`.
- `business_reviews` stores one review per order, rating 1–5, bounded review text, moderation state and one business response.
- `business_review_events` records submission, moderation and business response transitions.
- Customer submission requires a non-anonymous authenticated actor, their own DELIVERED order, a non-empty order snapshot and a matching order/business tenant.
- A unique order constraint prevents multiple reviews. An exact retry is idempotent; changed duplicate payloads are rejected.
- All reviews begin PENDING. Moderation requires direct membership in `private.platform_admins`; tenant-level ADMIN/OWNER is not a global moderation grant.
- A business response is limited to an active owner/business-owner/admin/manager scoped to the reviewed business; only one response is allowed.
- Public reads are bounded (maximum 20 rows per page), and expose only PUBLISHED reviews for ACTIVE verified businesses, without customer identity.
- Review/event tables use ENABLE + FORCE RLS and direct privileges are revoked from anon, authenticated and service_role. Four narrowly scoped SECURITY DEFINER RPCs use an empty search_path and explicit EXECUTE grants.
- Customer and event actor references use ON DELETE SET NULL so account deletion anonymizes retained review history rather than deleting it.

## Storefront integration

- Added `BusinessReviewsPanel` to the public business storefront after the catalog.
- The panel calls only `get_public_business_review_summary`, validates the returned payload, and displays a rating, bounded published review cards, and business responses.
- It renders only for ACTIVE, verified and non-frozen businesses; if the RC497 RPC is not deployed or fails, the panel fails closed and remains hidden.
- The customer order-history/review-entry flow is now implemented in `CustomerOrderReviews.tsx` and mounted in `SubscriberAccountPortal.tsx`; it reads only the authenticated customer's orders, checks review status through the owner-scoped RPC, and submits through `submit_business_review`.
- The business-owner response flow is implemented in `BusinessReviewManagementPanel.tsx` and mounted in `MerchantDashboard.tsx`; it reads published reviews through the public summary RPC and posts a single response through `respond_to_business_review`. Review rows preserve the order branch; branch-specific managers cannot respond to another branch's review.
- The platform moderation flow is implemented in `BusinessReviewModerationPanel.tsx` and mounted in `AdminDashboard.tsx`; it uses a bounded, paginated registry-protected moderation queue and moderation RPC. Tenant admins may see the tab but cannot read the queue or moderate unless they are in `private.platform_admins`. The queue omits customer identity and requires a reason for rejection/hidden decisions.
- The public storefront review panel is mounted in `App.tsx` and remains restricted to active verified businesses. No customer identity is returned by public RPCs.

## Automated tests added

- Disposable PostgreSQL 16 fixture.
- Integration tests cover own delivered order, idempotent retry, duplicate change rejection, undelivered order, foreign-customer order, order/business tenant mismatch, unverified business moderation state, tenant-role moderation denial, registry-admin moderation, audit previous-state capture, business response authorization and one-response limit, public identity-free output, direct table privilege denial, FORCE RLS, and account deletion anonymization.
- Static validator checks source security contract and exact release manifest.
- The existing forward-migration replay workflow now includes a separate RC497 PostgreSQL lifecycle job and runs the RC497 validator in the chronological replay job.

## Release ledger reconciliation

- The exact production release contract now tracks 77 migration identities, including RC497. The candidate includes six narrow review RPCs: customer status, customer submission, registry-admin moderation queue, registry-admin moderation, business-owner response, and bounded public summary.
- The retained live ledger snapshot still records zero of the 77 required exact source identifiers, with latest recorded live version `20261110150618`.
- This is a migration identity gap, not proof that every corresponding physical schema effect is absent. Physical schema, function bodies, ACLs, RLS and Edge parity must continue to be reconciled independently.
- Do not synthesize ledger entries or blindly replay migrations against Production.

## Current PR and validation

- PR #971: replacement/rebased candidate against current `main` after PR #969 merged.
- Branch: `feat/li2lak-verified-business-reviews-rebased-20261122`.
- The earlier PR #970 was closed as superseded after PR #969 advanced `main`; its source work was carried onto the rebased branch. No duplicate RC497 migration remains open.
- Latest exact-head CI must complete before merge. No test pass is claimed for the rebased branch. No Production migration or public deployment occurred.

## Release decision

**PRODUCTION BLOCKED / NOT CERTIFIED.** RC497 is a source candidate only; the live order count remains zero, so there is no real customer transaction available for an end-to-end production review test. Do not merge or deploy until exact-head CI, full chronological replay, independent backup/restore rehearsal, migration alias/physical-object reconciliation, and the broader P0 directory-consent and platform-admin authorization gates are resolved.
