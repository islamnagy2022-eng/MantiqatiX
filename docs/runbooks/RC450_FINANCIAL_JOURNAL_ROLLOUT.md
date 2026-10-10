# RC450 — Financial Journal Service-Role Boundary Rollout

**Status:** prepared for review; **not approved for production execution**.  
**Migration:** `supabase/migrations/20261010180000_rc450_financial_journal_service_role_boundary.sql`  
**Edge Function:** `supabase/functions/financial-journal/index.ts`  
**Release order:** merge source and pass CI → apply RC450 through the approved migration pipeline → deploy the matching Edge Function → run authorized post-deployment verification.

## Verified live defect (read-only audit)

- Production `post_financial_journal_backend(uuid,jsonb,jsonb)` currently denies EXECUTE to `service_role`.
- The deployed `financial-journal` Edge Function still calls legacy `post_financial_journal`, uses wildcard CORS, and does not pass the verified actor to the backend RPC.
- The current journal RPC checks tenant membership and active accounts but does not bind a non-null membership `business_id`, `branch_id`, or `organization_id` to the requested journal scope.
- Production has multiple businesses per tenant and membership rows carry business/branch/organization scope fields. RC450 validates active business/branch ownership and matches non-null membership scopes.

## Preflight — read-only

1. Confirm project ID `moyhiluyhjsujhwlyeuu` and the approved change window.
2. Confirm migration version `20261010160000` is absent from the live migration ledger. Do not rename or replay an applied migration.
3. Re-read the live function signature and ACLs. Confirm `service_role` still lacks EXECUTE before the change, while `PUBLIC`, `anon`, and `authenticated` must remain denied afterward.
4. Confirm `businesses`, `branches`, `user_memberships`, `chart_of_accounts`, `journal_entries`, `journal_entry_lines`, and `general_ledger` have the columns used by RC450.
5. Confirm the latest RC450 source-contract test, PostgreSQL 16 integration job, backend-only module boundary, migration-history immutability, migration-version uniqueness, and cross-PR collision checks all pass on the exact release head.
6. Use a disposable database or approved staging tenant for posting tests. Never create synthetic journal entries or ledger rows in production merely to test deployment.

## Approved rollout order

1. Apply RC450 once through the approved migration pipeline. The migration must fail closed if required journal schema columns are missing.
2. Verify the ledger records the exact version and filename.
3. Verify the RPC body includes the verified-role claim guard, active financial membership, business/branch/organization scope, balanced detail lines, active tenant accounts, advisory lock, and duplicate-ID rejection.
4. Verify function privileges: `service_role` can execute `post_financial_journal_backend`; `PUBLIC`, `anon`, and `authenticated` cannot execute it directly.
5. Deploy the matching `financial-journal` Edge Function only after the migration is confirmed applied. Edge Function source is not automatically deployed by merging this PR.
6. Confirm the deployed function version and inspect its CORS, token verification, anonymous-session rejection, and backend RPC call.
7. Run the complete behavioral suite in staging/disposable PostgreSQL. Any production posting canary requires a separate explicit approval and a dedicated test tenant/business with an approved reversal plan.

## Acceptance tests

- Valid authenticated financial user posts a balanced journal within their allowed tenant/business/branch scope.
- Anonymous, missing/invalid bearer token, and disallowed browser origins are rejected.
- A user cannot post for another actor unless the trusted server role supplies the actor and the database independently validates active membership.
- Cross-tenant, same-tenant cross-business, and cross-branch posting attempts fail.
- Inactive/missing businesses, branches, or accounts fail.
- Header totals and line totals must match; negative amounts and a line with both debit and credit fail.
- Duplicate journal IDs fail closed without appending journal lines or ledger rows.
- Client roles cannot execute the backend RPC directly.
- No wildcard `Access-Control-Allow-Origin: *` remains.

## Failure and rollback policy

- If RC450 fails before commit, stop and inspect the error; do not modify migration history or rerun altered SQL under the same version.
- If Edge Function deployment fails after the migration succeeds, keep the service-role-only RPC boundary and use a corrected forward deployment. Do not roll back to wildcard CORS or re-grant direct client execution.
- The previous deployed Edge Function is known to call the incompatible legacy RPC, so blindly restoring it is not a healthy rollback. Prefer a reviewed forward fix; if needed, disable the endpoint or return a fail-closed error while repairing it.
- Do not insert synthetic production journals, ledger rows, settlements, refunds, or payments as a smoke test.

## Safety boundary

This runbook does not authorize production changes. No production migration, financial posting, journal/ledger mutation, grant change, or Edge Function deployment is performed by this document.
