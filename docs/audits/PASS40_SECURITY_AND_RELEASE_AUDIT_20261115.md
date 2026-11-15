# Pass 40 — Security, source integrity and release-gate audit
Date: 2026-11-15

## Executive decision

**PASS 40 engineering checkpoint completed. Overall platform release remains BLOCKED / NOT PRODUCTION READY.**

This checkpoint advances the candidate code and test coverage, but does not authorize or perform production migrations, Edge Function deployment, payment/settlement writes, or a production cutover.

## Source and deployment boundaries

- Current GitHub production code baseline reviewed from `main`; the user-provided `bizcatalog-manager (11).zip` is now the R7 reference source for selective comparison and integration.
- R7 archive SHA-256: `210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b`.
- The archive is unmodified. Its Android WebView wrapper source is retained.
- The R7 archive declares a dual-engine model in which local JSON is authoritative and Supabase is synchronized. `server.ts` performs direct local JSON writes. This is not accepted as the final production persistence model.
- The archive has no npm lockfile or executable test script/test suite matching its 99-test claim; only `bun.lock` is present. The release manifest references a missing `public/releases/mantiqatix-production-release-v19.tar.gz`. The local lint attempt could not resolve `vite/client` without dependencies; `npm ci --offline` cannot run without `package-lock.json`. Reproducible build and the reported tests are **NOT VERIFIED**.
- The last previously documented V6 Pages deployment remains the published-site reference. The current Pages workflow composes V6 at root and retains the old catalog at `/legacy/`; PR validation does not deploy because deploy is main-only. The live URL could not be independently fetched in this session.
- No production database write, migration application, Edge Function deployment, payment, refund, settlement, or user-data mutation was performed.

## Candidate PR state

All PRs below remain drafts and must not be merged merely because their isolated CI checks pass.

| PR | Scope | Latest evidence | State |
|---|---|---|---|
| #724 | RC464 platform-admin live authorization hardening | 13 workflow checks succeeded, including migration replay | Draft; preferred RC464 candidate |
| #725 | RC465 orders and order-history business/branch read scope | PostgreSQL behavior suite passed on prior revision; latest ACL replay-overlay correction is committed and CI rerun is pending | Draft; latest head `22bf2fca1e32b150a40548b1c40276597e5e453d` |
| #726 | Catalog contact privacy and cursor pagination | 10 workflow checks succeeded | Draft |
| #727 | RC466 business/branch plus departments/warehouse/inventory scope | RC466 PostgreSQL behavior suite passed on prior revision; latest public-showcase preflight correction is committed and CI rerun is pending | Draft; latest head `96a8aa0cc117754c6c14146e7409bd753387047d` |
| #728 | directory-listings v16 public output allowlist and publication gate | 7 workflow checks succeeded, including import contract and frontend validation | Draft |
| #722 | Earlier MantiGO platform-admin RPC registry migration | Overlaps the later, more complete RC464 candidate in #724 | Keep superseded; do not merge both |

### Required migration order

1. #724 — RC464 (`20261113214500`)
2. #725 — RC465 (`20261114010000`)
3. #727 — RC466 (`20261114020000`)

The sequence must be tested together after the PRs are approved and incorporated into one staging candidate. Do not apply RC466 ahead of RC465. PR #722 duplicates earlier function hardening and should not be merged alongside #724.

PRs #726 and #728 are code/test changes with their own deployment requirements. The Pages workflow does not deploy Supabase Edge Functions; those require a separately approved deployment pipeline.

## Production evidence and findings

- Supabase project is active/healthy.
- Production migration ledger contains 310 migrations through `20261110150618`. RC464, RC465 and RC466 are **not applied**.
- RC465: the live `order_status_history` table grants authenticated SELECT only. The tenant-only permissive member-read policy exposed sibling business/branch history within a tenant. The candidate migration scopes history through the parent order and preserves restrictive anonymous-session guards. The forward-replay fixture now restores the captured live read-only ACL; it is test-only.
- RC466: tenant-wide business/branch policies were too broad for branch-scoped memberships. The candidate narrows business/branch reads and extends the same hierarchy to departments, warehouses, stock balances and inventory transactions. Existing restrictive anonymous-session policies are preserved.
- The public `businesses` showcase intentionally retains anonymous SELECT. RC466 preflight was corrected not to reject that intended grant; private branches and inventory remain non-public.
- Two active branch-scoped BUSINESS_OWNER memberships exist in production, so business/branch isolation is a real authorization boundary, not merely a future feature.
- The live catalog-admin Edge Function performs business/branch membership checks and filters branch-specific items/prices. The direct authenticated table grants for the underlying catalog item/price tables are not present; the service-role path must continue enforcing scope.
- Reviewed 10 `verify_jwt=false` Edge Functions: administrative writes use manual user/session authorization; public endpoints are read-only, webhooks verify signatures, and health is public. No unauthenticated write bypass was confirmed in this review.
- Reviewed 65 authenticated SECURITY DEFINER functions. All have explicit search_path configuration. The public-only-path functions inspected use schema-qualified relation references; no temp-table shadowing exploit was confirmed. The public schema CREATE privilege is not granted to anon/authenticated.
- The production `settlement-financial-atomic v4` is older than the candidate in #724. The candidate adds business/branch authorization, but beneficiary-to-business/provider mapping remains unverified. Production has no populated payout destinations or settlement records to prove that mapping; Paymob Sandbox and end-to-end settlement verification remain required.
- The legacy `settlement-create` path calls an RPC that is not executable by authenticated users; it fails closed and is not the preferred path.

## Release blockers

1. Obtain green forward-migration replay for the latest #725 and #727 heads, then run the combined RC464 → RC465 → RC466 chain in Staging.
2. Review and approve the draft PRs; merge in the required migration order only after combined validation.
3. Apply migrations to Staging, validate RLS and API behavior with distinct tenant/business/branch/customer identities, and only then request production migration approval.
4. Deploy matching Supabase Edge Function sources separately and verify deployed versions against the approved commits.
5. Resolve beneficiary identity mapping and complete Paymob Sandbox settlement tests.
6. Convert R7 local JSON authority to PostgreSQL/Supabase transactional persistence; add reproducible dependency installation and real test scripts.
7. Build/test the Android APK/AAB without deleting or replacing the preserved wrapper source.
8. Complete backup restore, disaster recovery, concurrency, browser/mobile, and production smoke tests.

## Completion metric

The last verified Pass 35 weighted score remains **60.8333%**. Candidate work in unmerged PRs is not added to the production completion score. No percentage increase is claimed until the changes pass current CI, are integrated, and are verified in Staging.

## Next exact action

Wait for the latest #725 and #727 CI reruns. Fix any replay or contract failures without relaxing production preflight checks. Then assemble and test the combined RC464 → RC465 → RC466 migration chain in Staging. Keep production unchanged until explicit approval.
