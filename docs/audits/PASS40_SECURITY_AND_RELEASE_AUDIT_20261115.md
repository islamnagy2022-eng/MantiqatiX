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
| #725 | RC465 orders and order-history business/branch read scope | all 11 latest-head workflow checks succeeded, including PostgreSQL behavior and forward migration replay with the test-only live ACL overlay | Draft; latest head `22bf2fca1e32b150a40548b1c40276597e5e453d` |
| #726 | Catalog contact privacy and cursor pagination | 10 workflow checks succeeded | Draft |
| #727 | RC466 business/branch plus departments/warehouse/inventory scope | all 11 latest-head workflow checks succeeded, including the RC466 static validator, PostgreSQL behavior suite, forward migration replay and backend boundary validation | Draft; latest head `96a8aa0cc117754c6c14146e7409bd753387047d` |
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

1. The isolated forward-migration replay for #724, #725 and #727 is green. The combined RC464 → RC465 → RC466 chain must still be run in Staging.
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

The isolated #724/#725/#727 forward-replay workflows now pass. Next assemble and test the combined RC464 → RC465 → RC466 migration chain in Staging; do not relax production preflight checks. Keep production unchanged until explicit approval.


## Combined migration-chain verification — 2026-11-15

- Draft integration PR [#730](https://github.com/islamnagy2022-eng/MantiqatiX/pull/730), exact head `52075482ddcf30749b4eb75768ce891755df85ea`, completed all 17 workflow runs successfully.
- The combined `Forward Migration Chain Replay from Production Schema Checkpoint` run `43656845956` and job `132637148994` succeeded. RC464, RC465 and RC466 migration-specific PostgreSQL suites also succeeded on the same head.
- Web workflow validation succeeded; deploy job was skipped as expected for a pull-request event. This is not a production deployment.
- This closes the combined isolated-CI acceptance item only. PR #730 remains draft/unmerged; production ledger remains unchanged at 310 migrations. Staging replay, tenant/business/branch/customer API tests, approvals and production authorization remain open.
- **Stage result:** combined CI validation 100% (17/17 workflows); overall production completion remains 60.8333%, unchanged until approved integration and Staging evidence.


## Pass 41 — Documentation CI and live Supabase read-only inventory — 2026-11-15

### Verified
- PR #729 exact head `713dec4e19dedcf38f0338ec7c6d9508e7ed51e8`: 8/8 Actions runs successful. Pages validation passed; `validate_public_only` and `deploy` were skipped because the run was triggered by a pull request.
- PR #730 exact head `52075482ddcf30749b4eb75768ce891755df85ea`: combined RC464 → RC465 → RC466 forward migration replay and related CI remained 17/17 successful. Draft/unmerged.
- Live Supabase project `MANTIQATIX FINAL` is ACTIVE_HEALTHY. Only `main` branch is present; no persistent Staging branch exists.
- Production migration ledger has 310 entries, latest `20261110150618`. No RC464/465/466 migration is applied.
- Public schema inventory: 137 tables, 0 with RLS disabled.
- Security advisor findings: 9 RLS-enabled/no-policy tables (default-deny), 1 anon-callable SECURITY DEFINER function, 65 authenticated-callable SECURITY DEFINER functions, and leaked-password-protection warning.
- Performance advisor findings: 132 unindexed foreign keys, 375 auth RLS initplan findings, 71 unused indexes, 28 multiple permissive policies.

### Interpretation and safety
- Advisor findings require call-chain and intended-access review; they do not by themselves establish a vulnerability or authorize mass privilege/policy changes.
- Supabase Staging branch creation can incur compute cost. Check and disclose the cost and obtain approval before creating a persistent branch.
- No production DDL/DML, Auth/RLS/GRANT, Edge Function deployment, payment, settlement, or user-data mutation was performed.
- PR #729 CI stage: 8/8 = 100%. PR #730 combined-chain CI stage: 17/17 = 100%. These are candidate validation metrics only.
- Overall production completion remains **60.8333%**, unchanged. Production release remains **BLOCKED / NOT CERTIFIED**.

### Next exact action
Obtain a cost-approved Staging environment, replay the exact #730 migration chain, then run positive and negative tenant/business/branch/order-history/inventory API tests. Keep production unchanged until Staging, review, approval, and production change-window gates pass.



## Pass 41 — detailed RLS / SECURITY DEFINER triage — 2026-11-15

### RLS-enabled tables without policies
The live catalog contains nine: `business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `directory_source_permission_evidence`, `platform_custom_roles`, `platform_role_assignments`, and `public_directory_listings`. A read-only privilege query confirmed anon/authenticated SELECT and INSERT are false for all nine. service_role SELECT is present only on the three directory tables listed above; it is absent on the other six. This is default-deny behavior, not an authorization bypass. Confirm intended trusted backend access before modifying policies or grants.

### Anonymous SECURITY DEFINER function
The single advisor finding is `public.get_mnty_targeted_advertisements(...)`. The function uses `search_path = ''`, explicitly grants EXECUTE to anon/authenticated, filters to active and approved advertisements and returns only ad placement fields. A bounded live query returned three approved global ad placements without customer or personal fields. This is likely an intentional public ad-serving endpoint. Preserve pending product-owner confirmation and regression tests; do not blindly revoke public execution.

### Authenticated SECURITY DEFINER functions
65 functions remain flagged for authenticated execution. Review their function bodies, caller paths, user identity validation, tenant/business/branch checks and intended grants. The advisor count alone does not prove an exploitable defect. No mass revoke performed.

### Other advisor findings
- Auth: leaked-password protection warning remains open; no Auth settings changed.
- Performance: 132 unindexed FKs, 375 auth RLS initplan findings, 71 unused indexes, 28 multiple permissive policies. Treat as prioritization signals; measure hot paths and inspect query plans before making changes.
- No production DDL/DML, Auth/RLS/GRANT changes, Edge deployments, payment/settlement writes or user-data changes.



## Pass 41 — authenticated SECURITY DEFINER call-chain spot check

A read-only catalog scan found 65 public SECURITY DEFINER functions executable by `authenticated`. 59 directly reference `auth.uid()`; six do not. The six were individually traced:

1. `mnty_business_employee_list` → `mnty_business_employee_list_scoped`: non-null/non-anonymous actor and active tenant/business/branch membership or explicit employee permission.
2. `mnty_can` → `mnty_active_membership`: membership is scoped to `auth.uid()`.
3. `mnty_can_platform_admin` → `mnty_can` → active membership resolver.
4. `preview_commission_backend` → `assert_financial_membership`: requires authenticated identity, active tenant membership and finance/admin role.
5. `upsert_catalog_item_and_price_backend` → item and price backends: both independently check authenticated identity, active membership, business and branch scope.
6. `get_mnty_targeted_advertisements`: intentionally public read endpoint returning approved advertisement placement fields only, as separately recorded above.

**Result:** all six functions without a direct `auth.uid()` reference are classified (6/6). This is only a wrapper/public-read classification, not a full security certification of all 65 functions. The remaining 59 direct-auth functions still require object-level tenant/business/branch validation and negative authorization tests. No production changes were made.

