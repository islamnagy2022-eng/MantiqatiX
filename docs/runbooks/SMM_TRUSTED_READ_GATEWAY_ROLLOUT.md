# SMM Trusted Read Gateway — Controlled Rollout Runbook

**Status:** Planned only. PR #145 is source/CI-verified but not merged or deployed.  
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
6. Confirm the deployment operator has explicit approval for the production Edge Function and web release. No production migration is needed for these two read actions.

## Deployment order

1. **Deploy the updated `smm-gateway` Edge Function first.** Keep the web bundle on the previous version during this step.
2. Run the gateway smoke tests below against the deployed function using test identities.
3. If and only if the gateway tests pass, publish the matching web bundle containing `smm.js?v=smm9`, the embedded `smm.html?v=smm9` frame, and `app.js?v=rc452`.
4. Verify the published asset URLs and exercise the SMM page in an authenticated browser.
5. Record the deployed Edge Function version, web commit, test identity roles, timestamps, outcomes, and rollback decision.

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

1. If gateway tests fail before web deployment, leave the web bundle unchanged and roll back the Edge Function to its captured prior version.
2. If web smoke tests fail after publication, restore the previous web bundle/cache keys first, verify the old UI works with the currently deployed gateway, then roll back the gateway if necessary.
3. Do not “fix” rollout failures by broadening table grants, weakening RLS, adding tenant OWNER/ADMIN to the global allowlist, or logging credentials.
4. Re-run the smoke tests after rollback and record the outcome.

## Release boundary

Passing PR CI is not proof that the production function is deployed. This runbook does not authorize production changes. The rollout is complete only after the live function version and deployed web assets are independently verified and the smoke-test evidence is recorded.
