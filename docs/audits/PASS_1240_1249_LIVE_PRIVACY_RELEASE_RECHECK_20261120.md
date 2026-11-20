# Pass 1240–1249 — Live privacy and release-boundary recheck
Date: 2026-11-20

## Scope and method
Read-only recheck against Supabase project `moyhiluyhjsujhwlyeuu`, repository `main` at the time of review (`ce64779fd1790d2c47dd86f8a182d35a65ecc290`), and the GitHub Actions runs associated with that commit. No production SQL mutation, migration, grant, RLS, Auth, Storage, Edge deployment, payment, or customer-data mutation was performed.

## Confirmed production database state
- Supabase migration ledger: **310 rows**, latest version **20261110150618**.
- `anon` still has effective table SELECT on `public.marketing_provider_profiles`.
- `authenticated` and `service_role` retain SELECT on that table.
- `public.directory_listing_contact_consents` does not exist.
- `private.directory_listing_contact_consents` does not exist.
- The source migration `20261118190000_rc479_revoke_anon_provider_profile_base_read.sql` is a single-statement revoke of SELECT from `anon` only. Its source validator and disposable PostgreSQL integration test assert anonymous denial while preserving authenticated and service-role reads. It is not recorded in the live migration ledger and has not been applied.

## Critical Edge Function production inventory
Live metadata read from Supabase:
| Function | Live version | verify_jwt |
|---|---:|---|
| directory-listings | 16 | false |
| paymob-webhook | 10 | false |
| payment-intent | 8 | true |
| subscription-payment-intent | 4 | true |
| digital-page-payment-intent | 5 | true |
| financial-journal | 3 | true |
| order-create | 8 | true |
| public-catalog | 8 | false |
| public-catalog-directory | 18 | false |

The live/source parity audit recorded in Pass 1220–1229 remains applicable: seven critical payment/directory functions are not exact matches to current main. Do not deploy those functions independently because the source depends on unreconciled database contracts.

## Security Advisor snapshot
Observed at 2026-11-20 02:53:39 UTC:
- 9 tables reported RLS enabled without policies. This is an informational inventory requiring effective privilege/ACL review; it is not, by itself, proof of exposure.
- 1 anonymous-executable SECURITY DEFINER RPC: `get_mnty_targeted_advertisements`. Its intended public boundary must be checked against the approved-ad output contract; do not revoke it blindly.
- 65 authenticated-executable SECURITY DEFINER functions. This count is an inventory, not a vulnerability count. Each function requires review of effective EXECUTE grants, caller authorization, search_path, tenant/activity/branch scope, and delegated calls.
- 28 multiple-permissive-policy warnings. Review for semantic overlap and performance; do not delete policies based on warning count alone.

## Release blockers retained
1. P0 directory contact consent boundary: issue [#876](https://github.com/islamnagy2022-eng/MantiqaTix/issues/876). Production consent registries are absent; deployed `directory-listings` is v16 and differs from current main. The complete compatible migration + Edge bundle must be released together after backup/restore and disposable replay.
2. P1 provider profile direct anonymous read: issue [#882](https://github.com/islamnagy2022-eng/MantiqaTix/issues/882). RC479 exists in source but remains unapplied in Production.
3. Payment, subscription, MantiGO, and financial-journal dependency contracts remain unreconciled. Do not hot-deploy the seven mismatched critical functions.
4. Encrypted off-site database and Storage backup, independent PostgreSQL 17 restore, Vault recovery, RPO/RTO, and rollback rehearsal remain unverified. The repository verifier is evidence tooling only; it does not create or restore backups.

## Web release verification
On commit `ce64779`:
- GitHub Pages deployment run **44660883457** completed successfully, including deployed-origin Playwright checks for the legacy catalog root and dashboard/mobile/QR routes.
- Primary catalog validation run **44660883401** completed successfully: build/type-check, public privacy contracts, geographic and OAuth contract checks, dashboard browser E2E, and isolated PostgreSQL employee RBAC tests.
- These checks certify the tested web deployment path only. They do not certify Supabase production schema, live Edge parity, payment processing, backup/restore, or the complete commercial release.

## Next execution order
1. Maintain read-only production posture until owner-controlled encrypted backup/restore/rollback evidence exists.
2. Replay the complete ordered migration chain on a disposable PostgreSQL 17 clone; reconcile all release IDs and dependencies rather than applying isolated RCs.
3. Run negative/positive tests for RC473 consent grant/revoke/expiry, anonymous field suppression, registry outage, owner claim state, and pagination.
4. Include RC479 in the same reviewed DB release and verify anon denial plus authenticated owner and service-role Edge read compatibility.
5. Reconcile the seven critical Edge functions and their DB contracts, then run Paymob sandbox signature, provider-order mismatch, amount/currency, idempotency, replay, refund, and settlement/journal tests.
6. Re-read live migration ledger, ACL/RLS, Edge versions/hashes, and run post-release smoke tests before any certification claim.

## Status
**Production: BLOCKED / NOT CERTIFIED.** No production change was made during this pass.
