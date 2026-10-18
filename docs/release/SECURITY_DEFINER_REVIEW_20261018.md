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
