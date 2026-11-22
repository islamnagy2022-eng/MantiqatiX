# Website-first release plan and post-launch backlog
**Updated:** 2026-11-22  
**Target:** MantiqatiX public catalog as the website root  
**Release status:** NOT RELEASED / NOT CERTIFIED

## 1. Release decision

Prioritize a bounded public website release first. The pre-launch scope includes the public catalog/business-discovery experience and monthly subscriptions only. Li2Lak, Paymob integration, and all non-monthly financial/accounting workflows are explicitly post-launch. This is not a certification of every MantiqatiX module.

The existing Pages workflow already separates the full-platform gate from the scoped catalog pilot: when the full-platform verifier reports BLOCKED, it may continue only if the catalog-pilot gate has passed. Preserve that separation. Do not weaken or rewrite the 76-migration full-platform gate to make the website pass.

The published Pages composition is:
- Root: apps/catalog-frontend, the primary public catalog.
- /legacy/: retained legacy catalog copy for rollback/reference.
- /v6-preview/: explicitly a preview, not the production root.

Do not merge PR #971 into the first website release. It contains Li2Lak order/review/payment-source work and must remain a separate post-launch track.

## 2. First-release scope

Include only features whose production contracts are verified:
- Public activity/business discovery and search.
- Public business pages and catalog item/service display.
- Geographic/business profile display using approved public fields.
- Existing approved showcase/catalog content and public imagery.
- Owner sign-in and the already-supported basic catalog management path, after the contact-consent endpoint is aligned with the frontend.
- Monthly subscription plans, subscription status/entitlement checks, and only the already-existing verified monthly renewal/activation path. Do not add a new payment provider integration to V1.
- Public numeric prices only where the existing explicit catalog-public price flag allows them.

Do not certify or promote as live:
- All Li2Lak marketplace workflows: tracked checkout, orders, status transitions, reviews, merchant responses/moderation, delivery assignment and proof of delivery.
- Paymob integration changes, new Paymob intents/webhooks, digital payments outside the already-approved monthly subscription path, and settlement flows.
- All non-monthly financial/accounting workflows: commission accrual, financial journal, wallet, payouts, refunds, reconciliation and settlements.
- MantiGO ride lifecycle or ratings.
- Unclaimed directory-listing contact disclosure.
- Activity-module administrative writes; the current frontend correctly keeps this disabled pending atomic audit.

If a surface depends on the separate directory-listings endpoint, keep that surface out of the V1 navigation until its consent and source-rights release is complete. The public-catalog-directory endpoint is a separate catalog feed and must still pass its own privacy smoke test.

## 3. Verified live evidence and launch blockers

### P0 — public contact disclosure parity

Production Supabase project: moyhiluyhjsujhwlyeuu.

Direct live Edge inspection on 2026-11-22:
- public-catalog: ACTIVE v9, verify_jwt=false. The full deployed bundle matches current main byte-for-byte and uses the audited-contact projection.
- public-catalog-directory: ACTIVE v19, verify_jwt=false. The full deployed bundle matches current main byte-for-byte and uses the audited-contact projection.
- catalog-admin: ACTIVE v20, verify_jwt=false. The deployed source differs from current main and has no public-contact consent audit handling.
- catalog-platform-admin: ACTIVE v23, verify_jwt=true; its activity-module override write capability remains intentionally disabled until its audit write is atomic.

Current main already contains the fail-closed helper and owner consent flow:
- Public contact is blank unless both public_contact_enabled and public_contact_consent_audit_verified are true.
- The main-branch merchant dashboard contains an Arabic explicit-consent checkbox, but the website-first branch hides it until the Production catalog-admin audit endpoint is safe to deploy.
- The current-main catalog-admin candidate records a durable audit_logs row only after its registry-backed authorization prerequisites are deployed. Production v20 does not have this handler.
- Revocation returns the profile to a hidden state.

Aggregate-only live database inspection:
- 10 active public catalog businesses and 10 active branches.
- 10 active branches have a phone; 7 have an address.
- 2 business profiles contain contact fields.
- 0 of the 10 public businesses currently have both explicit-consent flags enabled.
- The Qadam pilot business is ACTIVE and publicly enabled, with 15 active catalog items and 12 active price rows; three active items are intentionally contact-for-price.

