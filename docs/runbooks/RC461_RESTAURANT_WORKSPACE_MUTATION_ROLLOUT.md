# RC461 — Restaurant Workspace Mutation Authority Rollout

**Status:** prepared for review; **not approved for production execution**.  
**Migration:** `supabase/migrations/20261012030000_rc461_restaurant_workspace_mutation_authority.sql`  
**Edge Function:** `supabase/functions/restaurant-workspace-mutate/index.ts`  
**UI:** `web/restaurant-module.js`

## Security change

- Restaurant table and inventory mutations move from browser-side table writes to the authenticated `restaurant-workspace-mutate` Edge Function.
- The Edge Function validates the bearer token, exact active tenant/business/branch membership, role, payload size, and allowed input fields.
- `restaurant_workspace_mutate_backend` repeats the membership and active business/branch checks, updates the row and inserts its audit record in one database transaction.
- Direct `INSERT`, `UPDATE`, and `DELETE` privileges on `restaurant_tables` and `restaurant_inventory` are revoked from `PUBLIC`, `anon`, and `authenticated`. The backend role retains its required access.
- Reads remain RLS-protected; explicit `SELECT` policies permit active, allowed-role members to read rows only for their exact tenant/business/branch. Existing restrictive session and workspace-scope policies continue to apply.
- The PostgreSQL integration fixture enables RLS and checks that both branch-scoped read policies exist, while the static validator guards SQL quoting and the production `text` type of inventory IDs.

## Mandatory release order

1. Run the full CI suite on the exact release commit. Required checks include the RC459/RC460/RC461 PostgreSQL integration, restaurant workspace contract, Deno type checks, migration version uniqueness, migration-history immutability, open-PR migration collision guard, and full migration-chain replay.
2. Review the complete pending migration chain. The live migration ledger observed during the read-only audit ended at RC424; **do not apply RC461 alone or skip the reconciled migrations that precede it**.
3. Confirm the approved migration window, backup/recovery readiness, and that the RC461 version is absent from the live ledger.
4. Apply the approved pending migration chain through the project's approved migration pipeline. Do not use a one-off production SQL execution to bypass migration history.
5. Verify the RC461 migration ledger entry and read-only privilege checks: direct DML denied to `anon` and `authenticated`; backend RPC executable by `service_role` only.
6. Deploy `restaurant-workspace-mutate` to Supabase after the migration succeeds. GitHub Pages deployment does not deploy Edge Functions.
7. Deploy the web bundle only after the Edge Function is confirmed active and the workspace RPC is present.
8. Perform authorized staging/disposable-database tests for create/update table, create/update inventory, branch-member reads, cross-branch read/mutation denial, inactive business/branch denial, and audit atomicity. Verify production function version and ACLs read-only after deployment.

## Rollback constraints

- Do not restore direct browser DML as a rollback shortcut.
- If the Edge Function deployment fails after the migration, keep direct client mutations denied and roll forward by restoring the compatible Edge Function.
- If the migration fails, stop the rollout and reconcile the exact failing migration chain; do not manually mark migrations as applied.
- No production mutation canary or synthetic production rows are authorized by this runbook.

## Release gate

RC461 remains **NOT PRODUCTION VERIFIED** until CI passes on the release head, the complete pending migration chain is reconciled, and the deployed Edge Function plus database ACLs are independently verified.
