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


## Fresh live-state refresh — 2026-10-14

Read-only Supabase inventory was rechecked after the cross-branch search:

- The applied migration ledger still ends at `20261008222845 / rc424_atomic_digital_page_payment_webhook`. Candidate RC425–RC462 and later migrations are not thereby proven applied; do not infer they are live.
- The deployed `smm-gateway` is now **ACTIVE version 10**, `verify_jwt=true`, source SHA-256 `80fe058973fafdee71e3c9637469077bf115dc2a29014f5f347b5a54ebe90994`.
- Unlike the older version evidence, the currently retrieved version 10 source includes `SMM_INITIAL_LAUNCH_DEFERRED=true` and checks this hard gate before authenticating/routing any POST action. The helper defaults to `SMM_DEFERRED`/503 unless both enablement and post-launch approval flags are exactly `true`. Since the source constant is hard-coded true, the deployed handler is statically fail-closed in this version. This is source inspection, **not a live negative HTTP test**; the latter remains unverified because no function invocation test was run in this continuation.
- The function's source also includes a 15-second provider request timeout, safe provider endpoint validation, redirect rejection, and bounded JSON parsing. These are source-level observations, not a complete SMM wallet/provider acceptance test.
- PR #248 head `5beb4aac30393617a246a99932e95857651be4ab` has focused passing CI evidence recorded above. A documentation-only audit commit `3f228e979546ab920ccd790abd92e5b87f51aef8` was added to the PR branch and verified by fetching the exact file back. No workflow runs or combined statuses were returned for that documentation commit at the time of check, so it has no new exact-head CI certification.

This updates the prior SMM deployment observation: the currently fetched live function is v10, not the previously documented v8/v6 snapshots. The broader production release remains blocked by unresolved historical replay provenance and other unverified acceptance gates.


## Security-advisor refresh — 2026-10-14 05:11 UTC

Read-only Supabase security advisors were queried for project `moyhiluyhjsujhwlyeuu`. Findings below are triage signals, not proof that every flagged policy is exploitable; policy expressions and function bodies must be reviewed before changing grants or RLS.

- **RLS enabled with no policy (1):** `public.digital_page_payment_events`. This normally means API roles have no policy-authorized rows; inspect intended service/backend access and payment-event processing before adding any policy. Remediation guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- **SECURITY DEFINER callable by anon (1):** `public.get_mnty_targeted_advertisements(...)`. Review whether public invocation is intentional, ensure location/targeting inputs cannot expose restricted campaign data, and add appropriate bounds/rate controls if needed. Do not revoke blindly before tracing public ad delivery. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- **SECURITY DEFINER callable by authenticated (40):** advisor flagged 40 functions. Audit each function's internal authorization, tenant/business/platform scope, actor-ID binding, and financial side effects. This warning alone does not establish a vulnerability; do not bulk-revoke EXECUTE because some functions may be intended authenticated RPCs. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- **Anonymous-role policy warnings (90 tables):** advisor output flags policies on 90 tables/storage objects as applying to anonymous users. These may reflect role targeting rather than a confirmed bypass; inspect each policy's USING/WITH CHECK expressions, especially finance, payment, tenant, CRM/marketing, notification/push, SMM wallet/orders, and ride tables. Prioritize verifying that any policy meant for signed-in users excludes `anon`; do not mass-edit policies without negative tests. Guidance: https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins
- **Leaked-password protection disabled (1):** Supabase Auth advisor reports compromised-password checks are disabled. The product's current primary sign-in flow is email OTP, so verify actual Auth configuration and whether password sign-in is enabled before selecting remediation; do not change Auth settings in production during this audit. Guidance: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### Deployment-workflow clarification

The workflow for documentation commit `d49ba7707b7e7aae839615038cfe9baeda6595f5` completed with overall conclusion `success`, but the job-level evidence shows `validate = success` and `deploy = skipped`. Therefore this is **not** evidence of a new production deployment or release certification. Existing exact-head focused tests are useful but do not close chronological migration replay, tenant-isolation, payment/finance E2E, backup/restore, Edge Function contract, or Auth configuration gates.

No production SQL, RLS/grant changes, Auth setting changes, Edge Function deployment, or financial writes were performed during this refresh. Release remains **BLOCKED / NOT CERTIFIED**.
