# SMM Trusted Read Gateway — Controlled Rollout Runbook

**Status:** BLOCKED — documentation only; no production rollout authorized. PR #145 is closed without merge. PR #188 merged the RC456 source migration, but RC456 is not confirmed applied in production. PR #189 is the current SMM UI candidate and remains a draft; its exact-head CI is not fresh against current main.  
**Production safety:** No Edge Function deployment, secret change, wallet mutation, or payment is authorized by this document.

## Why the rollout must be coordinated

The SMM web candidate calls two new actions on the existing `smm-gateway` Edge Function: `catalog` and `my_data`. The current deployed function does not yet support those actions. Deploying the web bundle before the gateway would intentionally show the explicit unavailable state instead of a false empty catalog or zero balance, but would temporarily interrupt SMM usage.

The gateway also tightens SMM administration: tenant OWNER/ADMIN roles alone no longer grant platform-wide SMM administration. Before rollout, verify the approved administrators are present in `public.smm_admins` or meet the explicit active platform SUPER_ADMIN/full-control contract. Do not automatically grant access to make the UI work.

## Preflight — read-only checks

1. Confirm the reviewed source commit for PR #145 and all required CI/integration jobs are green.
2. Confirm the target Supabase project and function name are correct.
3. Inventory the intended SMM administrators with an approved read-only review of `public.smm_admins` and active `user_memberships`. Do not print secrets or export unrelated user data.
4. Confirm a dedicated authenticated test account exists for a non-admin, and an approved platform-admin test identity exists. Avoid real customer wallet changes and real provider transactions.
5. Capture the currently deployed `smm-gateway` version and the current web asset/cache-key checkpoint for rollback.
6. Confirm the deployment operator has separate explicit approval for the production migration batch, Edge Function release, and web publication. RC456 (`20261011010000_rc456_smm_service_role_access_boundary.sql`) changes production table privileges and is a required dependency for the reviewed gateway source; it is not confirmed applied. Do not proceed until the entire post-RC424 migration chain is reconciled, all migration-prefix collisions are resolved in the release plan, ordered replay passes on disposable PostgreSQL, and the migration batch has explicit approval. The connector must not apply this migration or deploy the function/web bundle.

## Deployment order — blocked until authorized and reconciled

The source dependency is coordinated, not independently deployable. The following is a planning sequence only; this runbook does not grant authorization.

1. Reconcile the live migration ledger against the exact ordered release batch beginning after RC424. Preserve the applied RC424 ledger version and its verified source alias; do not rewrite history. Resolve the five known duplicate timestamp-prefix groups and run full ordered replay plus required integration/security tests on disposable PostgreSQL/Supabase.
2. Obtain explicit approval for the exact production migration batch, target project, and rollback/forward-repair plan. Apply no migration without that approval. RC456 changes service-role table privileges; verify its exact reviewed diff and least-privilege effect before approval.
3. After the approved migration batch is verified, obtain separate explicit approval and deploy the matching `smm-gateway` Edge Function source that implements `catalog` and `my_data`. Keep the existing web bundle unchanged.
4. Run all gateway smoke tests below using approved test identities; verify both positive and negative authorization cases and capture the deployed function version. If any test fails, stop before web publication.
5. Only after gateway tests pass, obtain explicit web-publication approval and publish the matching reviewed SMM UI candidate. At the current checkpoint, PR #189 is a draft and behind main; refresh it to current main and obtain fresh CI before selecting a bundle. Confirm its exact cache keys from the reviewed head rather than reusing stale keys from PR #145.
6. Verify published asset URLs and exercise the SMM page in an authenticated browser. Record the migration versions, function version, web commit, test identity roles, timestamps, outcomes, and rollback/forward-repair decision.

**Hard stop:** if the migration ledger, chronological replay, gateway contract, or authorization evidence is incomplete, do not deploy any of the three layers.

## Gateway smoke tests

