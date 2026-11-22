# Pass 1891–1900 — Li2Lak review concurrency and PostgreSQL 17 test parity

Date: 2026-11-22  
PR: [#971](https://github.com/islamnagy2022-eng/MantiqaTix/pull/971)  
Code change before documentation commits: `babd3417750796918d0beb074a6e8842dd784a1a`

## Source changes

- RC497 review insertion now uses `ON CONFLICT (order_id) DO NOTHING` and a locked reread after a unique-order conflict.
- The fallback returns the existing review only for an exact same-customer, same-rating, same-text retry. A changed payload remains rejected as `REVIEW_ALREADY_SUBMITTED`; foreign ownership remains forbidden.
- A new SUBMITTED event is written only when the new review row was actually inserted.
- Static validation now requires the conflict fallback contract.
- `.github/workflows/order-idempotency-scope.yml` now uses PostgreSQL 17 for both the service image and container selection, matching the review lifecycle workflow and forward migration replay.
- Static validation checks that both Edge callers verify the bearer token with Supabase Auth before invoking the JWT-scoped order RPC, and that the RC498 integration covers authenticated EXECUTE, anon denial and the retained service-role path.

## Evidence and limitations

- The RC497 migration source contains the unique constraint on `order_id`; the new insert conflict path is explicit in source.
- The order integration fixture contains a partial unique index on `(tenant_id, client_idempotency_key)`, and its behavioral suite exercises idempotency scope, actor spoof rejection, service-role creation and RC498 authenticated ACL/pricing behavior.
- The order integration workflow now uses PostgreSQL 17.
- The source and workflow files were retrieved from the active feature branch after the changes.
- No local PostgreSQL server or container runtime is available in this execution environment. Therefore no local SQL execution is claimed.
- At the last exact-head check before these commits, GitHub Actions runs for the previous code head were still queued. The latest code commit and subsequent documentation commits require fresh exact-head CI; no passing CI result is claimed here.

## Release safety

- RC497 and RC498 remain source candidates and have not been applied to Production.
- No Production database, Auth, RLS, GRANT, Storage, Edge Function, payment, wallet, customer-data or public deployment mutation occurred.
- Do not merge or deploy until exact-head CI, full chronological migration replay, Production schema/ACL/RLS reconciliation, encrypted off-site backup, key recovery and independent PostgreSQL 17 restore/rollback are complete.

**PRODUCTION BLOCKED / NOT CERTIFIED.**
