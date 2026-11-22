# Business Reviews — Verified Interaction Specification

Date: 2026-11-22  
Status: **DESIGN ONLY — no schema, RPC, RLS, Storage or UI implementation in this pass**  
Product reference: Li2Lak public review/rating pattern. No third-party code, copy, user content or business data is reused.

## 1. Live source evidence

Read-only Production schema inspection found no general business/storefront/product/service review table. The only rating table is `public.mantigo_ride_ratings`; it is a distinct ride/captain domain and must not be reused.

Potential review provenance sources are not interchangeable:

| Interaction source | Auth identity | Business binding | Completion evidence | Decision |
|---|---|---|---|---|
| `public.orders` | `customer_id` is nullable; require exact match to `auth.uid()` | `business_id` | Current order status transition RPC ends at `DELIVERED` | Eligible only when customer_id is non-null, matches caller, and status is DELIVERED |
| `public.medical_appointments` | `patient_id` is required | `business_id` | Current appointment status RPC supports `COMPLETED`; patient can cancel but provider roles control completion | Eligible only when patient_id matches caller and status is COMPLETED |
| `public.restaurant_orders` | No customer Auth user ID column; it has `owner_user_id` only | `business_id` | Status exists, but reviewer identity is not bound to Auth | Exclude until a separate server-authoritative customer identity contract exists |
| `public.mantigo_rides` | Customer identity is part of the MantiGO ride contract | Ride/captain | COMPLETED ride | Keep existing MantiGO rating workflow separate |

The Production status functions were inspected read-only:
- `update_order_status_backend` allows the business-side transition to `DELIVERED` only from `OUT_FOR_DELIVERY`.
- `update_medical_appointment_status_backend` permits provider-side `COMPLETED`; patient cancellation is a separate path.

## 2. V1 product scope

- Business-level reviews only. No product/service-level review until canonical order-line identity and item-to-business provenance are verified.
- Eligible sources: delivered standard orders and completed medical appointments only.
- Reviewer identity is always derived from `auth.uid()`; never accept a client-supplied reviewer ID.
- Business ID is derived from the verified source interaction; do not accept an arbitrary target business from the client.
- One review per eligible source interaction. A user may review again only after a separate qualifying interaction.
- Rating range: integer 1–5. Text is optional and length-bounded.
- No self-review: the reviewer cannot own/control the target business under the active membership/owner contract.
- No anonymous reviews, fabricated purchases, imported testimonials, or synthetic aggregate scores.

## 3. Proposed persistence contract

Proposed `public.business_reviews` columns:
- `id uuid primary key`
- `business_id uuid not null references public.businesses(id)`
- `reviewer_user_id uuid not null references auth.users(id)`
- `order_id uuid null references public.orders(id)`
- `medical_appointment_id text null references public.medical_appointments(id)`
- `rating smallint not null check (rating between 1 and 5)`
- `body text null`
- `status text not null` with a controlled lifecycle such as PENDING, PUBLISHED, HIDDEN, REJECTED
- `created_at`, `updated_at`, `published_at`
- owner response fields: response text, responder user ID, responded_at
- moderation fields: moderator user ID, moderated_at, moderation reason
- source provenance remains immutable after insert.

Required constraints/indexes:
- Exactly one of `order_id` or `medical_appointment_id` is non-null.
- Unique partial index on `order_id` where not null.
- Unique partial index on `medical_appointment_id` where not null.
- Index `(business_id,status,created_at desc)` for public review retrieval.
- Index `(reviewer_user_id,created_at desc)` for abuse/rate-limit controls.
- RLS enabled and FORCE RLS; no direct anon/authenticated table grants. Reads and writes use narrow RPCs only.

A separate `business_review_reports` relation should capture reviewer, review, reason, status and timestamps with one report per reviewer/review. It must not expose reporter identity publicly.

## 4. RPC boundaries

1. `create_business_review_backend(source_type, source_id, rating, body)`
   - authenticated only; reject anonymous Auth identities.
   - derive reviewer from `auth.uid()`.
   - lock and verify source row; require DELIVERED order or COMPLETED appointment.
   - derive business ID from source; reject mismatched customer/patient identity and self-review.
   - enforce one review per source interaction, body bounds, rate limits and audit.
   - initial status PENDING; publication is not automatic until moderation policy is finalized.

2. `update_business_review_backend(review_id, rating, body)`
   - reviewer ownership check; fixed edit window must be product-approved.
   - never change reviewer, business, source interaction or creation provenance.
   - append audit event for every edit.

3. `respond_business_review_backend(review_id, response)`
   - require active OWNER/BUSINESS_OWNER/ADMIN membership scoped to the review business.
   - one current business response; all edits audited.

4. `moderate_business_review_backend(review_id, decision, reason)`
   - require canonical private platform-admin registry authority, not mutable SUPER_ADMIN membership flags.
   - decisions limited to PUBLISH/HIDE/REJECT; audit every decision.

5. `list_public_business_reviews(business_id, cursor, limit)` and `get_public_business_review_summary(business_id)`
   - return only PUBLISHED, non-deleted reviews and safe display fields.
   - aggregate only published reviews; clamp limits and use stable keyset pagination.
   - no reporter identity, internal moderation notes, source order details or private customer data.

6. `report_business_review_backend(review_id, reason)`
   - authenticated only; deduplicate reports per reviewer/review; rate-limit; do not let reporting directly hide content.

## 5. Moderation and abuse controls

- Publish policy, prohibited content and response policy must be written before enabling the public UI.
- Use a moderation queue and audit log; do not silently delete evidence.
- Rate-limit create/report operations per authenticated user and source interaction.
- Business responses are scoped to the same active business and never reveal reviewer private data.
- Public rating average and count are derived only from PUBLISHED rows; no cached aggregate may be trusted without a transactional refresh/reconciliation design.
- Define edit window, retention, appeal, dispute and legal deletion behavior before migration approval.

## 6. Required disposable PostgreSQL tests

- positive DELIVERED order review by its actual customer;
- positive COMPLETED appointment review by its actual patient;
- reject PENDING/CREATED/CONFIRMED/PREPARING/OUT_FOR_DELIVERY/CANCELLED order states;
- reject CONFIRMED/CANCELLED/NO_SHOW appointment states;
- reject anonymous Auth, forged reviewer ID, forged business ID and cross-tenant interaction;
- reject restaurant order until customer Auth identity is authoritative;
- reject self-review and duplicate source interaction;
- concurrent duplicate submissions produce one row;
- owner response allowed only for active scoped business membership;
- unrelated business owner and branch staff cannot respond outside scope;
- moderation only by private registry platform admin; legacy SUPER_ADMIN membership alone is insufficient;
- public list/summary expose only published safe fields and never expose source/customer private data;
- edit window, rate limit, report deduplication, audit completeness and rollback.

## 7. Release gates

- This spec does not authorize a Production migration or enablement.
- Additive migration must be timestamped after the existing release chain, update the exact migration gate/manifest, and pass chronological PostgreSQL 17 replay.
- Verify the full RC484/RC485 authorization dependency first; review moderation must use the protected platform-admin registry.
- No browser-side table writes. No UI star widget until the authoritative backend contract and tests are merged.
- Keep Production **BLOCKED / NOT CERTIFIED** until the coordinated migration, Edge/RPC parity, backup/restore and live authorization tests pass.
