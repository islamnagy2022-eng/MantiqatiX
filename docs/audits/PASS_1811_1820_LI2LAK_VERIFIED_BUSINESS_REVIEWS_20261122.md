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
- Customer order-history/review-entry, business-owner response, and platform-admin moderation UIs are now present in source. End-to-end completion remains unverified until exact-head CI and production-compatible integration tests pass. Guest WhatsApp-only requests remain intentionally untracked.

## Customer order and review journeys added

- Added `get_customer_business_review_status(uuid)`: authenticated-only, checks that the supplied order belongs to `auth.uid()`, returns only that customer's own review status and never returns another customer's review identity or text.
- Added a customer account portal section that reads at most 50 own orders through the existing `orders_customer_select_own` RLS path. It checks review status only for DELIVERED orders and offers a 1–5 star review form only when the customer has not already reviewed that order.
- Added `BusinessReviewManagementPanel` to the merchant dashboard. It reads the bounded public summary and uses only the business-scoped `respond_to_business_review` RPC for one-time replies; server authorization remains authoritative.
- Added `get_platform_business_review_moderation_queue(integer)`: bounded to 50 PENDING reviews, requires direct `private.platform_admins` registry membership, returns business/review content without customer identity, and is granted only to authenticated callers.
- Added the moderation queue tab to the platform AdminDashboard. Publish, reject and hide decisions use the registry-gated moderation RPC; reject/hide require a reason.
- The public storefront review panel remains limited to active, verified businesses.

## Persisted checkout convergence

- Live read-only inspection confirmed `order-create` is ACTIVE version 8 with `verify_jwt=true`; the production `create_order_backend` RPC is SECURITY DEFINER and is not executable by anon/authenticated clients directly.
- The cart now invokes the existing `order-create` Edge Function only for authenticated sessions with a resolved Supabase user ID. It sends canonical catalog item IDs, quantities and a client idempotency key; it does not send authoritative totals.
- The Edge Function remains responsible for validating identity, customer membership, active business/provider, branch/catalog availability and current server-side prices before persisting the order through `create_order_backend`.
- After persistence, the order ID is appended to the WhatsApp message. The customer portal can then display the order and expose review submission only after the authoritative status becomes DELIVERED.
- Guest WhatsApp-only requests remain possible but are explicitly not represented as persisted/tracked orders and cannot receive verified reviews.
- The cart preserves the same order ID/idempotency key on an uncertain retry of the same payload; a changed cart/customer/address generates a new attempt.
- This UI integration uses the existing deployed Edge Function without replacing or deploying it. The deployed Edge Function and migration were not modified.

## Automated tests added

- Disposable PostgreSQL 16 fixture.
- Integration tests cover own delivered order, customer-only review-status lookup, foreign-order status privacy, idempotent retry, duplicate change rejection, undelivered order, foreign-customer order, order/business tenant mismatch, unverified business moderation state, tenant-role moderation denial and queue denial, registry-admin moderation and pending-queue privacy, audit previous-state capture, business response authorization and one-response limit, public identity-free output, direct table privilege denial, FORCE RLS, and account deletion anonymization.
- Static source validation covers the customer account review form, merchant response panel, platform moderation panel, storefront integration, and persisted cart checkout contract.
- Static validator checks source security contract and exact release manifest.
- The existing forward-migration replay workflow now includes a separate RC497 PostgreSQL lifecycle job and runs the RC497 validator in the chronological replay job.

## Release ledger reconciliation

- The exact production release contract now tracks 77 migration identities, including RC497.
- The retained live ledger snapshot still records zero of the 77 required exact source identifiers, with latest recorded live version `20261110150618`.
- This is a migration identity gap, not proof that every corresponding physical schema effect is absent. Physical schema, function bodies, ACLs, RLS and Edge parity must continue to be reconciled independently.
- Do not synthesize ledger entries or blindly replay migrations against Production.

## Current PR and validation

- PR #970: https://github.com/islamnagy2022-eng/MantiqatiX/pull/970
- Branch: `feat/li2lak-verified-business-reviews-20261122`.
- Latest verified branch commit at report time: `55fc8c01d145a408bd9ca5f5632524a019136034`.
- GitHub connector returned no workflow runs or combined statuses for this exact head at the last check; this is not a pass. The branch is one commit behind main and PR mergeability remains false despite manual reconciliation of overlapping workflow/manifest/continuity files. Fresh exact-head CI and a clean base synchronization are required before merge. No test pass is claimed.
- PR remains unmerged. No public deployment occurred.

## Release decision

**PRODUCTION BLOCKED / NOT CERTIFIED.** RC497 is a source candidate only. Do not merge or deploy until exact-head CI, full chronological replay, independent backup/restore rehearsal, migration alias/physical-object reconciliation, and the broader P0 directory-consent and platform-admin authorization gates are resolved.

## Pass 1821–1830 addendum — full Li2Lak review workflow

- Customer order history and review submission are mounted in the account portal. Orders are read under the customer's own RLS scope; only DELIVERED orders can be reviewed.
- A new authenticated-only RPC returns only the current customer's review state for an order they own.
- Merchant dashboard now has a review tab; business responses use the existing business-scoped one-response RPC.
- Admin dashboard now has a moderation tab backed by a 50-row, direct-platform-registry-only pending queue. Customer identity is excluded; reject/hide require a reason.
- Authenticated cart checkout now calls the existing active `order-create` Edge Function (live version 8, JWT verification enabled), with canonical catalog item IDs, quantities and idempotency key. The browser does not supply authoritative totals. The resulting order ID is included in the WhatsApp message.
- Guest WhatsApp-only checkout remains intentionally untracked and is not eligible for verified reviews.
- Additional source inspection found that the deployed `order-create` v8 bundle is not byte-identical to current main source. This integration uses its existing verified request contract and does not redeploy or replace the function.
- The RC497 migration, fixture, integration tests, static validator, release manifest and CI workflow were updated to include customer status privacy, moderation queue privacy and the complete customer/merchant/admin UI.
- Exact-head CI is still unavailable; no tests are claimed PASS. Production remains blocked pending clean branch synchronization, exact-head CI, backup/restore rehearsal and the P0 security release gates.
- **Production effect: NONE.** No Production migration, Auth/RLS/GRANT, Storage, Edge deployment, payment, wallet, customer data or public deployment was changed.
