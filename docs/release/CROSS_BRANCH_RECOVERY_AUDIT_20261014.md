# Cross-Branch Historical Source Recovery Audit — 2026-10-14

## Status

**BLOCKED / NOT CERTIFIED.** This report records source-search evidence only. It does not approve a production change, merge, deployment, or new disposable baseline.

## Repositories and branches examined

- Focus branch: `recovery/verified-rc425-441-sources-20261014` (PR #248).
- Additional recovery branch: `fix/replay-marketing-project-baselines-20261013`.
- Main at the reviewed baseline: `0650db959a460885941d65ad1feabcdd89ae58f1`.
- Supplied archive: `source_RC40.zip`, SHA-256 `e3e564dd8c142028d8aca94fee328c9e1ab6407f02bd98465d335cc0c180a09e`.

## Findings

### 1. SECURITY DEFINER creation history

The tracked migration `20260927095000_revoke_unused_security_definer_execute.sql` revokes client execution from ten legacy functions, including `public.counter_offer_indrive_bid(uuid,uuid,numeric)`, but repository search did not locate their original creation migration. Read-only live catalog evidence confirms the function currently exists in production; that current definition is not proof of historical source.

The divergent recovery branch contains `supabase/tests/baselines/legacy_security_definer_functions.sql`, a live-derived test fixture at temporary replay version `20260927074160`. Its own header explicitly states that it is **not recovered historical DDL** and is intended for disposable replay only. No separate approval for this privileged function-body fixture was established in the evidence reviewed for PR #248. Prior SMM table-baseline approval must not be extended implicitly.

### 2. Credit and marketing schema history

The recovery branch also contains test-only compatibility fixtures for `credit_accounts`, `credit_periods`, and marketing project objects. The supplied RC40 archive and the repository searches performed for this continuation did not recover canonical creation DDL for the relevant missing dependencies. The live catalog and synthetic fixtures are not a substitute for historical provenance.

### 3. Branch divergence

GitHub comparison reported `fix/replay-marketing-project-baselines-20261013` as 634 commits ahead and 3 behind `main`. Do not merge or transplant that branch wholesale into PR #248; its broad, divergent change set requires independent review.

### 4. PR #248 exact-head CI evidence

For head `5beb4aac30393617a246a99932e95857651be4ab`, the following runs were completed successfully:

- [RC462 malformed platform-admin permission regression](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886995)
- [Migration version uniqueness](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509887047)
- [Migration history immutability](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886965)
- [Open-PR migration collision guard](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886928)
- [Module professionalization validation](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886932)
- [Backend-only module boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509887018)
- [MantiGO open-ride privacy boundary](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509886943)
- [Approval-action audit atomicity](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/38509887057)

The Pages workflow validated but skipped its deploy job because the production gate remained blocked. These focused successes do **not** prove complete chronological migration replay, tenant isolation, payment/finance E2E, backup restoration, Auth security configuration, or deployed Edge Function parity. The full replay remains NOT VERIFIED.

## Safe next steps

1. Continue searching for canonical historical SQL in trusted source history, approved backups, or deployment artifacts.
2. If unavailable, request narrowly scoped explicit approval before adding each further live-derived baseline to disposable CI; approval for one object does not authorize another.
3. Keep every compatibility fixture outside `supabase/migrations/`, with no production rows, and inject it only into a fresh disposable database.
4. Do not alter the historical revoke migration, create placeholder functions, skip migrations, merge PR #248/#218, or deploy while release gates are open.
5. Continue tracking the live SMM gateway fail-closed containment, MantiGO global-scope authorization, full replay, tenant isolation, payment/finance E2E, Auth settings, and backup/restore as independent production blockers.

## Production boundary

No production schema, migration ledger, RLS, grants, Auth settings, Edge Functions, secrets, wallet balances, payment records, or customer data were changed as part of this source-search continuation.
