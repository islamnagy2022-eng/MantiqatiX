# Live Security-Definer Surface Review — 2026-10-18

## Status

**Review required; no production changes performed.** This document records a read-only review of the connected Supabase project's live PostgreSQL catalog and Security Advisor findings. It is evidence for remediation planning, not a certification that the whole database is safe.

## Evidence captured

- Security Advisor observation time: 2026-10-18 02:41 UTC (tool-reported timestamp).
- Advisor reports:
  - 1 table with RLS enabled and no policies: `public.digital_page_payment_events`.
  - 1 anonymous-executable SECURITY DEFINER function: `public.get_mnty_targeted_advertisements(...)`.
  - 40 SECURITY DEFINER functions executable by `authenticated`.
- A read-only catalog query independently enumerated 40 public SECURITY DEFINER functions for which `authenticated` has EXECUTE.
- Live migration ledger remains at 283 migrations, latest version `20261008222845` (`rc424_atomic_digital_page_payment_webhook`). The successful forward-chain replay is an isolated test and does not mean the newer migrations are deployed.
- No DDL, grants, policy changes, financial operations, or deployments were performed during this review.

## Findings and required disposition

### 1. `public.digital_page_payment_events` — RLS without policies

Security Advisor labels this INFO. The absence of policies can intentionally deny direct access to `anon` and `authenticated`; it is not by itself proof of a vulnerability.

Required checks before closure:
1. Confirm intended access is server-only.
2. Verify the service-role/Edge Function path can perform the required inserts and reads.
3. Add a regression test proving anonymous and ordinary authenticated clients cannot read or mutate event rows, while the intended backend path works.
4. Document the expected policy-less RLS state so future reviewers do not add broad policies merely to silence the advisor.

Do not add a permissive policy just to clear the warning.

### 2. `public.get_mnty_targeted_advertisements(...)` — anonymous SECURITY DEFINER

The live catalog shows this function is executable by `anon` and `authenticated`, uses `SECURITY DEFINER`, and currently has `search_path = public, pg_temp`. This may be intentional for public advertisement discovery, so revoking public execution without tracing callers could break the product.

Required checks:
1. Compare the complete live function body and ACL with the authoritative migration/source.
2. Verify every referenced relation and function is schema-qualified.
3. Verify bounds on `p_limit`, coordinate inputs, output fields, and the targeting logic; ensure no private advertiser or tenant data is returned.
4. Verify the function's owner and all underlying object grants.
5. In a disposable database, test anonymous calls with valid, malformed, extreme, and cross-region inputs.
6. If public access is intended, use a hardened immutable search path and schema-qualified references, then test the intended contract before proposing a reviewed migration. Do not change production directly.


### 2.1 Live body inspection — targeted advertisement RPC (2026-10-18)

A follow-up read-only catalog inspection retrieved the complete live definition, owner, and ACL for `public.get_mnty_targeted_advertisements(...)`.

Observed facts:
- Owner: `postgres`; ACL includes `anon=X` and `authenticated=X`.
- The function is SQL `SECURITY DEFINER` with `search_path = public, pg_temp`.
- All four relations referenced in the body are explicitly schema-qualified: `public.advertisements`, `public.advertisement_target_locations`, `public.platform_geo_areas`, and `public.platform_global_advertisements`.
- Normal advertisement rows are filtered to `status='ACTIVE'`, `approval_status='APPROVED'`, active start/end windows, and optional ad-space match. Target locations must be active and match the requested country code (default `EG`). Global ads are separately filtered to active/approved/time-window/ad-space.
- The returned fields are advertisement ID, title, creative URL, target URL, ad-space ID, match level, and computed distance. The result is ranked by targeting tier and distance/time, with `p_limit` clamped to 1–50 (default 3).

Unresolved checks (not inferred as passed):
- There is no explicit latitude/longitude range validation before the distance formula. Test null, boundary, out-of-range, NaN/infinity representations where accepted, and mismatched coordinates in a disposable PostgreSQL instance; record whether the function returns bounded results or raises errors.
- Validate the maximum output volume, global-ad exposure contract, and whether all returned fields are intentionally public.
- Compared with candidate migration `supabase/migrations/20261010200000_rc451_targeted_ads_empty_search_path.sql` on PR #286: RC451 changes only this function's configuration to `SET search_path = ''`, explicitly preserves anonymous execution, and relies on the schema-qualified table references observed in the live body. The live catalog still reports `search_path = public, pg_temp`, so RC451 is **not applied to production** according to the live function configuration / migration ledger. Run anonymous positive/negative regression tests and verify final migration-chain replay before any production migration.
- Consider `SET search_path = ''` with schema-qualified object references in a reviewed forward migration, but do not apply a hotfix or revoke `anon` execution without a verified product contract and regression coverage.

