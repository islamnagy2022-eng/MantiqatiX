# Pass 1586–1595 — RC495 Storage filename and platform-root registry repair

Date: 2026-11-21  
Candidate: PR #958 (consolidated security/migration release candidate)  
New migration: `20261121020000_rc495_storage_filename_regex_forward_repair.sql`  
Production status: **BLOCKED / NOT CERTIFIED**.

## Fresh read-only Production evidence

Supabase project `moyhiluyhjsujhwlyeuu`:

- Migration ledger: 310 rows, latest applied version `20261110150618`.
- RC488–RC495 applied: 0.
- The five affected Storage policies exist on `storage.objects`.
- Live `mnty_platform_brand_insert/update/delete` policies authorize through ACTIVE `SUPER_ADMIN` rows in `public.user_memberships`, not the canonical private platform-admin registry.
- The platform-brand and provider profile-media filename predicates contain over-escaped literal-dot expressions (catalog output contains doubled backslashes before the dot).
- `public.mnty_can_platform_admin()` and `private.platform_admins` exist, but the live helper is not yet verified with an empty search_path. RC464 in the ordered source chain hardens the helper before RC495 uses it.
- No Storage object names or customer media were read; only policy metadata and aggregate migration state were queried.

## Source correction

PR #950 proposed a timestamp `20261121010000` RC493 migration that repairs the regex but retains membership-derived platform-brand authority. It is not adopted. The consolidated candidate instead adds RC495 at unique timestamp `20261121020000` and:

1. Uses `public.mnty_can_platform_admin()` for platform branding INSERT, UPDATE and DELETE. It removes the direct `user_memberships` / `SUPER_ADMIN` authorization predicate.
2. Repairs the five affected filename predicates using `[.]` for literal extension separators.
3. Preserves provider profile ownership checks and bucket boundaries.
4. Requires explicit `is_anonymous=false` in provider profile-media INSERT and UPDATE predicates; RC488 restrictive policies remain in the ordered chain as an additional confirmed-Auth boundary.
5. Adds SQL regression coverage for accepted/rejected filenames, policy expressions, registry-backed platform root, owner scope and missing/anonymous Auth claims.
6. Extends the exact release migration contract, production verifier, migration-gate validator, reconciliation manifest and PostgreSQL forward-replay workflow from 74 to 75 ordered versions.

## Validation state

- Static source cross-check confirms 75 migration timestamps in the exact ledger contract, 75 entries in the migration-gate list and 75 entries in the production verifier; all are chronologically ordered and include RC495.
- Reconciliation manifest now records 75 required versions and the fresh live ledger still has 0 applied.
- RC495 source validator and PostgreSQL replay/integration workflow are wired. Exact-head CI is pending; no test pass is claimed yet.

## Safety and disposition

- No Production migration, DDL/DML, RLS/GRANT, Storage object, Auth, Edge Function, payment, wallet or customer-data mutation occurred.
- Do not merge PR #950's membership-derived Storage policy version. It is superseded by the RC495 registry-backed correction in PR #958.
- Do not deploy Storage policy or Edge changes independently. Apply only after the complete chronological migration chain, verified encrypted backup/restore, coordinated Edge parity, and release approval.
- Production remains **BLOCKED / NOT CERTIFIED**.

## CI failure triage and correction — 2026-11-21

- A completed run on overlapping PR #959 exposed a validator-only failure before full forward replay: the RC492 validator used double-escaped dots in JavaScript regex literals, so it searched for a backslash plus wildcard rather than the literal schema/table separator.
- Corrected the two grant-match expressions and the no-privilege-widening expression in consolidated PR #958 at commit `918d437738af7db0541f2948d411c69f3d7f78ad`.
- Independently re-evaluated the corrected assertions against the exact fixture: request SELECT+DELETE matched; bid SELECT matched; unauthorized request INSERT/UPDATE and bid INSERT/UPDATE/DELETE grants remained absent.
- PR #958 exact-head CI restarted at the correction commit; all 14 reported checks were queued at the latest read. This is not a CI pass. The previous PR #959 PostgreSQL 16 and forward-replay failures were caused by the same static validator assertion; replay did not reach the complete migration sequence.
- No Production mutation occurred.


## Follow-up regression coverage hardening — 2026-11-21

A final source review found that RC495's migration already included the confirmed-Auth predicate in provider-media UPDATE `USING`, but the SQL regression assertion only checked owner scope and anonymous-claim text without pinning the filename expression in that `USING` predicate. The source was correct; the regression test was incomplete. The test now also asserts the literal-dot filename predicate and rejects the doubled-backslash pattern in UPDATE `USING`, and the static validator pins the confirmed-Auth predicate in that exact policy clause. Commits: `975e138f0e7d3f43e37706c4f0abdc52a9d7a8f4` and `ff3e5f5daff94b38014d26552eca95664ba863d1`.

Fresh read-only Production ledger check against the exact 75-version release list: 310 rows; latest `20261110150618`; 0/75 required versions applied; RC488–RC495 0/8 applied. No Production changes.

