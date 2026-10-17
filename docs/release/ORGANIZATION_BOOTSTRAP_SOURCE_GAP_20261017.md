# Organization Bootstrap Source Gap — RC339 Replay Blocker

**Date:** 2026-10-17  
**Status:** CONFIRMED SOURCE GAP; repair path pending privacy/replay approval  
**Production:** read-only inspection only; no changes made

## Exact failure

The full disposable replay [run 39010790236](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39010790236), exact commit `e3bf38487f4f2e180dec4482cde581c05a4f4ec7`, successfully passed historical-baseline preflight, test-only baseline injection, Supabase startup, and migration-alias normalization. It then failed while applying the canonical live-ledger RC339 migration `20261004005819_rc339_seed_mantiqati_official_showcase`:

- SQLSTATE: `23503`
- Constraint: `businesses_organization_id_fkey`
- Missing key: `organizations.id = 'MNTY-MAIN'`
- Failing insert: showcase business seed sets `tenant_id='MNTY-PLATFORM'` and `organization_id='MNTY-MAIN'`.

This is the **first SQL execution failure** after the alias normalization correction.

## Read-only production evidence

A read-only query against the connected Supabase project confirmed the live `public.organizations` row:

- `id`: `MNTY-MAIN`
- `tenant_id`: `MNTY-PLATFORM`
- `name`: `MNTY Main Organization`
- `code`: `MNTY-ORG`
- `status`: `ACTIVE`
- `settings`: `{"bootstrap":"2026-09-27"}`

The live migration ledger also contains version `20260927131555`, name `bootstrap_mnty_owner_islam_nagy_v2`, with one applied statement (1,286 characters; MD5 `6eec2cb0d371be273949a444f6dc8272`). The statement creates the canonical platform tenant and organization and also creates an owner membership tied to an Auth user.

A repository-history search for the expected source path `supabase/migrations/20260927131555_bootstrap_mnty_owner_islam_nagy_v2.sql` returned no commits. The source is missing from reachable repository history, even though its applied ledger entry exists.

## Privacy / source handling

The exact applied statement hard-codes an owner email in its Auth-user lookup and error text. The unredacted statement has **not** been copied into the public repository in this repair. Do not publish that PII-bearing SQL without explicit privacy review. The statement's MD5 and length are recorded above for evidence; they are not a substitute for storing a reviewed source artifact.

## Root cause

**Confirmed:** the repository's clean replay does not have the organization row because the original bootstrap migration source is absent. RC339 depends on that data. The production row exists, but the production schema snapshot is schema-only and does not include row data.

This is not yet proof that RC339 itself is defective. The failure may be repaired by restoring the authoritative bootstrap source through a privacy-reviewed route or by an explicitly approved test-only data baseline. A forward migration timestamped after RC339 cannot repair the earlier clean-replay dependency by itself.

## Safe repair choices

### Path A — Recover exact historical source through a reviewed/private artifact

- Preserve the exact applied statement from the migration ledger in a restricted review artifact.
- Review whether the owner email should remain in any public source tree and decide on an approved redaction/parameterization strategy without falsely claiming byte-for-byte parity.
- Compare the reviewed source to the applied statement by byte length/hash; record any privacy-driven transformation as a divergence, not an exact recovery.
- Do not merge a public PII-bearing migration without explicit approval.

### Path B — Test-only organization seed baseline for disposable replay

- Obtain explicit approval for a **test-only** baseline containing only the minimum observed organization/tenant seed needed for downstream migrations.
- Place it under `supabase/tests/baselines/`; inject it only into the disposable replay workspace before RC339.
- Do not include production Auth users, owner memberships, secrets, or unrelated rows.
- Pin the exact observed values/hash and assert the fixture is test-only and never applied to production.
- Label any resulting run **baseline-assisted chronological replay**. This does not recover the missing original migration source or certify that production can be rebuilt from original repository migrations.

No such baseline has been added or enabled in this commit because approval for this non-SMM data fixture has not been established.

## Acceptance criteria

1. The source-provenance/privacy decision is documented.
2. A reviewed path (A or B) is explicitly approved before implementation.
3. The exact replay runner reaches RC339 without mutating production.
4. The next first migration failure, if any, is captured and fixed by root cause.
5. The test result is recorded once with exact SHA, run URL, result, artifact, and scope.
6. The production gate remains blocked until true historical provenance, tenant isolation, payment E2E, backup/restore, and all runtime release gates pass.

## Safety status

No production SQL mutation, migration, data write, grants/RLS/Auth change, function deployment, payment, merge, or release occurred. Production remains **BLOCKED / NOT CERTIFIED**.