This body inspection narrows the review but does **not** establish full authorization safety or close the public-RPC finding.

### 3. Forty authenticated-executable SECURITY DEFINER functions

The advisor count is a review queue, not a count of confirmed vulnerabilities. Several functions are backend RPCs whose implementations compare a supplied user ID with `auth.uid()` or delegate authorization to helpers. A text search for `auth.uid()` alone cannot establish correctness.

Required audit per function:
- Confirm caller roles and the minimum required EXECUTE grants.
- Verify every client-supplied actor/user ID is derived from or compared with authenticated identity.
- Verify tenant/business/branch scope and role checks occur inside the privileged function, not only in the UI.
- Verify state transitions, amount/commission calculations, idempotency, and concurrency behavior for financial functions.
- Verify `search_path` is fixed safely and object references are schema-qualified.
- Add positive and negative behavior tests, including unauthorized cross-tenant attempts.
- Revoke unnecessary grants only after call-site inventory and regression tests. Do not apply a blanket revoke or blanket grant.

The read-only query found several functions with `search_path = public` and others with `public, pg_temp`; each must be evaluated against its exact body and caller contract. The count does not imply all functions share the same risk.

## Live financial-journal Edge Function drift — 2026-10-18

A separate read-only source-parity check compared the active Supabase Edge Function with the current repository source.

Observed live state:
- `financial-journal` is ACTIVE at deployed version 3.
- Its live `index.ts` calls `admin.rpc("post_financial_journal", { p_entry, p_lines })` without a verified actor ID parameter; it also sets `Access-Control-Allow-Origin: *`.
- Live PostgreSQL catalog ACL for both `public.post_financial_journal(jsonb,jsonb)` and `public.post_financial_journal_backend(uuid,jsonb,jsonb)` is `{postgres=X/postgres}`; read-only `has_function_privilege('service_role', ...,'EXECUTE')` returns false for both.
- Current repository `supabase/functions/financial-journal/index.ts` instead verifies the bearer token, rejects anonymous users, requires a POSTED journal, and calls `post_financial_journal_backend` with `p_user_id: user.id`.
- Therefore the live function and repository source are **DRIFTED**, and the live RPC privilege state does not support the deployed call. Treat the live financial-journal endpoint as **NOT VERIFIED / likely nonfunctional** until an approved, end-to-end check confirms the actual runtime response.

Read-only entrypoint parity spot-check (2026-10-18):
- Compared the live Supabase `index.ts` with repository `main` for 24 unique active functions across payments, orders, settlements, business registration/approval, legal, ERP, subscription, AI proxy, marketing lead creation, and selected administration paths.
- **23/24 entrypoints were byte-identical** to the corresponding repository file.
- The only mismatch in this sample was `financial-journal`, described above. This is a bounded spot-check, not proof that all deployed Edge Functions or their import maps/configuration are in parity.

Required disposition:
1. Do not grant `service_role` execute on the legacy `post_financial_journal` as a quick fix; the legacy contract does not bind the caller's verified actor ID in the same way as the repository backend contract.
2. Resolve the historical migration-chain blocker, then review and apply the RC450 service-role/actor-boundary migration in chronological order in the approved release process.
3. Run disposable PostgreSQL regression tests and approved non-financial dry-run validation, deploy the repository source only after its backend RPC/grants are present, and verify the deployed function version/source parity.
4. No production function, grant, migration, ledger, payment, or financial data was changed during this inspection.

## Release-gate decision

- Live Security Advisor review: **VERIFIED — findings observed**, not remediation complete.
- Full SECURITY DEFINER authorization review: **NOT VERIFIED**.
- Public advertisement RPC hardening: **NOT VERIFIED**.
- Event-table backend-only access contract: **NOT VERIFIED**.
- Tenant isolation E2E on production-equivalent deployed policies: **NOT VERIFIED**.
- Production release: **BLOCKED / NOT CERTIFIED**.

## Safe next steps

1. Run the per-function review in a disposable environment using the exact candidate migrations.
2. Prioritize financial mutation, admin, settlement/refund, tenant-scoped write, and public RPC functions.
3. Add targeted SQL regression tests and source/production parity checks.
4. Submit reviewed changes through normal pull-request and CI gates.
5. Keep production unchanged until approval and rollback/backup requirements are satisfied.
