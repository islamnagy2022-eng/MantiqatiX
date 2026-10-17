## 2026-10-18 — REPLAY-RESUME-004

### CI-REPLAY-003 — exact failure root cause recovered
- **SHA:** `5083a7e1ebd522b064688c47d76b81eaaf9cb1d4`
- **Workflow:** Disposable Supabase Migration Chain Replay
- **Run:** [39072680440](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39072680440)
- **Result:** FAIL at migration `20261006101048_rc_mantigo_production_completion_v1.sql`, statement 11: `function public.list_open_mantigo_rides_backend(uuid) does not exist`.
- **Evidence:** [job log](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39072680440) identifies the failing `GRANT EXECUTE`. The tracked migration grants this function but does not create it; the source-only RC446 migration later replaces the function. The production schema snapshot at checkpoint `20261008222845` contains the observed pre-RC446 function definition.
- **Action:** Added `supabase/tests/baselines/mantigo_open_rides_function.sql` (blob `89943262f16ae973c1cfc423412d417961dbfd96`) as a clearly marked test-only live-derived compatibility baseline, and updated the disposable replay workflow to inject it as temporary version `20261006101047` before the historical grant. Added fail-closed validation for provenance, function contract, no-data behavior, workflow copy/check, and absence of a version collision.
- **Current validation commit:** `8c3814ec12206769a6be546a9afc7ed80450554d`. Replay run [39079676044](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39079676044) was **PENDING** when last inspected; no PASS is claimed.
- **What it proves:** the missing dependency was identified, and a replay-only compatibility input was implemented from the captured live schema.
- **What it does not prove:** original function-creation migration/version or historical body provenance; successful full replay; runtime tenant isolation; payment/finance E2E; backup/restore; or production readiness. The baseline is not historical DDL and must never be applied to production.

### CI-TENANT-001 — fail-closed verifier contract
- **SHA:** `95860b316f4dfcbc157d1d32be50d4aa1fcce2d9`
- **Workflow:** Tenant Isolation Verifier Contract
- **Run:** [39079194583](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39079194583)
- **Result:** PASS for the static verifier/fixture contract after strengthening assertions for own-tenant visibility and cross-tenant denial of businesses, orders, payment intents, and onboarding.
- **Limitation:** this is a static contract test only; it does not prove the SQL verifier passes against a disposable restored schema or that deployed production RLS provides tenant isolation.

# Test Execution Ledger — Migration Recovery Branch

This ledger records tests and CI results inspected for the migration-recovery work. Results are scoped to the exact SHA and workflow; a successful static or focused test is not production certification.

## 2026-10-18 — REPLAY-RESUME-003

### CI-REPLAY-001 — current full replay run inspected
- **SHA:** `5083a7e1ebd522b064688c47d76b81eaaf9cb1d4`
- **Workflow:** Disposable Supabase Migration Chain Replay
- **Run:** [39072680440](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39072680440)
- **Result:** FAIL. The job passed historical-schema preflight, compatibility-baseline injection, exact-copy/untracked verification, Supabase service startup, and disposable alias normalization; it failed at **Replay every migration in repository timestamp order**. Ledger recording and replay-completion verification were skipped.
- **Failure detail limitation:** The accessible Actions run/job metadata did not expose the SQL error text. Do not claim this run failed on a specific migration without the job log.
- **What it proves:** the disposable replay environment started and reached the chronological migration step, but the complete migration chain did not pass.
- **What it does not prove:** full replay success, production readiness, runtime tenant isolation, payment E2E, or backup/restore.

### CI-REPLAY-002 — earlier full replay failure inspected
- **SHA:** `a474cc45a4a2a3960760482976ebb79e8c9e1eed`
- **Workflow:** Disposable Supabase Migration Chain Replay
- **Run:** [39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756)
- **Result:** FAIL at the chronological replay step. The contemporaneous review proposal `docs/release/COMBINED_REPLAY_BASELINE_APPROVAL_20261017.md` records this run stopping at missing `public.marketing_provider_services`, before the later `MNTY-MAIN` organization-row dependency.
- **Scope:** this is the specific documented failure for that older SHA; do not automatically attribute the same SQL error to run 39072680440.

### BASELINE-REPLAY-001 — historical SECURITY DEFINER function dependency
- **Source file:** `supabase/tests/baselines/legacy_security_definer_functions.sql`
- **Exact blob SHA:** `ed4270f8fbfa2881fbfd6b251161ec4cbe7fd2c7`
- **Validation source:** `scripts/validate-historical-schema-baseline.mjs` on branch `reconcile/rc425-458-current-main-20261011`.
- **Workflow behavior:** `.github/workflows/migration-chain-replay.yml` injects this file as a **test-only** disposable-replay compatibility baseline at version `20260927074160`, before `20260927095000_revoke_unused_security_definer_execute.sql`. The validator checks all ten expected signatures, including `public.counter_offer_indrive_bid(uuid,uuid,numeric)`, SECURITY DEFINER, explicit search_path, and exact ACL revocation.
- **Interpretation:** this baseline allows the disposable replay to proceed past the missing function-creation dependency using the current live-derived function definition. It is **not** the original historical creation migration and does not recover its original timestamp/body. Historical provenance remains unresolved for release certification; no production use is permitted.

### NEXT-BLOCKER-001 — combined replay baseline approval
- **Evidence:** `docs/release/COMBINED_REPLAY_BASELINE_APPROVAL_20261017.md` is explicitly marked **PROPOSED ONLY — not implemented, not injected, not approved**.
- **Fixture A:** live-derived schema and active public-read policy for `public.marketing_provider_services`, whose original creation/policy source is absent from the applied migration ledger and tracked source.
- **Fixture B:** minimum `MNTY-MAIN` organization row needed by a later showcase migration; do not create auth users or memberships in this fixture.
- **Next action:** obtain explicit owner approval for these two exact test-only fixtures together, or recover trusted original source/artifacts. Until then, do not inject the fixtures or modify the replay workflow to use them. No historical DDL is to be fabricated or backdated.
- **Production gate:** BLOCKED / NOT CERTIFIED.

## Execution discipline
No manual test was intentionally rerun in this session. The existing GitHub Actions runs above were inspected and recorded; no production mutation, migration application, deployment, payment, merge, or release occurred.
