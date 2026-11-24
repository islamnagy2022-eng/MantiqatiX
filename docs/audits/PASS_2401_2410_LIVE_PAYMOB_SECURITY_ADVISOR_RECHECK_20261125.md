# PASS 2401–2410 — Live Paymob, payment RPC and Supabase advisor recheck

**Review date:** 2026-11-25  
**Production project:** `MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu`  
**Database:** PostgreSQL `17.6.1.155`, region `us-east-2`, status `ACTIVE_HEALTHY`  
**Repository baseline:** `main` after PR #1091 merge, `721277f08867781ee0649ac929578ed6406533e3`  
**Method:** read-only Supabase project, migration, table, Edge Function, advisor and PostgreSQL catalog queries, plus byte-for-byte comparison of deployed `paymob-webhook` source with current-main source.  
**Disposition:** **FULL_PLATFORM_GATE = BLOCKED / NOT CERTIFIED**. No Production mutation was performed.

## 1. Verified Production state

| Check | Result | Boundary |
|---|---|---|
| Production project | ACTIVE_HEALTHY, PostgreSQL 17.6.1.155 | Health does not certify release readiness. |
| Applied migration ledger | 310 rows; latest `20261110150618` (`revoke_public_execute_from_trigger_functions`) | Matches the connected live read-back. |
| Required source migration set | 82 ordered files; 0/82 exact required version IDs in the live ledger | Identity mismatch is not proof that every physical effect is absent. Existing aliases/forward repairs must be reconciled before rollout. |
| Public/private tables | 138 returned by connected table inventory; all returned rows had RLS enabled | RLS being enabled does not prove correct policy, grants, function ACL or tenant scope. |
| Edge Functions | 42 ACTIVE functions | Active status and `verify_jwt` setting alone do not prove source/runtime parity. |
| Supabase branches | Only the primary `main` entry was returned; `with_data=false` | No populated independent restore target was demonstrated. |
| Health Advisor | 0 findings | Does not override Security/Performance findings or release gates. |

The separate `MantiqatiX-DEMO` Supabase project is INACTIVE and was not used as Production.

## 2. Paymob deployed-source drift — high-priority payment blocker

The deployed `paymob-webhook` is ACTIVE **v10**, `verify_jwt=false`, last updated `2026-10-08T22:28:50.427Z`. Its deployed `index.ts` content is not byte-equal to current `main`:

- Deployed source length: 11,538 characters.
- Current-main source length: 12,376 characters.
- Both versions include `order.id` in the Paymob HMAC input. The signed provider order ID is therefore available after successful HMAC verification.
- The deployed v10 handler uses unsigned `order.merchant_order_id` as its initial record selector and does not contain the current-main stored-order equality guards before processing the selected subscription, digital-page or standard payment record.
- Current `main` contains explicit mismatch guards for subscription, digital-page, MantiGO and standard payment paths, and routes failure callbacks through dedicated atomic failure processors.
- The deployed bundle still contains the older non-atomic MantiGO provider-event insertion/update flow. Current `main` calls the dedicated `process_verified_mantigo_payment_backend` processor.

This is a **source/runtime integrity gap**, not proof that a malicious callback has occurred. The exact altered-selector negative HTTP replay remains required: sign an event for pending order A, alter the unsigned merchant selector to equal-value/equal-currency pending order B, and prove HTTP rejection with zero mutation to either order. Repeat for standard, digital-page and subscription flows, plus replay and failure cases.

### Exact required database RPC signatures

A read-only PostgreSQL `to_regprocedure` check returned `present=false` for all seven exact signatures required by the current payment/recovery source contract:

| Required contract | Exact signature present |
|---|---:|
| Standard provider payment failure | NO |
| Subscription payment success | NO |
| Subscription payment failure | NO |
| MantiGO payment processor | NO |
| Digital-page payment processor | NO |
| Subscription provider-intent claim | NO |
| Subscription claimable-intent creation | NO |

These results mean the exact requested signatures are not present; they do not rule out similarly named overloads or alternate historical implementations. They are sufficient to block a standalone Edge deployment: current-main webhook code must not be deployed until its matching database contracts are reconciled, staged, and verified.

**Required release order:** reconcile and stage the database contracts first; pass PostgreSQL 17 behavioral/concurrency tests; run the provider-signed altered-selector sandbox replay; then deploy the coordinated Edge bundle and verify its deployed hash/version. Do not deploy only the Edge Function or blindly apply the 82 migrations in order to Production.

