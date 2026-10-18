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

 
### STATIC-COMPAT-001 — replay fixture/workflow contract inspection
- **SHA inspected:** `dcf854731f368539f3133e8f96ac03331d8aa702` (documentation-only commits after code SHA `8c3814ec12206769a6be546a9afc7ed80450554d`; executable inputs unchanged).
- **Execution type:** assistant-side static assertions against the fetched baseline, workflow, and validator contents; not a repository test command or GitHub Actions result.
- **Result:** PASS for 9 assertions: provenance markers, function signature, SECURITY DEFINER/search_path, actor mismatch guard, absence of DML, temporary version presence, exact copy and comparison commands, untracked-only check, and validator integration.
- **What it proves:** the newly authored fixture and workflow wiring are internally consistent at the inspected source level.
- **What it does not prove:** PostgreSQL accepts the fixture, the workflow executes successfully, the full migration chain replays, or production function history is recovered. CI run [39079676044](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39079676044) remains the authoritative pending execution evidence at last check.

 
### CI-REPLAY-004 — pre-injection replay reproduced the blocker
- **SHA:** `c6e6b628c24eea86c1920dfd0b5ae066588aaa0e` (baseline file existed, but workflow injection/validator wiring had not yet landed).
- **Run:** [39079623274](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39079623274)
- **Result:** FAIL at the same `20261006101048_rc_mantigo_production_completion_v1.sql` grant with SQLSTATE `42883`: `function public.list_open_mantigo_rides_backend(uuid) does not exist`.
- **Interpretation:** this is expected pre-fix evidence and is not evidence about the new workflow commit `8c3814ec12206769a6be546a9afc7ed80450554d`; the baseline file alone is inert until the workflow injects it.

 
### STATIC-COMPAT-002 — function body compared to captured production snapshot
- **SHA inspected:** `dcf854731f368539f3133e8f96ac03331d8aa702` (same executable fixture content as the replay candidate).
- **Sources:** production snapshot blob `8d096904c777b4c7eae096014b45c59859c96cee`; test baseline blob `89943262f16ae973c1cfc423412d417961dbfd96`.
- **Result:** PASS. Extracted PL/pgSQL bodies match after whitespace/case normalization and removal of the fixture's trailing statement terminator.
- **What it proves:** the test-only baseline body matches the function body captured in the live schema snapshot at RC424 checkpoint.
- **What it does not prove:** original creation migration/version, historical creation ordering, SQL runtime validity, or production release readiness.


## 2026-10-18 — REPLAY-RESUME-005

### CI-REPLAY-005 — next MantiGO function dependency
- **Workflow:** Disposable Supabase Migration Chain Replay
- **Run:** [39079676044](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39079676044)
- **Code SHA tested:** `8c3814ec12206769a6be546a9afc7ed80450554d`
- **Result:** FAIL at migration `20261006101048_rc_mantigo_production_completion_v1.sql`, statement 12: `function public.list_mantigo_captain_rides_backend(uuid) does not exist` (`SQLSTATE 42883`).
- **Progress:** The previous test-only baseline allowed the earlier grant for `list_open_mantigo_rides_backend(uuid)` to pass. The replay now reaches the next grant and stops on the captain-rides function.
- **Read-only live catalog observation:** the production catalog currently exposes `list_mantigo_captain_rides_backend(uuid)` as SECURITY DEFINER with `search_path=public` and an actor mismatch guard (`p_user_id IS NULL OR p_user_id <> auth.uid()`). Its observed body joins rides to accepted bids and returns up to 100 rows. This is current live state, not proof of historical creation provenance.
- **Snapshot verification:** found the exact function definition in trusted schema-only snapshot blob `8d096904c777b4c7eae096014b45c59859c96cee` on recovery branch `recovery/production-schema-baseline-38993809648`; normalized signature/body match the read-only live catalog observation. The snapshot remains live-derived evidence, not original creation DDL.
- **Action:** extended the existing disposable-only MantiGO function baseline with the exact snapshot-observed captain-rides function and strengthened the static validator. The workflow copies the combined definition-only file into the same temporary migration before the earlier GRANT; no historical migration was changed. Awaiting a new Actions run; no pass is claimed.
- **What this proves:** the first compatibility dependency is no longer the current replay blocker; the chain still fails at a second missing function definition.
- **What it does not prove:** clean historical replay, full migration-chain completion, runtime authorization correctness, production parity, or release readiness.
- **Production gate:** BLOCKED / NOT CERTIFIED. No production writes, deployment, merge, or payment occurred.


## 2026-10-18 — REPLAY-RESUME-006

### CI-REPLAY-006 — next missing MantiGO table prerequisite
- **Run:** [39081172390](https://github.com/islamnagy2022-eng/MantiqaTiX/actions/runs/39081172390)
- **Tested code SHA:** `ef5cee4e63a695dea4b5e5583fcf4427994fdeaf`
- **Result:** FAIL during chronological replay at migration `20261006122111_mantigo_financial_config_rls_hardening_v1.sql`, statement 0: `relation public.mantigo_financial_config does not exist` (`SQLSTATE 42P01`).
- **Progress:** The replay passed the two grants in `20261006101048_rc_mantigo_production_completion_v1.sql` after the combined disposable-only MantiGO function baseline was injected. It then reached the next migration and failed because the configuration table has no prior tracked creation migration in the replay prefix.
- **Source inspection:** current production schema snapshot blob `8d096904c777b4c7eae096014b45c59859c96cee` contains `public.mantigo_financial_config` with columns `id boolean`, `commission_rate numeric(6,3)`, `currency text`, `updated_by uuid`, `updated_at timestamptz`, plus commission-rate and singleton-id checks. GitHub code search found RLS/ledger references but no canonical create-table migration in current tracked results; supplied `source_RC40.zip` scan also found zero references.
- **Decision:** do not create or inject a new table fixture without explicit owner approval or recovery of authoritative original DDL. The snapshot is live-state evidence, not proof of historical table-creation provenance.
- **Next action:** recover the original table-creation source/artifact, or obtain explicit approval for a schema-only fixture limited to disposable CI; never apply it to production. Continue preserving historical migrations.
- **Release gate:** BLOCKED / NOT CERTIFIED. No production mutation, merge, deployment, or payment occurred.