Therefore the first safe release must not expose existing phone/address values by default. Until an owner grants audited consent, the contact fields remain hidden. The client-side mapper already suppresses public phone/address without audited consent, but that is not sufficient: the Edge response itself must not return the data.

Database prerequisites for the current-main consent handler were checked read-only:
- audit_logs exists with the required actor/action/entity/old/new/result fields and created_at default.
- service_role has INSERT on audit_logs; anon and authenticated do not.
- the canonical upsert_catalog_business_profile_backend RPC exists.
- public.mnty_can_platform_admin() exists.
No database migration or production data mutation was performed for this check.

**Completed bounded Edge actions:** deployed public-catalog v9 and public-catalog-directory v19 from current main with all shared dependencies, preserving verify_jwt=false; both bundles were read back and matched source exactly. Kept catalog-admin v20 untouched because current main assumes registry-backed authorization that Production does not yet have. The owner public-contact consent switch is hidden in V1. The two safe public projections now return blank contact fields unless both audited consent flags are true.

### P0 — separate directory-listings surface

The separate directory-listings Edge Function is now ACTIVE v18 with verify_jwt=false and returns an empty-success GET response and fixed HTTP 503 for POST, with mutation error marker DIRECTORY_LISTINGS_DISABLED_FOR_V1. Its deployed entrypoint was read back and matches the branch stub; it has no Supabase client import or table reads. The frontend does not request unclaimed rows and ignores direct ?listing= routes. The production table public.directory_listing_contact_consents is absent.

Do not restore the old directory bundle or apply RC473 alone. Bring the feature back only after RC472/RC473 are reconciled in order, a consent-aware complete Edge bundle is deployed and tested, owner grant/revoke audit works, and the third-party dataset source/licence review passes.

### P0 — stale live-release evidence

The release manifest and pilot verifier are refreshed to the actual Production versions: public-catalog v9 and public-catalog-directory v19 byte-for-byte match current main; directory-listings v18 is a deliberate fixed-503 disabled endpoint; catalog-admin v20 and catalog-platform-admin v23 are preserved as explicit drift/deferred exceptions. Do not mark admin parity true or deploy the consent candidate before registry authorization is safe.

After the Edge rollout:
1. Read back each live function and compare every deployed source file to current main.
2. Update the reconciliation snapshot with the newly observed versions, JWT modes, file list, hashes and exact-match results.
3. Update the pilot verifier's expected versions to the values actually returned by Supabase.
4. Re-run the catalog-pilot validator and the public-contact privacy tests.

### P0 — Pages build and deployed-origin proof

The main Pages workflow is the supported deployment path. Its deploy job runs only on main after validation. A pull-request workflow run does not publish the site.

At this checkpoint:
- Main Pages run 44975555376 is queued.
- The immediately preceding Pages run 44975548041 was cancelled.
- No successful deployment from these two runs is available as release evidence.
- The public URL could not be checked from the current browser session; do not claim it is either live or offline based on that tool limitation.

After the catalog pilot gate passes, require:
- Exact-head frontend build and source validation.
- Public contact privacy tests and Deno checks.
- Public-catalog-directory and individual public-catalog HTTP smoke tests.
- Root, mobile, QR and preview-navigation browser smoke tests on the deployed origin.
- A read-back of the actual Pages deployment commit and artifact.

### Full-platform gate remains separate

Production migration ledger inspection shows 310 applied rows, latest version 20261110150618. The main release contract expects 76 distinct migration identities and currently records 0 exact matches. This blocks full-platform certification, not necessarily a read-only catalog-only release. Do not insert migration-history rows, rewrite history, or run the full chain directly against Production to force the count.

The Pages pipeline's explicit CATALOG_PILOT_GATE is the only permitted route for the bounded first release. Keep FULL_PLATFORM_GATE=BLOCKED while the required migrations, chronological replay, tenant-isolation tests, payment/finance E2E, backup/restore rehearsal, Edge parity and Auth security settings remain unverified.

## 4. First-release execution order

