# Marketing Provider Services — Disposable Replay Baseline Proposal

**Date:** 2026-10-17  
**Status:** PROPOSAL ONLY — NOT APPROVED, NOT IMPLEMENTED  
**Scope:** disposable CI replay only; no production mutation or historical migration rewrite.

## Decision requested

Authorize (or reject) a narrowly scoped, test-only baseline for `public.marketing_provider_services` so the disposable replay can progress past the existing RC99 dependency. This proposal does not authorize changing production, adding guessed DDL to `supabase/migrations/`, or claiming historical source recovery.

## Confirmed replay symptom

The full disposable migration-chain replay [run 39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756) failed in the `replay-all-migrations` job during timestamp-ordered migration replay. The first currently documented missing-object gap is `public.marketing_provider_services` referenced by:

`supabase/migrations/20260928010000_rc99_g5_provider_services_rls_hardening.sql`

That migration drops and creates RLS policies on the table; it does not create the table. The failure is from a disposable CI database, not production.

## Source search completed

- Repository code search for `CREATE TABLE public.marketing_provider_services` returned no result.
- Reviewed the relevant main migration `20260928010000_rc99_g5_provider_services_rls_hardening.sql`; it assumes the relation already exists.
- Reviewed the 33 files under `supabase/recovered-migrations/` on PR #218's reachable source branch; none contains the table creation statement.
- Reviewed all changed-file pages of PR #218; no patch supplied an authoritative table-creation migration.
- Current-schema docs and the live-derived schema snapshot prove the table exists now, but do **not** prove the original historical creation source or timestamp.

## Available live-derived schema evidence

The existing schema-only snapshot on PR #284 is:

- File: `supabase/tests/baselines/production_schema_snapshot.sql`
- Blob SHA: `8d096904c777b4c7eae096014b45c59859c96cee`
- Snapshot SHA-256 in manifest: `ee16d095177110de67dac57f1b9a1e67610b40a3712981e850eff17d637a67a2`
- Capture workflow: [38993809648](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/38993809648)
- Manifest status: `PENDING_REVIEW`; the snapshot is explicitly test-only, contains no rows, and is not historical migration source.

The table definition in the snapshot records these columns:
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `provider_id uuid NOT NULL`
- `service_id uuid NOT NULL`
- `service_description text`
- `pricing_from numeric`
- `pricing_to numeric`
- `currency varchar NOT NULL DEFAULT 'EGP'`
- `status varchar NOT NULL DEFAULT 'ACTIVE'`
- `created_at timestamptz NOT NULL DEFAULT now()`

It also records a status check allowing `ACTIVE` or `INACTIVE`, a primary key on `id`, unique `(provider_id, service_id)`, foreign keys to `marketing_provider_profiles(id)` and `marketing_services(id)` with `ON DELETE CASCADE`, an index on `service_id`, table owner `postgres`, and FORCE RLS.

Snapshot policy/grant observations relevant to replay:
- Existing policy `Public can view active provider services` permits SELECT for `anon` and `authenticated` only where status is `ACTIVE`.
- Existing `marketing_provider_services_owner_manage` policy scopes authenticated writes through the owning provider profile; RC99 re-creates that policy.
- The captured snapshot includes SELECT/MAINTAIN table grants for `anon` and `authenticated`. Those grants must not be copied blindly into a hand-written fixture; the reviewed baseline should be derived from the exact snapshot block and the intended security contract must be tested explicitly.

## Proposed safe path — requires approval before implementation

1. Create a **test-only** fixture under `supabase/tests/baselines/`, outside `supabase/migrations/`, using the exact table definition and required dependency/security objects from the reviewed schema snapshot. Do not include table rows, credentials, user identifiers, or other production data.
2. Pin the source snapshot blob/hash and mark the fixture `TEST-ONLY SCHEMA BASELINE`, live-derived, not historical, never for production.
3. Add fail-closed validation that:
   - the fixture cannot exist under `supabase/migrations/`;
   - it creates only the documented table/constraints/index/policy prerequisite;
   - no rows or secrets are included;
   - the baseline is injected only into a fresh disposable database;
   - RLS, active-only public read, owner-scoped writes, and least-privilege grants are asserted after RC99 runs.
4. Run the full replay **once only after this new fixture is reviewed and wired into the disposable workflow**. Record the exact SHA, first failure/success, logs, and artifact. A pass must be labelled `baseline-assisted disposable replay`, never clean historical replay.
5. Keep the original historical-source gap open even if baseline-assisted replay passes.

## Acceptance criteria

- Written approval for this exact fixture and the disposable replay branch.
- Exact source snapshot blob/hash and manifest recorded.
- No production schema, data, grants, RLS, Auth, Edge Function, payment, or migration-ledger mutation.
- Exact-head static validation and policy/privilege integration pass.
- Replay advances beyond RC99 and reports the next first error without suppressing it.
- The test ledger records what the result proves and what it does not prove.

## Decision

**Not approved in this document.** Until the exact test-only baseline is explicitly approved, do not add it, do not rerun the unchanged replay, and do not synthesize a historical migration. The production release gate remains **BLOCKED / NOT CERTIFIED**.
