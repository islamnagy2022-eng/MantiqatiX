# Marketing Provider Services — Missing Historical Table Source

**Date:** 2026-10-17  
**Status:** CONFIRMED live schema/source-history gap; test-only baseline requires explicit approval  
**Production actions:** read-only inspection only

## Exact replay failure

Full replay [run 39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756), commit `a474cc45a4a2a3960760482976ebb79e8c9e1eed`, passed alias normalization and applied the restored ledger-source files through `20260927132406_lock_registration_direct_updates.sql`. It then failed on `20260927132904_restore_marketing_catalog_grants_and_owner_profile_access.sql`:

- SQLSTATE: `42P01`
- Error: `relation "public.marketing_provider_services" does not exist`
- First failing statement: `grant select on public.marketing_provider_services to anon, authenticated`

This is a replay prerequisite failure, not a grant syntax failure.

## Read-only production evidence

The connected production database has `public.marketing_provider_services` with:

- Columns: `id uuid` (gen_random_uuid, PK), `provider_id uuid NOT NULL`, `service_id uuid NOT NULL`, `service_description text`, `pricing_from numeric`, `pricing_to numeric`, `currency varchar NOT NULL DEFAULT 'EGP'`, `status varchar NOT NULL DEFAULT 'ACTIVE'`, `created_at timestamptz NOT NULL DEFAULT now()`.
- Constraints: unique `(provider_id, service_id)`; provider FK to `marketing_provider_profiles(id) ON DELETE CASCADE`; service FK to `marketing_services(id) ON DELETE CASCADE`; status constrained to `ACTIVE/INACTIVE`.
- Owner `postgres`; RLS enabled and FORCE RLS enabled.
- Current policies: public SELECT for `anon, authenticated` only when status is `ACTIVE`; owner-scoped ALL for authenticated users through `marketing_provider_profiles.owner_user_id = auth.uid()`.
- Current grants include SELECT to `anon` and `authenticated`; chronological migrations subsequently grant catalog access and create the owner-manage policy.

The reviewed production schema snapshot contains the exact table DDL. GitHub code search found no tracked `CREATE TABLE marketing_provider_services` source in the current default branch. The applied migration ledger rows mentioning the table are `20260924165707` (generic anonymous-session boundary closure, explicitly excludes this table from dynamic policy changes), `20260927132904` (grants/profile policy), `20260928095458` (owner RLS hardening), and `20261004005819` (showcase seed). None is the table-creation statement. The policy `Public can view active provider services` is also present in production but no applied ledger statement was found that creates it.

Existing product evidence in `docs/RC100_G5_PROVIDER_PROFILE_SERVICES_BASELINE.md` confirms the table is part of the established provider-services model; it does not recover the missing creation source.

## Root cause

**Confirmed:** production has a table and public-active-read policy whose creation source is absent from the applied migration ledger and the current repository source. The clean chronological replay therefore lacks the relation before the grant migration executes.

This is a historical source gap, not justification to edit the already-applied RC339 or grant migration. The schema snapshot is trustworthy evidence of current shape, but using it as a fixture would be a live-derived compatibility baseline, not original historical DDL.

## Safe replay-baseline proposal (not yet approved or enabled)

If explicit owner approval is given, add a disposable-only baseline before `20260927132904` and before `20260928095458` that:

1. Creates only the table shape, PK, unique constraint, FKs, status check, owner, and RLS/FORCE-RLS state listed above.
2. Recreates only the observed public-active SELECT policy, because no migration ledger statement recreates that policy.
3. Does **not** inject provider/service rows, grants, secrets, owner memberships, or the later `marketing_provider_services_owner_manage` policy. The chronological migrations remain responsible for grants and owner-management policy.
4. Is marked `OWNER-APPROVED TEST-ONLY LIVE-DERIVED COMPATIBILITY BASELINE`, references the read-only project/snapshot provenance, states `NOT recovered historical DDL`, and states `NEVER apply this file to production`.
5. Is copied/injected only into a disposable replay workspace and verified as untracked before replay. The resulting run must be labeled **baseline-assisted chronological replay**, not clean reconstruction from original migration sources.

No SQL fixture or workflow injection was added in this commit because explicit approval for this new baseline is not yet established.

## Acceptance

- Approve the exact test-only baseline scope above, or recover the original creation source from a trusted private/archive artifact.
- Add an isolated fixture and fail-closed validator only after that decision.
- Run full disposable replay once on the changed exact SHA and record the next first failure.
- Preserve the distinction between live schema evidence, test-only compatibility baseline, and original historical source provenance.

Production remains **BLOCKED / NOT CERTIFIED**.