## 3. Supabase Security Advisor read-back

Latest advisor observation timestamp: `2026-11-24T23:50:18.922Z`.

| Finding | Count | Interpretation |
|---|---:|---|
| RLS enabled, no policies | 9 tables | Check grants and API exposure. Some may be deliberately server-only; do not add public policies automatically. |
| Anonymous role can execute SECURITY DEFINER function | 1 function | `get_mnty_targeted_advertisements`; the codebase has an intentional public ad-discovery contract, so verify exact intended ACL and body rather than blindly revoke. |
| Authenticated role can execute SECURITY DEFINER functions | 65 functions | Requires allowlist-by-contract review of function body, owner, search_path, grants and identity/scope checks. Not every warning is an exploit. |
| Anonymous-access policy findings | 90 table/policy findings | Distinguish Postgres `anon` access from Supabase anonymous Auth sessions; validate table-by-table against intended public/tenant scope. |
| Leaked-password protection disabled | 1 Auth finding | Owner-side Auth security setting must be enabled and verified before launch. |

The 9 RLS-enabled/no-policy tables were: `business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `directory_source_permission_evidence`, `platform_custom_roles`, `platform_role_assignments`, and `public_directory_listings`.

The 65 SECURITY DEFINER warnings are not a reason to revoke every function. Many are intended server-side RPCs and need to be checked against the exact caller model and grants. Likewise, do not disable Anonymous Auth globally until legitimate application dependencies are mapped and tested.

## 4. Supabase Performance Advisor read-back

| Finding | Count | Severity |
|---|---:|---|
| Unindexed foreign keys | 132 | INFO |
| RLS auth/current-setting initplan warnings | 375 | WARN |
| Unused indexes | 65 | INFO |
| Multiple permissive policies | 28 | WARN |

These findings need targeted query-plan, policy-equivalence and workload review. Do not remove indexes or rewrite policies based solely on the linter count.

## 5. What passed and what did not

- PR #1091 was merged as documentation-only commit `721277f08867781ee0649ac929578ed6406533e3`. Its exact-head validation workflows completed successfully; the website deploy job was **skipped** because the PR did not change deployable application files.
- The independent PostgreSQL 17 disposable replay and application validation jobs observed during the #1091 PR completed successfully. They are CI evidence, not a Production backup restore or live migration.
- No live Paymob sandbox callback, payment, refund, settlement, journal posting, migration, Edge deployment, Auth setting change, RLS/GRANT change, Storage operation or backup/restore was executed during this recheck.
- The backup/restore gate remains **BLOCKED / NOT VERIFIED**: no encrypted off-site database dump and Storage object export with checksums/retrieval, independent PostgreSQL 17 restore, rollback rehearsal or measured RPO/RTO has been demonstrated.

## 6. Ordered next actions

1. Obtain an owner-controlled encrypted database backup and separate Storage object-byte export; record checksums and prove retrieval. Recover Auth configuration, Vault/key material and Edge secret references without placing secret values in GitHub or chat.
2. Restore into an independent disposable PostgreSQL 17 target and measure RPO/RTO; run rollback tests before any Production write.
3. Complete the source-to-live effect crosswalk for all 82 release migrations, resolving exact-version aliases and already-applied equivalent effects. Build an idempotent candidate plan from the actual live schema; never fabricate migration-ledger rows or replay historical SQL blindly.
4. Reconcile the seven exact payment RPC signatures, payment columns/indexes, function owner/search_path/ACL, RLS and Edge dependencies on the isolated restore.
5. Pass signed Paymob HTTP negative/positive tests for altered merchant selector, equal-value collision, wrong currency/amount, provider replay, duplicate callbacks, and failed callbacks across standard, digital-page and subscription orders; include MantiGO where its payment path is enabled.
6. Complete the coordinated database + Edge rollout, verify deployed source hashes/versions, and run deployed-origin browser/API tests.
7. Enable and verify leaked-password protection; resolve anonymous Auth configuration intentionally; review the SECURITY DEFINER and anonymous-policy findings against a route/function allowlist.
8. Re-run the production verifier and all release gates. Only then prepare an owner-approved Production release packet.

**Decision:** Production stays read-only and payment deployment stays blocked. This report records newly rechecked evidence; it does not authorize Production changes.