1. Freeze V1 to public catalog/search/business pages. Hide the separate directory-listings surface and all unverified payment/order/finance entry points.
2. Run the public-contact privacy test suite and Deno checks against current main.
3. Capture the current live bundles and versions for the three catalog functions as rollback/evidence records.
4. Deploy current-main public-catalog v9 and public-catalog-directory v19 with their exact shared helper bundles; read back all files and preserve verify_jwt=false.
5. Disable directory-listings as v18 with an empty-success read contract and fixed 503 mutation response, and keep its UI and direct detail routes closed. Read back the exact entrypoint and confirm there are no database queries.
6. Keep catalog-admin v20 as the current production baseline. Do not deploy current-main catalog-admin until RC464/RC471 authorization prerequisites are released and verified. Keep the owner contact-consent control hidden.
7. Refresh the reconciliation snapshot with the actual returned versions and explicit admin drift; run the catalog-pilot verifier and Pages HTTP smoke tests.
8. Let the existing main Pages workflow build and deploy. Do not bypass its main-only deploy condition.
9. Verify the deployed origin and record the Pages run, commit, endpoint versions, smoke-test results and rollback references.

No production database migration is required by the public-contact projection itself. The Edge deployment changes production immediately, so each deployment must be limited to the named catalog functions and verified immediately.

## 5. Post-launch backlog — execute in this order

### P1 — Li2Lak marketplace (post-launch only)
- Finish PR #971 only after exact-head CI is green.
- PostgreSQL 17 tests for RC497 verified reviews, RC498 authenticated order creation, RC499 cash confirmation and the order-idempotency race.
- Revalidate order creation, customer history, branch-scoped order reads and exact-branch status updates.
- Keep status transitions exact-branch; do not broaden RC103 operational access merely to make branchless creation/read easier.
- Complete merchant responses, platform moderation, customer cancellation and refund coupling.
- Add delivery assignment and proof of delivery (time, actor, order/branch binding and tamper-resistant evidence) before declaring delivery complete.

### P1 — Paymob and non-monthly financial/accounting (post-launch only)
- Implement server-created Paymob intents, signed webhooks, idempotent event processing, reconciliation, refund and failure handling. This is explicitly outside the website launch gate.
- Keep any mock payment path disabled and fail closed.
- Connect payment success to order state only through verified server-side events.
- Complete non-monthly commission accrual, financial-obligation lifecycle, journal posting, wallet, settlement, payout and reversal tests.
- Keep flexible commission rules RC452/RC455/RC456 inactive drafts until the live calculation/activation engine and audit path are approved.

### P1 — directory claims and contact rights
- Reconcile RC472/RC473 in chronological order.
- Deploy the complete directory-listings bundle with row-level PHONE, SECONDARY_PHONE, ADDRESS and PRECISE_LOCATION consent.
- Test owner claim, grant/revoke, audit history, pagination and fail-closed behavior.
- Resolve dataset-specific source/licence rights before republishing any third-party directory data.

### P1 — full platform production certification
- Reconcile the exact required migration identities without rewriting migration history.
- Complete chronological forward replay from the current Production schema checkpoint.
- Reconcile physical objects, RPC signatures, ACLs, RLS and critical Edge bundles.
- Complete independent backup/restore and rollback rehearsal with RPO/RTO evidence.
- Complete payment/finance and tenant-isolation E2E, Auth security settings, monitoring and incident runbooks.
- Only then mark FULL_PLATFORM_GATE=PASS.

### P2 — remaining product and administration work
- MantiGO remains a separate lifecycle and rating system; never reuse Li2Lak review records.
- Complete atomic audit support before enabling activity-module override writes in platform admin.
- Finish broader mobile/offline sync, AI suggestions, advanced marketing, employee workflows and module-specific operational dashboards.
- Revisit performance and advisor findings after the release-critical paths are stable.

## 6. Release acceptance record

Do not set the project to LAUNCHED until all of these are recorded:
- Exact current-main source parity for public-catalog v9 and public-catalog-directory v19; catalog-admin v20 drift is explicitly recorded and the consent switch remains hidden.
- Monthly subscription path is verified independently; no new Paymob integration or non-monthly finance flow is required or exposed for V1.
- Contact and precise-location fields are absent unless both audited consent flags are true.
- The separate directory-listings API returns 503 and its list/detail routes are disabled in V1.
- Catalog pilot validator passes on a fresh Production evidence snapshot.
- Pages workflow completed successfully on main and the deployed origin passes browser/HTTP smoke.
- Rollback references are recorded.
- Li2Lak, Paymob integration, delivery, non-monthly accounting/finance, settlement and full-platform work remain listed as post-launch rather than implied as delivered.
