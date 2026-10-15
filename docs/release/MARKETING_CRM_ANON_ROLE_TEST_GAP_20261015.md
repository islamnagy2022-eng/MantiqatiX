# Marketing CRM Negative-Test Coverage Note — 2026-10-15

**Status: REVIEW NOTE — not a confirmed vulnerability; release remains blocked.**

## Evidence reviewed

- `supabase/tests/rc452_marketing_crm_scope_fixture.sql`
- `supabase/tests/rc452_marketing_crm_scope_integration.sql`
- `.github/workflows/marketing-crm-tenant-scope.yml`
- CI run: https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38687517726

The CI run passed both the source-contract validator and a disposable PostgreSQL test applying RC452, RC526, and RC527 before the integration test.

## Specific test-boundary limitation

The integration test begins with `SET ROLE authenticated`. Its “anonymous session” case changes the JWT claims to `{"is_anonymous":true}` but does not switch the database role to `anon`. This usefully tests the policy predicate for an anonymous-style claim under the authenticated database role, but it does not independently prove the actual `anon` database role has no mutation path through table grants, alternate policies, or exposed RPCs.

This is a coverage gap, not proof that anonymous mutation is possible.

## Recommended isolated follow-up

1. Add a separate disposable-database test using `SET ROLE anon` and the same public schema/privilege setup as production, then attempt SELECT/INSERT/UPDATE/DELETE against the shared `marketing_services` catalogue.
2. Assert the expected behavior for public active-catalogue reads, and rejection of all anonymous writes.
3. Inspect effective grants and all permissive policies; test exposed RPC/Edge Function paths separately where relevant.
4. Keep the existing `authenticated` + `is_anonymous=true` case as a distinct regression test.
5. Run against the approved migration sequence and preserve exact-run logs.

Do not change production grants or policies to make the test pass. Do not infer production security from the fixture alone.
