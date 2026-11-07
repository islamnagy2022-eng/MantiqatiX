# V6 Preview browser accessibility correction — 2026-11-06

The first composed Pages browser run built the catalog and V6 preview successfully and passed all earlier source, release, typecheck, build, live catalog, Qadam, OAuth, and public-directory checks. Desktop/mobile browser validation then failed axe-core with critical violation `select-name`.

The identified control is the public directory governorate filter in `src/components/DirectoryView.tsx`. It displayed the visible text "المحافظة:" adjacent to the select but did not programmatically associate a label. The deterministic V6 source overlay now adds `aria-label="تصفية الأنشطة حسب المحافظة"` to that select. No test was weakened and no production database/backend change was made.

Required next gate: rerun the composed Pages validation and require the V6 browser E2E and axe critical-violation check to pass. The overall production verifier still reports the full-platform gate BLOCKED for unapplied required migrations and unverified finance, restore, Auth settings, and Edge Function parity. Catalog-only scope remains separate; no production deployment or V6 root cutover is authorized here.


## Follow-up result — exact-head validation, 2026-11-06

- The initial accessibility patch did not reach the extracted source; the exact browser output still showed the governorate <select> without an accessible name.
- A deterministic extraction overlay was added at `scripts/patch-v6-preview-accessibility.py`. Its JSX scanner tracks quoted attributes and brace expressions, so `>` inside an arrow-function prop is not mistaken for the end of the opening tag. Its self-test covers the arrow-function case, preserves the neighboring specialty select, and verifies idempotency.
- Exact source-validation run: [V6 Preview Source Validation #42187362986](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/42187362986) — PASS on `8660dc34159038164f3287fdf1cae5b30514f85b`; source provenance/security, frozen Bun install, release/remediation tests, complete TypeScript check, and isolated Preview build all passed.
- Exact composed Pages validation: [Deploy MantiqatiX Web #42187362930](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/42187362930) — validation job PASS. Browser output: `V6_PUBLIC_PREVIEW_BROWSER_E2E=PASS`; axe reported `critical=0` and one non-critical violation group.
- The composed artifact was created as artifact [13487699470](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/42187362930/artifacts/13487699470), SHA-256 `64395ec837ac10aa1acf56a30c5f972935802e93506e6446e62629498eeac8d7`.
- The Pages deploy job was SKIPPED for this pull-request event. Therefore the artifact is validated but the public Preview URL is not yet claimed as deployed. No production root cutover or production data/schema/Auth/RLS/GRANT/Edge/payment/finance mutation was performed.