- Missing/invalid bearer token returns HTTP 401.
- An anonymous Auth session returns HTTP 401.
- Authenticated non-admin can call `catalog`; the response includes only the approved catalog fields and excludes provider cost, provider IDs, external service IDs, and raw metadata.
- Authenticated non-admin can call `my_data`; orders and wallet are scoped to the verified bearer user's ID, and the response contains only the approved fields.
- A database read failure returns an explicit error response; it must not become a successful empty catalog or a successful zero balance.
- A tenant OWNER/ADMIN without an explicit SMM admin allowlist entry or platform-wide full-control membership is denied administrative actions.
- A user in `smm_admins` is recognized as an SMM admin.
- A platform SUPER_ADMIN is recognized only with `tenant_id='MNTY-PLATFORM'`, no business scope, active membership, `permissions.scope='PLATFORM'`, and `permissions.full_control=true`.
- Existing administrative actions (provider configuration, service sync, provider status, and admin credit) still enforce the same server-side authorization.
- The browser sends no direct reads to restricted `smm_services`, `smm_orders`, `smm_wallets`, or `user_memberships` tables.

## Web smoke tests

- Catalog renders real services after the gateway responds successfully.
- Order history and wallet balance belong only to the authenticated test user.
- A gateway failure renders the explicit unavailable/retry view and does not show an empty catalog or zero balance as confirmed data.
- Admin controls appear only when the gateway returns `is_admin: true`.
- No service-role key, provider API key, provider cost, or raw provider metadata appears in browser payloads or logs.

## Rollback

1. Before any approved production change, capture the exact currently deployed function/web versions, migration ledger, and backups required by the release plan.
2. If gateway tests fail before web publication, leave the web bundle unchanged and execute only the pre-approved function rollback/forward-repair procedure.
3. If web smoke tests fail after publication, restore the previous web bundle/cache keys according to the approved plan and verify compatibility with the currently deployed gateway. Do not assume the database privilege migration can be safely reversed without an explicitly reviewed plan.
4. Do not “fix” rollout failures by broadening table grants, weakening RLS, adding tenant OWNER/ADMIN to the global allowlist, or logging credentials.
5. Re-run the smoke tests after the approved recovery and record the outcome.

## Release boundary

Passing PR CI is not proof that the production function is deployed. This runbook does not authorize production changes. The rollout is complete only after the live function version and deployed web assets are independently verified and the smoke-test evidence is recorded.

## Initial-launch deferral checkpoint — 2026-10-12

SMM is deferred from the initial customer-facing launch. The server-side deferral candidate is PR #214 at exact head `b5ececafa6930837e5e392bb999e318e1038bd10`; its recorded exact-head source checks passed, but it remains a draft and has not been deployed. These checks are source/CI evidence only, not proof that production requests are denied.

The broader release-remediation candidate PR #207 is currently at `8918506f732c7077027768ca8eb1bdca927d44cf`. Its latest exact-head checks passed for migration-history immutability, migration-version uniqueness, open-PR collision detection, SMM service-role boundary, and SMM deferred-module validation. The disposable chronological migration replay is still in progress; do not infer replay success until the replay job completes with a successful conclusion. Earlier replay attempts failed on missing historical SECURITY DEFINER function-creation dependencies.

**Critical live-state caveat:** the production `smm-gateway` remains active at version 6. A static holding page, hidden navigation, a passing source validator, or PR #214 does not disable the separately addressable Edge Function. Before public launch, the reviewed server-side deny/disable behavior must be deployed only with explicit production approval and then verified by negative runtime tests proving disabled requests cannot reach authentication-dependent business logic, database, wallet/order, or provider operations. Capture the deployed function version/hash and test evidence. Until that evidence exists, SMM API containment is a production launch blocker.

Do not deploy RC456, any other migration, the gateway, or a web bundle from this checkpoint. Keep migration replay, the ordered release batch, and all three rollout approvals as separate gates.
