# Pass 44 — Production recovery visibility and public ad endpoint review

**Date:** 2026-11-15  
**Production project:** `moyhiluyhjsujhwlyeuu`  
**Documentation branch:** `docs/pass40-continuity-checkpoint-20261115`  
**Release status:** `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`

## Scope and safety

Read-only inspection of the current Supabase project, branch inventory, migration ledger, security advisor findings, and the one anon-callable SECURITY DEFINER function. No Production DDL/DML, Auth/RLS/GRANT change, Edge deployment, payment, settlement, backup restore, project/branch creation, or website deployment was performed. No paid resource or Staging environment was created.

## Current Production facts

- Supabase project `MANTIQATIX FINAL` reports `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155.
- The live migration ledger remains **310 entries**, latest `20261110150618`; RC464–RC467 remain unapplied.
- Development branch inventory contains only `main`; it is non-persistent and has no data copy (`with_data=false`). There is no persistent Staging branch.
- PR #730 remains Draft/open/unmerged. PR #729 remains Draft/open/unmerged.
- The current security advisor snapshot reports 9 RLS-enabled/no-policy tables, 1 anon-callable SECURITY DEFINER function, and 65 authenticated-callable SECURITY DEFINER functions. These are triage signals, not proof of exploitable access.

## Recovery / backup evidence gap

The connected Supabase tool surface exposes project metadata, migrations, branches, SQL, and advisors, but no backup inventory, PITR status, restore-point metadata, backup download, or restore rehearsal evidence. The only listed branch is `main` with `with_data=false`; it is not a recoverable production-data copy.

Therefore the following remain **NOT VERIFIED**:
- existence and timestamp of a current production data backup;
- PITR enablement and retention window;
- measured RPO and RTO;
- successful restore of a current production backup;
- rollback/recovery procedure tested against current schema and data.

The historical CI baseline at `20261008222845` is a schema-only checkpoint marked `PENDING_REVIEW`; the 80-migration replay in CI is not a data backup or disaster-recovery test. Do not run `restore_project` against Production as a diagnostic action.

## Anonymous ad-serving function review

Security advisor identified `public.get_mnty_targeted_advertisements(varchar,varchar,varchar,double precision,double precision,varchar,integer)`.

Read-only catalog inspection confirms:
- `SECURITY DEFINER`, owner `postgres`, empty `search_path`;
- EXECUTE is available to `anon` and `authenticated`;
- query filters tenant ads to ACTIVE + APPROVED + in-date and platform-global ads to ACTIVE + APPROVED + in-date;
- returns only advertisement ID, title, creative URL, target URL, ad-space ID, match level and distance;
- source tables `advertisement_target_locations` and `platform_global_advertisements` deny direct anon/authenticated SELECT and enforce RLS; `platform_geo_areas` exposes only active Egypt geographic areas; `advertisements` is RLS protected and not anon-readable.

Classification: likely intentional public ad-serving API, not a confirmed vulnerability. Do not revoke anon EXECUTE until product owner confirms public ad delivery contract and a dedicated behavior test validates output disclosure, inactive/unapproved/expired filtering, and limit bounds. The advisor warning remains open pending that approval.

## Documentation consistency issue

The previous `docs/MASTER_PRODUCTION_TODO.md` top checkpoint still labeled Pass 41 and cited earlier 17/17 evidence, while `docs/PROJECT_CONTINUITY.md` already contained the final Pass 43 exact-head result (18/18). This Pass 44 update supersedes that stale summary and aligns the current checkpoint; historical records remain preserved below.

## Next risk-ranked work

1. Continue per-function caller and tenant/business/branch negative tests for the 65 authenticated-callable SECURITY DEFINER functions, prioritizing payment, wallet, orders, inventory, commissions and settlements.
2. Keep the nine no-policy tables fail-closed; map trusted service-role callers before any policy/grant changes.
3. Obtain owner-side evidence for backup/PITR/restore through the Supabase dashboard or an approved backup artifact, without enabling paid features or creating Staging.
4. Obtain product-owner confirmation for the public ad-serving endpoint and add focused disposable tests before changing its ACL.
5. Human SQL/security review of PR #730 and current backup/restore/rollback evidence remain prerequisites to any production rollout.

**No release gate is closed by this pass. Production remains BLOCKED / NOT CERTIFIED.**


## Additional P0/P1 finding — digital-page payment claim and deployed Edge parity

A risk-ranked read-only review of the payment claim path found a concrete Production rollout gap:

- The live migration ledger query for `20261030100000` through `20261116000000` returned only `20261101140105` and `20261110150618`. RC458 migration `20261030120000_rc458_digital_page_payment_rpc_empty_search_path.sql` is absent from the live ledger.
- Live `claim_digital_page_payment_intent_backend(uuid,uuid,text,text)` remains SECURITY DEFINER with `search_path=public, pg_temp`; its body still has an unqualified `where id = p_order_id` despite a `RETURNS TABLE(id, ...)` output parameter. RC458's already-merged source migration explicitly fixes this ambiguity by aliasing the table as `o` and using `o.id`, and sets an empty search_path. Its own audit correctly records Production rollout as NOT APPLIED.
- The deployed `digital-page-payment-intent` Edge Function is ACTIVE at version 5 with `verify_jwt=true`. Its deployed source creates a UUID claim token and binds the order to the verified user, but it lacks the later main-branch Paymob intention correlation checks (`matchesPaymobIntention`) and provider-order ID persistence path present in the current source file. This is a deployed-source parity gap requiring controlled review; no Edge invocation or deployment was performed.
- The current claim RPC checks order ownership and idempotency key. However, its active-claim comparison uses `<> p_claim_token`; SQL NULL comparison can evaluate to NULL (not TRUE), and the RPC does not reject NULL/blank claim tokens. An authenticated order owner calling the RPC directly with a NULL token could bypass the in-progress branch and overwrite the claim marker. This is a plausible same-owner concurrency/duplicate-intention risk, not a cross-user authorization bypass and not confirmed by a live invocation.
- The main branch contains the RC458 correction and the current Edge source contains stronger provider correlation logic, but the live ledger/Edge deployment are behind those sources. Do not treat source merge or CI as Production parity.

**Required remediation (candidate only):**
1. In a new forward-only migration, retain the RC458 table alias and empty search_path, reject NULL/blank/oversized claim tokens, and use `IS DISTINCT FROM` for active claim token comparison.
2. Add disposable positive/negative tests for NULL, blank, valid, same-token replay, competing token, cross-user, and finalize/release ownership behavior.
3. Verify the live migration ledger and function definition after the approved rollout; separately deploy the reviewed Edge Function and compare its deployed source to the approved commit.
4. Exercise Paymob Sandbox correlation and idempotency end-to-end before enabling production payment traffic.

No production function, migration, Edge Function, payment or user data was changed or invoked in this review. The RC458 search-path migration remains unapplied in Production; PR #730 does not yet contain this new payment-claim remediation. Release remains BLOCKED / NOT CERTIFIED.
