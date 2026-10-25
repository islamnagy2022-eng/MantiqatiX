# Production security audit — 2026-10-26

## Scope and safety

This audit used read-only SQL against the connected production Supabase project `moyhiluyhjsujhwlyeuu`. No DDL, DML, grants, Auth settings, Edge Functions, migrations, or deployments were changed.

This document distinguishes live production observations from candidate-branch fixes and isolated CI evidence.

## Confirmed live observations

### Platform-admin boundary

The live definition of `public.mnty_can_platform_admin()` is:

```sql
select public.mnty_can('admin', null, null, null)
```

The function is `SECURITY DEFINER`, `STABLE`, and has `search_path = public, pg_temp`. The production authorization path therefore delegates a platform-wide decision to a generic admin permission check with null scope. This is a high-risk authorization boundary because tenant-level `OWNER` permission must not imply platform-wide administration.

Platform-wide RPCs depending on this helper include global advertising administration and MantiGO platform-wide financial/operations functions. Their full authorization/grant contracts require individual review before release.

### SECURITY DEFINER inventory

A read-only catalog query found **36 public SECURITY DEFINER functions** executable by `authenticated` and/or `anon`. This is an inventory requiring function-by-function review, not a claim that all 36 are vulnerable. A fixed `search_path` is necessary but does not replace caller identity, tenant/business/branch scope, role checks, and least-privilege EXECUTE grants.

The anonymous-executable `get_mnty_targeted_advertisements` may be an intentional public read path. Do not revoke it without reviewing the public advertisement contract.

### Migration checkpoint

The recorded production migration ledger remains at `20261008222845 / rc424_atomic_digital_page_payment_webhook`. The new digital-page/menu candidate migrations are not applied to production. The deployment job is skipped while PR #374 remains draft.

## Candidate remediation and test evidence

PR #282 contains the forward-only RC441 and RC462 candidates:

- RC441 changes `mnty_can_platform_admin()` to require an active `SUPER_ADMIN` membership in tenant `MNTY-PLATFORM`, explicit platform scope, and full control; it also hardens platform-wide MantiGO RPC authorization.
- RC462 replaces unsafe text-to-Boolean coercion with exact JSON containment for Boolean `true`, uses a `VOLATILE` PL/pgSQL guard to re-evaluate request identity, and revokes execute from `PUBLIC` and `anon` while granting the helper to `authenticated`.
- The RC462 disposable regression checks malformed permission values and verifies denial at multiple high-risk platform RPCs.

Focused disposable PostgreSQL sequence RC449 → RC462 → RC565 passed in [run 40240493419](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40240493419). The current combined candidate replay passed in [run 40240762538](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40240762538), and independent forward replay passed in [run 40240762509](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/40240762509). These tests ran in disposable databases; they do **not** prove the candidate fix is live in production.

## Release blockers

1. Resolve base-branch conflicts in PR #86 and PR #282 without force-updating or rewriting historical migration sources.
2. Verify RC441 → RC462 ordering and tenant-owner denial on the exact canonical candidate chain.
3. Review every public SECURITY DEFINER function's body, identity source, scope checks, `search_path`, volatility, and EXECUTE grants; test unauthorized caller denial.
4. Run authenticated browser E2E for the digital-page subscription lifecycle, including independent payment-reference review, manual admin activation, owner access, expiry, and publication.
5. Complete payment/finance E2E, Edge Function and SMM gateway contract verification, backup/restore rehearsal, live Auth hardening review (including leaked-password protection), and deployment/rollback smoke.
6. Obtain explicit rollout approval before any production migration, grant change, Auth setting change, Edge Function deployment, or release.

## Release decision

**BLOCKED / NOT CERTIFIED.** Do not infer production readiness from static validation or disposable migration replay. Production was not changed during this audit.
